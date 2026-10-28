# Spec: walls

Module id: `walls` · Depends on: identity · Index: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Shared conventions (commands, structure, code style, testing, boundaries): [SPEC.md](SPEC.md)

## Objective

Let a climber add a spray wall (at a gym or at home) from a photo, mark its holds, and record its angle, so climbs can be set on it. Holds are stored as **normalized, typed geometry**, not dots on a picture, so `climbs`, `metrics`, and the reserved `ai-setting` module can reason about them. Manual hold editing is complete on its own; `hold-detection` only pre-fills it.

### User stories

1. As a climber, I can create a wall: name, gym or home, location (optional), angle (fixed, or adjustable with a range), and public or private.
2. I take or pick a photo of the wall; it becomes the wall's first **layout**.
3. In the hold editor I can add a hold (tap to drop a circle, then resize), draw a custom outline, move, delete, and set a hold's type.
4. I can run hold detection on the photo (see `hold-detection`) and correct the proposals in the same editor.
5. I publish the layout when holds are done; climbs can only be set on a published layout.
6. When the wall is reset or holds change, I can create a **new layout** (new photo, holds copied from the previous layout as a starting point). Old climbs stay viewable on the old layout.
7. As the owner of a private wall, I can invite friends by username to view and set on it, and make someone an admin (can edit holds and layouts).
8. Anyone (including guests) can find public walls by name or nearby, and view them.
9. Gym walls are grouped under a gym; anyone can create a gym entry or pick an existing one.

## Concepts

- **Gym**: a place with one or more walls. Lightweight in V1 (name + location); `gym-tools` (reserved) adds claiming and admin roles.
- **Wall**: a physical climbing surface. `gym_id` null means a home wall.
- **Layout**: one version of a wall: a photo plus its holds. A wall has many layouts and exactly one current layout. Climbs reference a layout, so resetting a wall never corrupts existing climbs.
- **Hold**: a polygon on a layout in normalized image coordinates (`0..1` on both axes, origin top-left), with a type.

## Data Model

```sql
create type wall_visibility as enum ('public', 'private');
create type wall_role       as enum ('owner', 'admin', 'setter');
create type layout_status   as enum ('draft', 'published', 'retired');
create type hold_type       as enum ('jug', 'crimp', 'edge', 'sloper', 'pinch', 'pocket',
                                     'undercling', 'volume', 'foot', 'unknown');
create type hold_source     as enum ('manual', 'detected', 'detected_edited');

create table gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  city        text,
  country     char(2),                       -- ISO 3166-1 alpha-2
  lat         double precision,
  lng         double precision,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table walls (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid references gyms (id) on delete set null,  -- null = home wall
  owner_id       uuid references profiles (id) on delete set null,
  name           text not null check (char_length(name) between 2 and 80),
  visibility     wall_visibility not null default 'public',
  angle_default  smallint not null check (angle_default between -10 and 90),  -- degrees past vertical
  angle_min      smallint check (angle_min between -10 and 90),
  angle_max      smallint check (angle_max between -10 and 90),  -- null min/max = fixed angle
  lat            double precision,          -- home walls: never shown publicly, see RLS
  lng            double precision,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((angle_min is null) = (angle_max is null)),
  check (angle_min is null or angle_min <= angle_default and angle_default <= angle_max)
);

create table wall_members (
  wall_id     uuid references walls (id) on delete cascade,
  user_id     uuid references profiles (id) on delete cascade,
  role        wall_role not null,
  created_at  timestamptz not null default now(),
  primary key (wall_id, user_id)
);

create table wall_layouts (
  id            uuid primary key default gen_random_uuid(),
  wall_id       uuid not null references walls (id) on delete cascade,
  status        layout_status not null default 'draft',
  image_path    text not null,               -- Storage: wall-images/<wall_id>/<layout_id>.jpg
  image_width   integer not null,
  image_height  integer not null,
  published_at  timestamptz,
  created_by    uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- At most one published layout per wall; publishing a new one retires the previous one.
create unique index one_published_layout on wall_layouts (wall_id) where status = 'published';

create table holds (
  id                uuid primary key default gen_random_uuid(),
  layout_id         uuid not null references wall_layouts (id) on delete cascade,
  polygon           jsonb not null,          -- [[x,y], ...] normalized 0..1, ≥ 3 points, clockwise
  cx                real not null check (cx between 0 and 1),   -- centroid, for queries/sorting
  cy                real not null check (cy between 0 and 1),
  area              real not null check (area > 0),             -- normalized area
  type              hold_type not null default 'unknown',
  source            hold_source not null default 'manual',
  detection_id      uuid,                    -- FK added by hold-detection migration
  detected_polygon  jsonb,                   -- original proposal, kept after edits
  confidence        real,
  deleted_at        timestamptz,             -- soft delete: keeps rejected detections countable
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on holds (layout_id) where deleted_at is null;
```

- Holds on a **published** layout can't be moved or deleted if any climb uses them (enforced by `climbs` with a trigger on its join table, see SPEC-climbs.md). Type changes and adding new holds are always allowed.
- Creating a new layout copies all live holds from the current layout (new ids, `source = 'manual'`, `detected_polygon` null).
- The wall owner gets a `wall_members` row with role `owner` on creation (trigger).

### Access helpers (the contract other modules use)

`security definer` SQL functions, owned by `walls`:

| Function | True when |
|---|---|
| `can_view_wall(wall_id)` | wall is public, or caller is a member |
| `can_set_on_wall(wall_id)` | caller is authenticated and (wall is public, or caller is a member) |
| `can_admin_wall(wall_id)` | caller is the owner or an admin member |

`climbs`, `logbook`, and `social` use these in their RLS policies instead of reimplementing wall visibility.

### Row Level Security

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `gyms` | everyone | authenticated | creator | nobody (V1) |
| `walls` | `can_view_wall(id)` | authenticated (`owner_id = auth.uid()`) | `can_admin_wall(id)` | owner only |
| `wall_members` | members of that wall | owner/admin (owner role only via trigger) | owner | owner, or self (leave) |
| `wall_layouts` | `can_view_wall(wall_id)`; drafts only to admins | `can_admin_wall` | `can_admin_wall` | `can_admin_wall`, drafts only |
| `holds` | via layout visibility | `can_admin_wall` | `can_admin_wall` | soft delete only |
| Storage `wall-images` | via `can_view_wall` | `can_admin_wall`, own wall folder | `can_admin_wall` | `can_admin_wall` |

- Home wall coordinates (`walls.lat/lng` where `gym_id is null`) are never returned to non-members: public wall reads go through a `walls_public` view that nulls them.

### Account deletion

- Private walls owned by the user are deleted (cascade to layouts, holds, climbs on them).
- Public walls are kept with `owner_id` set to null. If the wall has admins, the longest-standing admin becomes owner; otherwise it becomes ownerless and read-only for holds until `gym-tools` adds claiming.

## Image handling

- Client resizes to max 3000px on the long edge, JPEG quality 0.85, EXIF orientation applied, and EXIF location stripped before upload.
- `image_width`/`image_height` record the uploaded pixel size; all geometry is normalized, so rendering at any size is a scale.
- No perspective correction in V1; the user should shoot straight-on (the camera screen shows a framing guide).

## Screens

```
app/(app)/walls/index.tsx                  discover: search, nearby, my walls
app/(app)/walls/new.tsx                    create wall: details → photo
app/(app)/walls/[wallId]/index.tsx         wall page (image, info, entry to climbs)
app/(app)/walls/[wallId]/edit.tsx          details, angle, visibility
app/(app)/walls/[wallId]/members.tsx       invite by username, roles
app/(app)/walls/[wallId]/layouts/[layoutId]/editor.tsx   hold editor
app/(app)/gyms/[gymId].tsx                 gym page listing its walls
```

### Hold editor requirements

- Pinch-zoom and pan on the wall image; holds render as outlines, coloured by type.
- Tap empty space → add a circular hold at that point (default radius adjustable with a slider); long-press → draw a freeform outline.
- Tap a hold → select; drag handles to move/resize; type picker; delete.
- Undo/redo for the current editing session.
- "Detect holds" button (when `hold-detection` is available) adds proposals in a distinct style until the user accepts them (accept all / accept one / delete).
- Saves are batched and debounced; leaving with unsaved changes asks for confirmation.
- Rendering stays smooth (no visible lag while panning) with 300 holds on a mid-range Android phone.

## Acceptance Criteria

- [ ] A user can create a home wall and a gym wall, upload a photo, add holds manually, set types, and publish the layout.
- [ ] Holds render in the right place on the image on both platforms and at any zoom level.
- [ ] A fixed-angle wall and an adjustable wall (e.g. 20–50°) both save; invalid angle ranges are rejected.
- [ ] Creating a new layout copies holds, and climbs on the old layout still display on the old photo.
- [ ] Private walls are invisible to guests and non-members; invited members can view them (proven by pgTAP).
- [ ] Only owners/admins can edit holds and layouts (proven by pgTAP).
- [ ] Home wall coordinates are never readable by non-members (proven by pgTAP).
- [ ] Guests can search public walls by name and see nearby walls when they grant location permission.
- [ ] Uploaded images have no EXIF GPS data.
- [ ] Hold editor meets the 300-hold smoothness requirement on a mid-range Android device.

## Testing

- **pgTAP:** RLS for all tables and the three access helpers (guest, non-member, setter, admin, owner); one-published-layout constraint; owner-membership trigger; angle checks; account-deletion behavior.
- **Jest:** geometry utilities (normalize/denormalize, centroid, area, point-in-polygon hit testing, circle → polygon); editor state reducer (add/move/delete/undo/redo).
- **Maestro:** create home wall → add photo (fixture image) → add 3 holds → publish.
- **Manual:** editor performance on a mid-range Android phone.

## Out of Scope

- Perspective correction, multi-photo stitching, 3D walls.
- Gym claiming, gym admin roles, official walls (`gym-tools`).
- LED mapping of holds.
- Standardized commercial boards (Kilter, Moon, Tension layouts).

## Decisions

- Anyone can create public gym walls (community model), with reporting via `social`. (Resolved 2026-10-28.)
