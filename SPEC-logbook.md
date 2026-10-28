# Spec: logbook

Module id: `logbook` · Depends on: climbs · Index: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Shared conventions: [SPEC.md](SPEC.md)

## Objective

Record every attempt and send a climber makes, grouped into one session per day, plus their grade opinion. Logging must be **one or two taps** and must **work offline**, because gym signal is often bad. This is the raw data for `metrics` now and for `ai-setting` and `ai-beta` later, so it stores every attempt, not just sends.

### User stories

1. On a climb, I tap **+ Attempt** each time I fall, and **Sent** when I top it. That's the whole log.
2. If I send without any logged falls and have never attempted the climb before, it's recorded as a **flash**.
3. After sending, I'm optionally asked for my grade vote (a single grade, or a split like V4/5) and a quality rating (1–3 stars). I can skip both.
4. Logging works without signal. Entries queue on the device and sync when I'm back online, with no duplicates.
5. My logs are grouped automatically into **one session per day**; there's nothing to start or end. I can see today's session and past days, and add a note to any of them.
6. I can see my history of a climb (attempts, sends, dates) and edit or delete my entries.
7. On a climb page, anyone can see the send count, the consensus grade, the grade spread, and how the consensus changed over time.
8. When browsing a wall, I can filter by sent / attempted / untried.
9. My logbook is public by default; I can make it private, in which case only I can see my individual entries. Aggregate counts on climbs still include them anonymously.

## Definitions

| Term | Rule |
|---|---|
| Attempt | One row per try. `result = 'fall'` or `'send'`. |
| Send | An attempt with `result = 'send'`. |
| First send | The user's earliest send on a climb. |
| Flash | A first send with no earlier attempts by that user on that climb, logged in any session. |
| Repeat | Any send after the first send. |
| Session | All of a user's attempts on one calendar day, in the device's local timezone at the time of logging. Exactly one session per user per day, created automatically by the first attempt that day. |

## Data Model

```sql
create type attempt_result as enum ('fall', 'send');

create table sessions (
  user_id           uuid not null references profiles (id) on delete cascade,
  session_date      date not null,              -- local calendar day; one session per user per day
  first_attempt_at  timestamptz not null,       -- maintained by trigger
  last_attempt_at   timestamptz not null,       -- maintained by trigger
  note              text check (char_length(note) <= 1000),
  created_at        timestamptz not null default now(),
  primary key (user_id, session_date)
);

create table attempts (
  id            uuid primary key,               -- client-generated, idempotent upsert
  user_id       uuid not null references profiles (id) on delete cascade,
  climb_id      uuid not null references climbs (id) on delete cascade,
  session_date  date not null,                 -- device-local date of attempted_at
  foreign key (user_id, session_date) references sessions (user_id, session_date) on delete cascade,
  result        attempt_result not null,
  angle         smallint not null,              -- copied from climb at log time (adjustable walls)
  high_hold_id  uuid references holds (id),     -- optional: highest hold reached on a fall (reserved for ai-beta)
  attempted_at  timestamptz not null,           -- device time of the tap
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz                     -- soft delete, so sync can't resurrect deleted rows
);
create index on attempts (user_id, attempted_at desc) where deleted_at is null;
create index on attempts (climb_id) where deleted_at is null;

create table grade_votes (
  user_id      uuid references profiles (id) on delete cascade,
  climb_id     uuid references climbs (id) on delete cascade,
  grade_low    smallint not null check (grade_low between 0 and 23),
  grade_high   smallint check (grade_high between 0 and 23),   -- split grade; null = single grade
  stars        smallint check (stars between 1 and 3),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, climb_id),
  check (grade_high is null or grade_high > grade_low)
);

create table climb_grade_history (
  climb_id         uuid references climbs (id) on delete cascade,
  consensus_grade  numeric(4,2) not null,
  vote_count       integer not null,
  recorded_at      timestamptz not null default now()
);

create table logbook_settings (
  user_id     uuid primary key references profiles (id) on delete cascade,
  is_private  boolean not null default false
);
```

- A grade vote requires the user to have sent the climb (trigger).
- **Consensus grade:** the median of vote midpoints (`(grade_low + coalesce(grade_high, grade_low)) / 2`). It's written to `climbs.consensus_grade` once there are at least **11 votes** (null before that), and a row is added to `climb_grade_history` whenever it changes by ≥ 0.5.
- `climbs.send_count` counts distinct users with at least one live send. Both columns are maintained by triggers in this module.
- The setter grade is **not** a vote; it's stored on the climb and shown alongside the consensus when they differ (see SPEC-climbs.md).
- This module's migration also adds the `climbs` hold lock: a climb's `climb_holds` can't change once a user other than the setter has a live attempt on it.

## Offline sync

- The client writes attempts to a local queue (SQLite via `expo-sqlite`) with UUIDs generated on the device, and shows them immediately. Each attempt carries its device-local `session_date`.
- On sync, the session row is upserted on `(user_id, session_date)` before its attempts, so two devices logging on the same day merge into one session.
- A sync worker upserts queued rows (`on conflict (id) do nothing`) when the device is online, retrying with backoff. Deletes are synced as `deleted_at` updates.
- Server-side flash and first-send logic uses `attempted_at` order, so out-of-order sync still gives correct results.
- Grade votes are saved online only; if offline, the prompt is deferred until the device reconnects.
- Logging a climb whose holds or wall became inaccessible while offline is rejected by RLS on sync. The entry stays in the local queue, marked as failed, and the user can discard it.

### Row Level Security

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `sessions` | owner; others if the owner's logbook is public | owner (upsert on sync) | owner (`note` only; timestamps by trigger) | — (removed when its last attempt is deleted) |
| `attempts` | owner; others if the owner's logbook is public and `can_view_wall` of the climb's wall | owner, and the climb is visible to them and published | owner (soft delete, `high_hold_id`) | — (soft delete only) |
| `grade_votes` | everyone who can view the climb (votes are shown as an anonymized distribution; the per-user vote is visible only to its owner, or to others if the logbook is public) | owner, and they've sent the climb | owner | owner |
| `climb_grade_history` | follows climb visibility | triggers only | — | — |
| `logbook_settings` | owner | owner | owner | — |

### Account deletion

Sessions, attempts, and votes cascade. Triggers recompute `send_count` and `consensus_grade` for the affected climbs.

## Interfaces provided

- `climb_user_status(climb_id)` → `untried | attempted | sent | flashed` for the current user.
- The `logbook.status` filter for `browse_climbs` (see SPEC-climbs.md).
- Attempts and sessions are the input to `metrics`, and to the `social` feed (sends and flashes).

## Screens

```
app/(app)/climbs/[climbId].tsx       (+) attempt / Sent buttons, my history, grade distribution chart
app/(app)/log/index.tsx              today's session + previous days
app/(app)/log/sessions/[date].tsx    session (day) detail, note
app/(app)/settings/logbook.tsx       private toggle
```

- The **+ Attempt** and **Sent** buttons are large, sit within thumb reach on the climb screen, and give haptic feedback.
- Undo for the last log entry is available for 10 seconds (snackbar).

## Acceptance Criteria

- [ ] Logging an attempt or a send takes one tap and shows up instantly, including in airplane mode.
- [ ] Entries logged offline sync once without duplicates after reconnecting; killing the app before sync doesn't lose them.
- [ ] Flash, first send, and repeat are classified correctly, including when entries sync out of order.
- [ ] All attempts on the same local day land in exactly one session, including attempts synced from two devices; a note can be added to any session.
- [ ] Grade votes (single or split) and stars can be added after a send; voting without a send is rejected (proven by pgTAP).
- [ ] Consensus grade, send count, and grade history update correctly when votes or sends are added, edited, deleted, or removed by account deletion.
- [ ] A private logbook hides individual entries from everyone else, while aggregate counts stay correct (proven by pgTAP).
- [ ] The sent / attempted / untried browse filter works.
- [ ] Undo removes the last entry within 10 seconds.

## Testing

- **Jest:** sync queue (enqueue, retry, idempotency, soft-delete propagation), local-date session assignment (including around midnight and timezone changes), flash classification on the client side.
- **pgTAP:** RLS (owner, public and private logbook viewer, guest); one session per user per day; session timestamp trigger; climbs hold lock; vote-requires-send trigger; consensus and history triggers with fixture vote sets; send_count with repeats and deletes; flash logic with out-of-order `attempted_at`.
- **Maestro:** open climb → 2 attempts → send → vote → see it in the session. Then airplane mode → log → reconnect → entry synced.

## Out of Scope

- Free-form outdoor or non-app climbs.
- Video uploads of attempts (`ai-beta`).
- Training plans (`metrics` covers analysis only).
- A followers-only logbook visibility level (could come with `social` later).

## Decisions

- Consensus grade requires 11 votes; the setter grade isn't a vote and is shown separately when it differs. (Resolved 2026-10-28.)
- Sessions are one per calendar day, fully automatic. (Resolved 2026-10-28.)
