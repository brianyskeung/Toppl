# Spec: social

Module id: `social` · Depends on: identity, walls, climbs, logbook · Index: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Shared conventions: [SPEC.md](SPEC.md)

## Objective

Make toppl a community: follow climbers and walls, like and comment on climbs, and see an activity feed. This module also covers **user-generated content (UGC) safety**: reporting, blocking, a basic content filter, and moderation. Apple and Google require these before a public release of an app with user content.

### User stories

1. I can follow and unfollow climbers. Profiles show follower and following counts and lists.
2. I can follow walls to see what's new on them.
3. I can like a climb, and see like counts. "Liked" works as a filter when browsing a wall.
4. I can comment on a climb, edit or delete my comments, and read everyone's comments (guests can read too).
5. My **Following feed** shows, newest first: climbs published by people I follow, and sends and flashes by people I follow whose logbooks are public.
6. A **wall feed** on each wall page shows new climbs and recent sends on that wall (Stōkt's "gym activity feed" equivalent).
7. I can report a climb, comment, wall, or profile with a reason.
8. I can block a user. We then can't see each other's comments, can't follow each other, and they disappear from my feeds.
9. Comments containing words on a blocklist are rejected with a message.
10. As the builder/admin, I can review reports and hide content. Hidden content disappears for everyone except its author, who sees a "hidden" label.

## Data Model

```sql
create type report_target as enum ('climb', 'comment', 'wall', 'profile');
create type report_status as enum ('open', 'actioned', 'dismissed');

create table follows (
  follower_id  uuid references profiles (id) on delete cascade,
  followee_id  uuid references profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table wall_follows (
  user_id     uuid references profiles (id) on delete cascade,
  wall_id     uuid references walls (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, wall_id)
);

create table likes (
  user_id     uuid references profiles (id) on delete cascade,
  climb_id    uuid references climbs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, climb_id)
);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  climb_id    uuid not null references climbs (id) on delete cascade,
  author_id   uuid references profiles (id) on delete set null,
  body        text not null check (char_length(body) between 1 and 1000),
  edited_at   timestamptz,
  deleted_at  timestamptz,                -- soft delete: shows "comment deleted"
  hidden_at   timestamptz,                -- moderation
  created_at  timestamptz not null default now()
);
create index on comments (climb_id, created_at);

create table blocks (
  blocker_id  uuid references profiles (id) on delete cascade,
  blocked_id  uuid references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references profiles (id) on delete set null,
  target_type  report_target not null,
  target_id    uuid not null,
  reason       text not null check (char_length(reason) between 3 and 500),
  status       report_status not null default 'open',
  resolved_by  uuid references profiles (id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table app_admins (
  user_id  uuid primary key references profiles (id) on delete cascade
);

-- Denormalized counters, maintained by triggers.
alter table profiles add column if not exists follower_count  integer not null default 0;
alter table profiles add column if not exists following_count integer not null default 0;
alter table climbs   add column if not exists like_count      integer not null default 0;
alter table climbs   add column if not exists comment_count   integer not null default 0;
```

- **Moderation hooks:** `climbs.hidden_at` already exists. This module's migration adds `hidden_at` to `walls` and `profiles`, and updates their select policies so hidden rows are visible only to their author or owner and to admins. That's the one place `social` changes another module's tables; it's done through a single migration that's listed in the PR.
- **Blocks:** helper `is_blocked_between(a, b)`. Comment and follow inserts are rejected when a block exists in either direction. Feeds and comment lists exclude blocked users.
- **Content filter:** a `banned_terms` table plus a trigger on `comments` that rejects matches (case-insensitive, whole word). Climb names, wall names, and profile text use the same check, as a trigger added by this migration.

## Feeds

Both feeds are built at query time by RPCs over the existing tables, with no fan-out tables. That's fine at this scale and keeps writes simple.

- `feed_following(cursor, limit)`: a union of published climbs where `setter_id` is someone the caller follows, and first sends or flashes by followees with public logbooks. Ordered by event time, cursor-paginated. Excludes hidden and blocked content and anything the caller can't view.
- `feed_wall(wall_id, cursor, limit)`: new climbs on the wall plus first sends on it (public logbooks only). Guests can read it on public walls.
- Event shape: `{ type: 'climb_published' | 'send' | 'flash', actor, climb, wall, grade, at }`.
- Extends `browse_climbs` with the `social.liked` and `social.following_setters` filters.

### Row Level Security

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `follows` | everyone | follower = caller, no block | — | follower |
| `wall_follows` | owner | owner, `can_view_wall` | — | owner |
| `likes` | everyone (counts); per-user rows to everyone | caller, climb visible | — | owner |
| `comments` | anyone who can view the climb; excluding hidden (except author/admin) and blocked authors | authenticated, climb visible, not blocked by the climb's setter | author (body only, sets `edited_at`) | author (soft) |
| `blocks` | blocker | blocker | — | blocker |
| `reports` | reporter (own), admins | authenticated | admins | — |
| `app_admins` | admins | none (set in Studio) | none | none |

### Account deletion

Follows, wall follows, likes, blocks, and admin rows cascade, and counters are recomputed. Comments are kept, with `author_id` set to null ("deleted user"). Reports are kept, with `reporter_id` set to null.

## Moderation (V1)

- Admins are rows in `app_admins`, added by the builder in Supabase Studio.
- Admin screen in the app (`app/(app)/admin/reports.tsx`, visible only to admins): list open reports, view the target, then **Hide** (sets `hidden_at`) or **Dismiss**.
- Hiding is reversible (clear `hidden_at`). Nothing is hard-deleted by moderation.
- The app shows a moderation contact email in Settings (required by the stores).

## Screens

```
app/(app)/feed/index.tsx                 Following feed (guests: prompt to sign in + popular walls)
app/(app)/walls/[wallId]/index.tsx       wall feed section, follow-wall button
app/(app)/climbs/[climbId].tsx           like button, comments thread, report menu
app/(app)/profile/[username].tsx         follow button, counts, followers/following lists, block/report menu
app/(app)/settings/blocked.tsx           blocked users, unblock
app/(app)/admin/reports.tsx              admin only
```

All write actions go through `useRequireAuth()` from `identity`.

## Acceptance Criteria

- [ ] Follow and unfollow climbers and walls; counts update and stay correct (proven by pgTAP).
- [ ] Like and unlike climbs; the "Liked" browse filter works.
- [ ] Comment, edit, and delete; guests can read comments; deleted comments show a placeholder.
- [ ] The Following feed shows followees' published climbs and public sends/flashes in time order, paginated, excluding private logbooks, hidden content, blocked users, and private walls the viewer isn't a member of (proven by pgTAP).
- [ ] The wall feed works for guests on public walls.
- [ ] Blocking hides each user's comments and feed items from the other and prevents follows and comments in both directions (proven by pgTAP).
- [ ] Reporting works for every target type; admins can hide or dismiss; hidden content is visible only to its author and admins.
- [ ] Banned terms are rejected in comments, climb names, wall names, and profile text, with a clear message.
- [ ] The Store Readiness UGC requirements in SPEC.md are met (report, block, filter, moderation contact).

## Testing

- **pgTAP:** RLS for every table; block enforcement on follow and comment insert; counter triggers; both feed RPCs against fixture data (followees, private logbook, block, hidden climb, private wall); banned-term triggers; hidden-content visibility on climbs, walls, and profiles.
- **Jest:** feed item rendering per event type; optimistic like/follow state.
- **Maestro:** follow a user → they publish a climb (seeded) → it appears in the feed → like → comment → report it.

## Out of Scope

- Direct messages.
- Threaded replies or mentions in comments.
- Comments on sends or sessions (comments are on climbs only).
- Automated or ML moderation.
- Gym-official accounts and announcements (`gym-tools`).

## Deferred

- Terms-of-service acceptance on sign-up (Apple expects it for UGC apps): revisit before public release.
- "Followers only" logbook visibility: not in V1.
