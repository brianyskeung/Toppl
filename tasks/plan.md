# Implementation Plan: identity (+ project foundation)

Spec: [SPEC-identity.md](../SPEC-identity.md) · Project conventions: [SPEC.md](../SPEC.md) · Module index: [CAPABILITY-MAP.md](../CAPABILITY-MAP.md)
Tasks: [todo.md](todo.md)

## Overview

`identity` is the first module, so this plan also lays the project foundation: the pnpm monorepo, the Expo app, local Supabase, and GitHub Actions CI. The work is then sliced vertically: guest browsing of profiles → username/password accounts (the riskiest custom piece) → onboarding and profile editing → the other sign-in methods → account management. Each task leaves the app runnable.

## Architecture Decisions

- **Foundation first, but minimal.** Tasks 1–3 produce only what identity needs: an app that boots, a local database the app talks to, and CI that runs the checks. No placeholder features for other modules.
- **Schema in one migration up front (Task 4).** All three identity tables and the avatars bucket land together with their row-level security (RLS) tests. Every later slice reads or writes them, and splitting one module's schema across many migrations adds churn without reducing risk.
- **Username/password before other methods.** It's the only sign-in path with custom server code (Edge Functions plus a hidden placeholder email), so it goes first. Apple and Google are standard Supabase integrations and come later.
- **Guest mode is the default state, not a special case.** No session means the normal app in read-only mode. A single `useRequireAuth()` hook gates every write action and opens the auth sheet. Later modules reuse it.
- **Rate limiting in Postgres.** Edge Functions are stateless, so sign-up and sign-in attempts are counted in a server-only `auth_attempts` table keyed by IP hash and time window. No extra infrastructure needed.
- **Recovery email becomes the auth email (approved 2026-10-28).** Supabase sends password-reset emails to the auth address, which for username accounts starts as the placeholder. When a user confirms a recovery email it replaces the placeholder, `username_logins.auth_email` follows it via trigger, and resets use Supabase's built-in flow — no extra email provider. Already reflected in SPEC-identity.md and in Task 4's schema.
- **Native builds are needed from Phase 4.** Apple and Google sign-in need EAS development builds; everything before that runs in Expo Go or a simulator.

## Task List

### Phase 0: Foundation
- [x] Task 1: Monorepo and Expo app scaffold
- [x] Task 2: Local Supabase and app client
- [x] Task 3: GitHub Actions CI

### Checkpoint A: Foundation
- [ ] App boots on iOS simulator and Android emulator; CI green on a PR

### Phase 1: Guest browsing
- [x] Task 4: Identity schema, RLS, and pgTAP tests
- [x] Task 5: Guest app shell and public profile screen

### Phase 2: Username/password accounts
- [x] Task 6: `sign-up-username` Edge Function
- [x] Task 7: `sign-in-username` Edge Function
- [x] Task 8: Username auth screens and session persistence
- [ ] Task 9: Auth gate (`useRequireAuth`) and auth sheet

### Checkpoint B: Accounts work end to end
- [ ] Maestro: guest browse → write action → sign up → sign out → sign in

### Phase 3: Onboarding and profile
- [ ] Task 10: Onboarding route guard and grade-system screen
- [ ] Task 11: Edit profile screen
- [ ] Task 12: Avatar upload
- [ ] Task 13: Private body measurements screen

### Checkpoint C: Profile complete
- [ ] All profile acceptance criteria pass; review with human

### Phase 4: Other sign-in methods
- [ ] Task 14: Username step in onboarding (for Apple/Google users)
- [ ] Task 15: Sign in with Apple
- [ ] Task 16: Google sign-in

### Phase 5: Account management
- [ ] Task 17: Change password, recovery email, and password reset
- [ ] Task 18: Account deletion

### Checkpoint D: identity complete
- [ ] Every acceptance criterion in SPEC-identity.md checked; full Maestro flow green; manual Apple/Google check on devices

### Deferred to pre-release (not part of this plan)
- CAPTCHA on username sign-up (Store Readiness in SPEC.md)

## Parallelization

- After Task 4: Task 5 (UI) and Tasks 6–7 (Edge Functions) can run in parallel. They share only the schema.
- Tasks 11, 12 and 13 are independent once Task 10 lands.
- Tasks 15 and 16 are independent of each other.
- Migrations stay sequential: only Task 4 (and Task 17's `auth.users` trigger) touches `supabase/migrations/`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| pnpm + Expo/Metro module resolution issues in a monorepo | Med | `node-linker=hoisted` from Task 1; verify both platforms boot at Checkpoint A before building on it |
| Placeholder-email approach leaks the address or breaks with Supabase changes | Med | Contained in two Edge Functions with tests asserting the email never reaches the client |
| Apple/Google sign-in needs accounts and console setup you don't have yet | Med | Placed last in sign-in work; doesn't block anything else. Prerequisites listed below |
| Running Supabase (Docker) in GitHub Actions is slow or flaky | Low | Use `supabase/setup-cli` with `supabase start` limited to the needed services; cache Docker images |

## Prerequisites (things only you can set up)

- Docker Desktop (for local Supabase), Node LTS, pnpm, Supabase CLI
- GitHub repository (name and visibility) — before Task 3
- Expo account for EAS builds — before Phase 4
- Apple Developer Program membership ($99/yr) — before Task 15
- Google Cloud project with OAuth client IDs (iOS, Android, web) — before Task 16
- A hosted Supabase project — only when you want builds that work off your local network; not needed for this plan

## Open Questions

None. Resolved 2026-10-28: recovery-email design approved; email one-time code sign-in dropped.
