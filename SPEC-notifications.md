# Spec: notifications

Module id: `notifications` · Depends on: social (and transitively identity, climbs, logbook) · Index: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Shared conventions: [SPEC.md](SPEC.md)

## Objective

Tell climbers when something relevant happens: someone likes or comments on their climb, someone follows them, or a new climb appears on a wall they follow. Notifications arrive as **push notifications** and in an **in-app inbox**, and each type can be switched off.

### User stories

1. I get a push and an inbox entry when someone likes my climb, comments on my climb, or follows me.
2. I get a push when a new climb is published on a wall I follow, batched so a setting session doesn't send me 20 pushes.
3. Tapping a notification opens the relevant climb or profile.
4. The inbox lists my notifications newest first, with unread ones highlighted. Opening the inbox marks them as read, and the tab shows an unread badge.
5. I can turn each notification type on or off for push, and separately for the inbox.
6. The app asks for push permission after my first meaningful action (publishing a climb, or following someone), not at first launch.
7. I never get notified about my own actions, or about anything done by users I've blocked or who have blocked me.

## Notification types

| Type | Trigger (source table) | Recipient | Batching |
|---|---|---|---|
| `climb_liked` | insert into `likes` | climb setter | Grouped: "Alex and 3 others liked *Crimp City*" if within 1 h |
| `climb_commented` | insert into `comments` | climb setter | None |
| `new_follower` | insert into `follows` | followee | Grouped within 1 h |
| `wall_new_climbs` | climb published on a followed wall | wall followers | At most 1 push per wall per user per 6 h: "4 new climbs on *The Cave*" |

## Architecture

```
source insert (likes/comments/follows/climbs)
   └─ AFTER INSERT trigger → enqueue_notification(...)  (security definer)
        ├─ skips self-actions, blocked pairs, disabled inbox preference
        ├─ upserts into notifications (grouping key + time window)
        └─ inserts into push_outbox if push is enabled for that type
pg_cron every minute → Edge Function `send-push`
   ├─ reads due push_outbox rows (respecting batching windows)
   ├─ sends via Expo Push API in chunks of 100
   ├─ stores tickets; a later run checks receipts
   └─ deletes tokens that return DeviceNotRegistered
```

- **Expo Push Service** (`expo-notifications`). It's free and covers APNs and FCM; credentials are managed by EAS.
- Push content contains no private data beyond names and climb titles. Payload: `{ type, notificationId, url }`, where `url` is an Expo Router deep link (e.g. `toppl://climbs/<id>`).

## Data Model

```sql
create type notification_type as enum ('climb_liked', 'climb_commented', 'new_follower', 'wall_new_climbs');

create table push_tokens (
  token         text primary key,          -- ExponentPushToken[...]
  user_id       uuid not null references profiles (id) on delete cascade,
  platform      text not null check (platform in ('ios', 'android')),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles (id) on delete cascade,
  type          notification_type not null,
  group_key     text not null,             -- e.g. 'climb_liked:<climb_id>'
  actor_ids     uuid[] not null default '{}',   -- most recent first, max 10 stored
  actor_count   integer not null default 1,
  climb_id      uuid references climbs (id) on delete cascade,
  wall_id       uuid references walls (id) on delete cascade,
  comment_id    uuid references comments (id) on delete cascade,
  read_at       timestamptz,
  updated_at    timestamptz not null default now(),   -- bumps when grouped
  created_at    timestamptz not null default now()
);
create index on notifications (recipient_id, updated_at desc);

create table push_outbox (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid not null references notifications (id) on delete cascade,
  send_after       timestamptz not null default now(),   -- batching window end
  sent_at          timestamptz,
  ticket_ids       text[],
  error            text,
  created_at       timestamptz not null default now()
);

create table notification_preferences (
  user_id  uuid references profiles (id) on delete cascade,
  type     notification_type,
  push     boolean not null default true,
  inbox    boolean not null default true,
  primary key (user_id, type)
);
```

- Grouping: a new event with the same `group_key`, arriving while the recipient's existing notification is unread and less than 1 hour old (6 hours for `wall_new_climbs`), updates that row instead of creating a new one: actors are prepended, `actor_count` is incremented, and `updated_at` is bumped. Pending outbox rows for it are rescheduled rather than duplicated.
- Unlikes, comment deletions, and unfollows don't retract notifications in V1.
- Missing preference rows mean "on".

### Row Level Security

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `push_tokens` | owner | owner | owner (`last_seen_at`) | owner |
| `notifications` | recipient | triggers only | recipient (`read_at` only) | recipient |
| `push_outbox` | none (service role) | triggers only | service role | service role |
| `notification_preferences` | owner | owner | owner | owner |

### Account deletion

Tokens, notifications received, preferences, and outbox rows cascade. The user's id is removed from other users' `actor_ids` by the deletion trigger, and `actor_count` is left unchanged.

## Client behavior

- Registers the push token after permission is granted, and refreshes `last_seen_at` on app start. The token is deleted on sign-out.
- Foreground notifications show as an in-app banner, not a system notification.
- Tapping a notification (cold start or background) routes to its `url`; if the target was deleted or hidden, it shows a "no longer available" screen.
- Inbox: the `notifications` table with Realtime subscription for live updates; badge = unread count.

## Screens

```
app/(app)/inbox/index.tsx                 inbox list
app/(app)/settings/notifications.tsx      per-type push/inbox toggles, OS permission status + link to system settings
```

## Acceptance Criteria

- [ ] Each of the four types creates an inbox entry and a push on physical iOS and Android devices (EAS development build).
- [ ] Grouping works: 5 likes within an hour give one notification ("… and 4 others") and at most one push per window.
- [ ] Publishing 4 climbs on a followed wall within 6 hours gives followers a single push.
- [ ] No notifications are created for self-actions or between blocked users (proven by pgTAP).
- [ ] Disabling a type stops its pushes and/or inbox entries as chosen.
- [ ] Tapping a push opens the right screen from a cold start and from the background on both platforms.
- [ ] The unread badge and the inbox update live; opening the inbox marks items as read.
- [ ] Invalid tokens (DeviceNotRegistered) are deleted after the receipt check.
- [ ] The permission prompt appears after the first publish or follow, not at launch.

## Testing

- **pgTAP:** `enqueue_notification` for each type (recipient, self-skip, block-skip, preferences, grouping window, outbox scheduling); RLS for every table; account-deletion cleanup of `actor_ids`.
- **Deno:** `send-push` with a mocked Expo API (chunking, ticket storage, receipt handling, token cleanup, batching windows).
- **Jest:** deep-link routing from a notification payload; inbox item text for grouped notifications.
- **Manual:** push delivery and tap-to-open on physical devices on both platforms.

## Out of Scope

- Email notifications.
- Notifications when someone sends my climb (decided 2026-10-28).
- Notifications for comments on climbs I commented on (no reply threads in V1).
- Quiet hours and digest emails.
- Gym announcements and competition reminders (`gym-tools`).
