# Capability Map: toppl V1

Approved 2026-10-28. Module ids are stable — never rename them. Each module gets its own `SPEC-<module-id>.md` at the repo root; this map is the index of what exists.

| Module id | Responsibility | Depends on | Spec |
|---|---|---|---|
| `identity` | Auth (sign up / in / out), profiles, preferred grade system, account deletion | — | [SPEC-identity.md](SPEC-identity.md) |
| `walls` | Gym & home walls, wall photo upload, hold geometry (normalized position, polygon, type), wall angle(s), manual hold editing | identity | [SPEC-walls.md](SPEC-walls.md) |
| `hold-detection` | Python ML service: wall photo → proposed holds; records user corrections | walls | [SPEC-hold-detection.md](SPEC-hold-detection.md) |
| `climbs` | Set climbs (holds + start/finish/foot roles, grade, style tags), grade-system conversion, browse/filter, public/private lists | walls | [SPEC-climbs.md](SPEC-climbs.md) |
| `logbook` | Attempts, sends, sessions, grade votes (split grades allowed), per-climb grade history | climbs | [SPEC-logbook.md](SPEC-logbook.md) |
| `metrics` | Grade pyramid, volume over time, flash rate, attempts-to-send, style/hold-type strengths, progression | logbook | [SPEC-metrics.md](SPEC-metrics.md) |
| `social` | Follows, likes, comments, activity feed | identity, walls, climbs, logbook | [SPEC-social.md](SPEC-social.md) |
| `notifications` | Push notifications for likes, comments, new climbs on followed walls | social | [SPEC-notifications.md](SPEC-notifications.md) |

**Build order:** `identity` → `walls` (manual holds) → `hold-detection` → `climbs` → `logbook` → `metrics` ∥ `social` → `notifications`

`hold-detection` comes early because it is the primary learning goal and the riskiest piece. Manual hold editing in `walls` is the permanent fallback, so nothing downstream is blocked on detection quality.

## Reserved (post-V1, no specs yet)

| Module id | Responsibility | Will depend on |
|---|---|---|
| `gym-tools` | Competitions, gym admins, official lists/benchmarks, setter analytics | walls, climbs, logbook |
| `ai-setting` | Generate climbs for a wall from grade/style constraints | walls, climbs, logbook |
| `ai-beta` | Movement/beta suggestions, possibly from attempt video | climbs, logbook |

V1 data models must not preclude these: hold geometry is normalized and typed, wall angle is recorded on climbs and attempts, every attempt (not just sends) is stored, and grade votes are kept per user.
