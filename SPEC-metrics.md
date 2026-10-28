# Spec: metrics

Module id: `metrics` · Depends on: logbook · Index: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Shared conventions: [SPEC.md](SPEC.md)

## Objective

Turn a climber's logbook into a clear picture of their climbing: what they send, how they're progressing, how much they climb, and where their strengths and weaknesses are. This is toppl's main V1 differentiator over Stōkt's basic charts. Metrics are **read-only and derived**: no new user input, and every number is defined precisely below so it can be tested.

### User stories

1. As a climber, I open my Stats tab and see a summary: sends this month, hardest send, flash rate, climbing days per week, with a comparison to the previous period.
2. I can see my grade pyramid, progression over time, volume, flash rate and attempts-to-send by grade, style profile, hold-type profile, and angle breakdown.
3. I can filter all of these by time range (30 days, 90 days, 1 year, all time), by wall, and by angle range.
4. Each day I climb gets a session recap, live during the day and final afterwards.
5. I can view another climber's stats if their logbook is public.

## Metric definitions

All metrics only count non-deleted attempts within the selected filters. "Grade" means the climb's consensus grade if it has one, otherwise the setter grade, rounded to the nearest canonical `grade_value` (see SPEC-climbs.md).

| Id | Metric | Definition |
|---|---|---|
| M1 | Summary tiles | Sends (distinct climbs sent in range), hardest send (max grade among sends), flash rate (M5 overall), climbing days per week (sessions in range ÷ weeks in range). Sends and climbing days also show the change vs. the previous period of equal length (e.g. "+3 vs previous 30 days") |
| M2 | Grade pyramid | Per grade: number of distinct climbs first-sent in range, split into flashes and other first sends. Repeats excluded |
| M3 | Progression | Per calendar month: hardest first send, and the average grade of the user's top 10 first sends in the trailing 60 days, as of month end. Months with no sends show a gap |
| M4 | Volume | Per ISO week: total attempts, sends, climbing days (sessions), and total climbing time (sum of `last_attempt_at − first_attempt_at` per session, capped at 5 h) |
| M5 | Flash rate | Per grade and overall: flashes ÷ distinct climbs first-sent. Shown only where the denominator is ≥ 3 |
| M6 | Attempts to send | Per grade: median and distribution (1, 2–3, 4–10, 11+) of the attempts it took to first-send, counting all attempts before and including the first send |
| M7 | Style profile | Per style tag: send rate = distinct climbs sent ÷ distinct climbs attempted, among climbs within ±1 grade of the user's 90-day M3 average. Shown as the difference from the user's overall send rate in that band. Tags with fewer than 5 attempted climbs are hidden |
| M8 | Hold-type profile | Per hold type (`unknown` excluded): share of hand holds of that type among climbs sent vs. climbs attempted but not sent, same grade band as M7. Shown with a note when < 60% of holds are typed |
| M9 | Angle breakdown | Per 5° bucket of attempt angle: attempts, sends, and hardest send. Shown only if the user climbed at ≥ 2 distinct angles |
| M10 | Hard volume | Per ISO week: attempts on climbs within 1 grade of the user's 90-day hardest first send |
| M11 | Session recap | For one day's session: climbing time (first to last attempt), climbs tried, attempts, sends, flashes, hardest send, new personal bests (first send at a grade above the user's max before that day) |

Strengths and weaknesses (M7, M8) are written as plain sentences, e.g. "You send slopey climbs 18% less often than your average." Sentences are only generated when the data passes the thresholds above.

## Architecture

- Computed **server-side in Postgres** as `security invoker` SQL functions, so RLS on `attempts` decides whose data is visible (owner, or anyone for a public logbook).
- One RPC per chart, all taking the same filter arguments:
  `metrics_<id>(p_user_id uuid, p_from date, p_to date, p_wall_id uuid default null, p_angle_min smallint default null, p_angle_max smallint default null) returns jsonb`.
- No materialized tables in V1. Per-user data is small (thousands of rows) and indexed on `(user_id, attempted_at)`. Add caching only if the performance target below is missed.
- Client: TanStack Query, one query per chart, cached for 5 minutes and invalidated when the user logs.
- Charts use `victory-native` (Skia-based). Approved 2026-10-28.

## Screens

```
app/(app)/stats/index.tsx            summary tiles + chart cards, filter bar
app/(app)/stats/[metric].tsx         full-screen chart with explanation of the definition
app/(app)/log/sessions/[date].tsx    session recap card (M11) at the top
app/(app)/profile/[username].tsx     "Stats" tab when the logbook is public
```

- Every chart has an empty state explaining what's needed to show it (e.g. "Log sends at 3+ grades to see your pyramid").
- Every chart's ⓘ button shows its definition from the table above, in plain language.

### Row Level Security

No new tables. Functions run as the caller, so `attempts` and `sessions` RLS apply automatically. A private logbook returns empty results to everyone except its owner.

## Acceptance Criteria

- [ ] Every metric M1–M11 is implemented, and returns the exact expected output for a shared fixture logbook (about 300 attempts across 3 walls, multiple angles, and typed holds).
- [ ] Thresholds (M5 ≥ 3, M7 ≥ 5, M9 ≥ 2 angles) hide data and show the empty-state explanation instead.
- [ ] The time-range, wall, and angle filters apply to every metric.
- [ ] The Stats screen fully loads in < 1.5 s for a user with 5,000 attempts on local Supabase.
- [ ] A private logbook's metrics are empty for other users and guests (proven by pgTAP).
- [ ] Every session (day) shows a recap that updates live during the day and correctly flags new personal bests.
- [ ] Previous-period comparisons on the summary tiles are correct for every time range.
- [ ] Charts render correctly in light and dark mode on both platforms.

## Testing

- **pgTAP:** each `metrics_*` function against the fixture logbook with hand-computed expected JSON; filter combinations; private-logbook visibility; deleted attempts excluded.
- **Jest:** chart data transforms and strength/weakness sentence generation from fixture JSON.
- **Performance:** seed script generating 5,000 attempts; time the Stats screen's RPCs (`explain analyze` captured in the PR).
- **Maestro:** log attempts and a send → open today's session → recap shows them → open Stats → pyramid shows the send.

## Out of Scope

- Training plans or recommendations ("do these 3 climbs"). That's a candidate for `ai-setting`.
- Comparing with friends or leaderboards (could be added to `social` or `gym-tools`).
- Exporting data.
- Wearables or heart-rate integration.

## Decisions

- `victory-native` for charts; previous-period comparisons on M1 sends and climbing days. (Resolved 2026-10-28.)
