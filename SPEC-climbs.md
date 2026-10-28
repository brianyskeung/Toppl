# Spec: climbs

Module id: `climbs` · Depends on: walls · Index: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Shared conventions: [SPEC.md](SPEC.md)

## Objective

Let climbers set problems on a wall's holds, and let anyone browse, filter, and view them. This module also owns the **grade system**: one canonical internal scale with conversion to Hueco (V), Font, and DanKyu, used by every other module.

### User stories

1. As a climber on a published layout, I can set a climb: tap holds and assign roles (start, hand, foot, finish), choose a grade, name it, add style tags, a foot rule, and an optional description.
2. I can save a climb as a draft and publish it later. Only I can see my drafts.
3. Anyone who can view the wall (including guests on public walls) can browse its climbs, filter by grade range, style tags, and setter, search by name, and sort by newest, popularity, grade, or name.
4. Opening a climb shows the wall photo with the climb's holds highlighted by role and all other holds dimmed, plus grade, setter, tags, angle, and description. Once a climb has a consensus grade, it's shown as the main grade, and the setter's grade is shown next to it whenever the two differ (e.g. "V5 · setter: V4").
5. I see grades in my preferred grade system everywhere (guests see Hueco by default and can switch).
6. I can edit my climb's name, description, tags, and foot rule at any time. I can change its holds only until someone else has logged it.
7. I can create lists (public or private), add climbs from any wall I can view, and reorder them. Every user has a built-in **Saved** list.
8. Climbs on a retired layout stay viewable and are labeled "retired"; they're hidden by default when browsing.

## Grade system

**Canonical scale:** `grade_value smallint` indexes the Font scale, the finest common scale:

| value | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Font | 3 | 4 | 4+ | 5 | 5+ | 6A | 6A+ | 6B | 6B+ | 6C | 6C+ | 7A | 7A+ | 7B | 7B+ | 7C | 7C+ | 8A | 8A+ | 8B | 8B+ | 8C | 8C+ | 9A |
| Hueco | VB | V0 | V0 | V1 | V2 | V3 | V3 | V4 | V4 | V5 | V5 | V6 | V7 | V8 | V8 | V9 | V10 | V11 | V12 | V13 | V14 | V15 | V16 | V17 |

- DanKyu mapping and the final conversion values are **to be finalized later**. Until then, the table above is provisional; all conversion goes through `grades.ts`, so changing it later is a one-file change (plus the SQL mirror and fixture).
- Values that share a Hueco grade (e.g. 6B and 6B+ → V4) display as one grade. A consensus that falls between two Hueco grades displays as a split grade (e.g. "V4/5").
- Conversion lives in one place, `apps/mobile/src/features/climbs/grades.ts`, mirrored by the SQL function `grade_label(value numeric, system grade_system)` for server-side sorting and labels. A shared fixture of test cases keeps the two in sync.

## Data Model

```sql
create type climb_status as enum ('draft', 'published');
create type hold_role    as enum ('start', 'hand', 'foot', 'finish');
create type foot_rule    as enum ('open', 'marked_only', 'feet_follow_hands');
create type style_tag    as enum ('crimpy', 'slopey', 'pinchy', 'juggy', 'pockety', 'compression',
                                  'dynamic', 'technical', 'powerful', 'endurance', 'reachy', 'balance');

create table climbs (
  id               uuid primary key default gen_random_uuid(),
  wall_id          uuid not null references walls (id) on delete cascade,
  layout_id        uuid not null references wall_layouts (id) on delete cascade,
  setter_id        uuid references profiles (id) on delete set null,
  status           climb_status not null default 'draft',
  name             text not null check (char_length(name) between 1 and 60),
  description      text check (char_length(description) <= 500),
  setter_grade     smallint not null check (setter_grade between 0 and 23),
  angle            smallint not null,       -- must be within the wall's angle range (trigger)
  foot_rule        foot_rule not null default 'open',
  style_tags       style_tag[] not null default '{}',
  -- Written by `logbook` (denormalized for browse/sort). climbs owns the columns; logbook owns the values.
  consensus_grade  numeric(4,2),            -- null until 11 votes (see SPEC-logbook.md)
  send_count       integer not null default 0,
  published_at     timestamptz,
  hidden_at        timestamptz,             -- moderation hook, set by `social`
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on climbs (wall_id, status, published_at desc);
create index on climbs using gin (style_tags);
create index on climbs using gin (name gin_trgm_ops);

create table climb_holds (
  climb_id  uuid references climbs (id) on delete cascade,
  hold_id   uuid references holds (id),
  role      hold_role not null,
  primary key (climb_id, hold_id)
);

create table lists (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  description  text check (char_length(description) <= 280),
  is_public    boolean not null default false,
  is_saved     boolean not null default false,   -- the built-in "Saved" list
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index one_saved_list_per_user on lists (owner_id) where is_saved;

create table list_climbs (
  list_id    uuid references lists (id) on delete cascade,
  climb_id   uuid references climbs (id) on delete cascade,
  position   integer not null,
  added_at   timestamptz not null default now(),
  primary key (list_id, climb_id)
);
```

### Validation rules (trigger on publish, mirrored in Zod)

- 1–2 `start` holds, 1–2 `finish` holds, at least 3 holds in total.
- Every hold belongs to the climb's `layout_id`, isn't soft-deleted, and the layout is `published`.
- `angle` is within the wall's `angle_min..angle_max`, or equals `angle_default` for fixed walls.
- A climb's `climb_holds` can't change once anyone other than the setter has logged it. `logbook`'s migration adds this check, which keeps the dependency pointing logbook → climbs; until `logbook` exists, editing is always allowed.
- Holds used by any published climb can't be moved or deleted in `walls` (trigger on `holds`, defined in this module's migration).

### Row Level Security

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `climbs` | published, not hidden, and `can_view_wall(wall_id)`; drafts only to the setter | `can_set_on_wall(wall_id)` and `setter_id = auth.uid()` | setter, or `can_admin_wall` (for moderation) | setter (drafts any time; published only if nobody else logged it); `can_admin_wall` |
| `climb_holds` | follows climb | climb setter | climb setter, subject to the rules above | climb setter |
| `lists` | public lists to everyone; private lists to the owner | owner | owner | owner (not the Saved list) |
| `list_climbs` | follows list, and only climbs the viewer can see | list owner | list owner | list owner |

### Account deletion

- Drafts are deleted.
- Published climbs on public walls are kept, with `setter_id` set to null (shown as "deleted user").
- Climbs on the user's private walls are deleted with the wall (`walls` cascade).
- Lists cascade.

## Browse and query contract

`browse_climbs(wall_id, filters jsonb, sort text, cursor text, limit int default 30)` is an RPC returning climbs plus display fields. It's cursor-paginated and respects RLS.

- **Core filters:** `grade_min`, `grade_max` (on the consensus grade, falling back to the setter grade), `style_tags` (any or all), `setter_id`, `query` (fuzzy name match), `include_retired`.
- **Extension point:** downstream modules add filters by extending the RPC in their own migrations with a namespaced key. `logbook` adds `logbook.status` (sent / attempted / untried). `social` adds `social.liked` and `social.following_setters`. Unknown keys are ignored.
- The client keeps filter state per wall across sessions (local storage).

## Screens

```
app/(app)/walls/[wallId]/climbs.tsx        browse + filter sheet + search
app/(app)/climbs/[climbId].tsx             climb view
app/(app)/climbs/new.tsx?wallId=           set a climb: pick holds/roles → details → publish/draft
app/(app)/climbs/[climbId]/edit.tsx
app/(app)/lists/index.tsx                  my lists (incl. Saved)
app/(app)/lists/[listId].tsx
```

- Role colors: start green, hand blue, foot yellow, finish red, configurable later. Each role also has a non-color indicator (outline style) for color-blind users.
- In setting mode, tapping a hold cycles through its roles: unselected → hand → start → finish → foot → unselected.

## Acceptance Criteria

- [ ] A climber can set, save as draft, and publish a climb on a published layout, on both platforms.
- [ ] Publishing fails with a clear message when start/finish/hold-count or angle rules are violated (client and server).
- [ ] Browsing a wall with 1,000 climbs shows the first page in < 1 s on local Supabase, and filters and sorts combine correctly.
- [ ] Grades show in the viewer's grade system; conversion matches the shared fixture in both TypeScript and SQL.
- [ ] Climbs with a consensus grade show it as the main grade, plus the setter grade when they differ; climbs without one show the setter grade only.
- [ ] Guests can browse and view climbs on public walls; nobody sees climbs on private walls they're not a member of, or other users' drafts (proven by pgTAP).
- [ ] Holds used by a published climb can't be moved or deleted (proven by pgTAP).
- [ ] Holds of a climb logged by others can't be changed; name, description, and tags can.
- [ ] Lists: create, add, remove, reorder, public/private visibility, and the Saved list exists for every user.
- [ ] Retired-layout climbs display on their original photo and are hidden by default in browse.
- [ ] Filter state persists per wall across app restarts.

## Testing

- **Jest:** grade conversion (shared fixture), climb validation schema, role-cycling reducer.
- **pgTAP:** RLS for every table (guest, non-member, member, setter, admin); publish validation trigger; hold lock trigger; `browse_climbs` filters, sorting, and pagination against fixture data; `grade_label` against the shared fixture.
- **Maestro:** open wall → set a 4-hold climb → publish → find it in browse → save to the Saved list.

## Out of Scope

- Official or benchmark climbs, circuits, and competitions (`gym-tools`).
- Mirroring climbs (LED-related in Stōkt).
- Climb video beta (`ai-beta`) and generated climbs (`ai-setting`).
- Grade votes, sends, and ascents (`logbook`); likes and comments (`social`).

## Open Questions

- Final grade conversion values and DanKyu mapping (deferred; finalize before public release).
