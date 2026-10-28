# Tasks: identity (+ project foundation)

Plan: [plan.md](plan.md) · Spec: [SPEC-identity.md](../SPEC-identity.md)

Standard checks referenced below:
- **Mobile checks:** `pnpm --filter mobile lint && pnpm --filter mobile typecheck && pnpm --filter mobile test`
- **DB checks:** `supabase db reset && supabase test db`
- **Function checks:** `deno test supabase/functions --allow-env --allow-net`

---

## Phase 0: Foundation

### Task 1: Monorepo and Expo app scaffold

**Description:** Create the pnpm workspace and an Expo app (TypeScript strict, Expo Router) that boots to a placeholder home screen on iOS and Android, with ESLint, Prettier and Jest configured.

**Acceptance criteria:**
- [ ] `pnpm install` at the root succeeds; `.npmrc` sets `node-linker=hoisted`
- [ ] `pnpm --filter mobile start` opens the placeholder screen on iOS simulator and Android emulator
- [ ] Lint, typecheck and a sample Jest test all pass; `@/` path alias resolves

**Verification:**
- [ ] Mobile checks pass
- [ ] Manual: app boots on both platforms

**Dependencies:** None

**Files likely touched:** `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.gitignore`, `apps/mobile/{package.json,app.json,tsconfig.json,eslint.config.js,jest.config.js}`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`

**Estimated scope:** M (scaffold-generated files plus config)

### Task 2: Local Supabase and app client

**Description:** Initialize Supabase locally and connect the app to it with a typed client that persists sessions in `expo-secure-store`. Add `.env.example` and the type-generation command.

**Acceptance criteria:**
- [ ] `supabase start` runs; `supabase db reset` applies cleanly (no migrations yet)
- [ ] `apps/mobile/src/lib/supabase.ts` creates a client from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` with secure-store session storage
- [ ] A trivial pgTAP test exists and `supabase test db` passes

**Verification:**
- [ ] DB checks pass; mobile checks pass
- [ ] Manual: app logs a successful `supabase.auth.getSession()` call against local Supabase

**Dependencies:** Task 1

**Files likely touched:** `supabase/config.toml`, `supabase/tests/00_smoke.test.sql`, `apps/mobile/src/lib/supabase.ts`, `apps/mobile/.env.example`, `apps/mobile/src/lib/database.types.ts`

**Estimated scope:** M

### Task 3: GitHub Actions CI

**Description:** Add a workflow that runs on every pull request: mobile lint, typecheck and Jest, plus `supabase test db` against Supabase started in the runner.

**Acceptance criteria:**
- [ ] Workflow runs on `pull_request` and pushes to `main`
- [ ] A failing lint or failing test fails the run
- [ ] Run finishes in under 10 minutes

**Verification:**
- [ ] Open a test PR; CI green. Push a deliberately failing test; CI red. Revert.

**Dependencies:** Tasks 1, 2 · **Needs:** GitHub repository created

**Files likely touched:** `.github/workflows/ci.yml`

**Estimated scope:** S

## Checkpoint A: Foundation
- [ ] App boots on iOS simulator and Android emulator
- [ ] CI green on a PR
- [ ] Review with human before proceeding

---

## Phase 1: Guest browsing

### Task 4: Identity schema, RLS, and pgTAP tests

**Description:** One migration creating `grade_system`, `profiles`, `profile_private`, `username_logins` (with `auth_email`), `auth_attempts` (server-only, for rate limiting), the `updated_at` trigger, and the `avatars` storage bucket with policies, plus seed data for two profiles.

**Acceptance criteria:**
- [ ] Tables and constraints match SPEC-identity.md; RLS is enabled on every table
- [ ] pgTAP proves, for `anon`, the owner, and another user: `anon` can read `profiles` but not write it; `profile_private` is owner-only; `username_logins` and `auth_attempts` are unreadable by clients; username format and case-insensitive uniqueness hold; cascades on delete
- [ ] Generated TypeScript types are regenerated and committed

**Verification:**
- [ ] DB checks pass

**Dependencies:** Task 2

**Files likely touched:** `supabase/migrations/<ts>_identity.sql`, `supabase/tests/identity_rls.test.sql`, `supabase/seed.sql`, `apps/mobile/src/lib/database.types.ts`

**Estimated scope:** M

### Task 5: Guest app shell and public profile screen

**Description:** With no session, the app opens into the main `(app)` layout in guest mode, with a "Sign in" entry point. `profile/[username]` shows a public profile (display name, username, avatar, bio) fetched as `anon`.

**Acceptance criteria:**
- [ ] Fresh install with no session lands in `(app)`, not on a login wall
- [ ] Navigating to a seeded profile renders its data; an unknown username shows a "not found" state
- [ ] Profile fetching lives in `src/features/identity/api.ts` with a TanStack Query hook

**Verification:**
- [ ] Mobile checks pass (hook unit test with mocked client)
- [ ] Manual: as guest, open seeded profile on both platforms

**Dependencies:** Task 4

**Files likely touched:** `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/app/(app)/profile/[username].tsx`, `apps/mobile/src/features/identity/{api.ts,hooks.ts}`, `apps/mobile/src/lib/query-client.ts`

**Estimated scope:** M

---

## Phase 2: Username/password accounts

### Task 6: `sign-up-username` Edge Function

**Description:** Validates username and password, checks availability, enforces the rate limit, creates a pre-confirmed auth user with email `<uuid>@users.toppl.invalid`, and inserts the `profiles` and `username_logins` rows atomically. Returns success without exposing the placeholder email.

**Acceptance criteria:**
- [ ] Valid input creates the auth user, profile and login mapping; partial failure rolls back (no orphaned auth user)
- [ ] Invalid or taken usernames and weak passwords (< 8 chars) return 400 with a field-specific message; exceeding the rate limit returns 429
- [ ] The response body never contains the placeholder email

**Verification:**
- [ ] Function checks pass (Deno tests against local Supabase)

**Dependencies:** Task 4

**Files likely touched:** `supabase/functions/sign-up-username/index.ts`, `supabase/functions/sign-up-username/index.test.ts`, `supabase/functions/_shared/{validation.ts,rate-limit.ts}`

**Estimated scope:** M

### Task 7: `sign-in-username` Edge Function

**Description:** Looks up the auth email for a username, signs in with the password, and returns the session tokens. Rate-limited, with a generic error for any failure.

**Acceptance criteria:**
- [ ] Correct credentials return a valid session usable by the Supabase client
- [ ] Wrong password and unknown username return the identical generic 401 error; rate limit returns 429
- [ ] Neither the response nor the logs contain the auth email

**Verification:**
- [ ] Function checks pass

**Dependencies:** Task 6 (shares `_shared/` helpers)

**Files likely touched:** `supabase/functions/sign-in-username/index.ts`, `supabase/functions/sign-in-username/index.test.ts`

**Estimated scope:** S

### Task 8: Username auth screens and session persistence

**Description:** `(auth)/welcome` and `(auth)/username` screens for sign-up and sign-in that call the two Edge Functions and set the session on the Supabase client. Sign-out returns to guest mode. Sign-up explains that without a recovery email, a forgotten password can't be recovered.

**Acceptance criteria:**
- [ ] Sign up then sign in works on both platforms; inline field errors come from Zod plus server messages
- [ ] Session survives killing and relaunching the app
- [ ] A temporary sign-out button (moved to settings in Task 17) returns to guest mode

**Verification:**
- [ ] Mobile checks pass (Zod schema tests for username and password)
- [ ] Manual: sign up, kill the app, relaunch, still signed in, sign out

**Dependencies:** Tasks 5, 7

**Files likely touched:** `apps/mobile/app/(auth)/{_layout.tsx,welcome.tsx,username.tsx}`, `apps/mobile/src/features/identity/{schemas.ts,auth.ts,session.tsx}`

**Estimated scope:** M

### Task 9: Auth gate (`useRequireAuth`) and auth sheet

**Description:** A hook that wraps any write action: signed in → run the action; guest → open the welcome screen as a sheet, then return to where the user was after signing in. Wire it to one placeholder action (a "Follow" button on profiles that's a no-op until `social`).

**Acceptance criteria:**
- [ ] A guest tapping the gated button sees the auth sheet; nothing executes
- [ ] After signing in from the sheet, the user returns to the same screen
- [ ] A signed-in user tapping the button runs the action without the sheet

**Verification:**
- [ ] Mobile checks pass (hook test with signed-in and guest states)
- [ ] Maestro: `e2e/guest-to-account.yaml` covers guest browse → gated tap → sign up → sign out → sign in

**Dependencies:** Task 8

**Files likely touched:** `apps/mobile/src/features/identity/use-require-auth.ts`, `apps/mobile/app/(app)/profile/[username].tsx`, `apps/mobile/e2e/guest-to-account.yaml`

**Estimated scope:** S

## Checkpoint B: Accounts work end to end
- [ ] All checks pass; CI green
- [ ] Maestro `guest-to-account` flow green on iOS and Android
- [ ] Review with human before proceeding

---

## Phase 3: Onboarding and profile

### Task 10: Onboarding route guard and grade-system screen

**Description:** Signed-in users whose profile is missing or has `onboarded_at is null` are routed to `(onboarding)/profile`, which asks for grade system (required) and display name (optional), then sets `onboarded_at`.

**Acceptance criteria:**
- [ ] A new username account goes from sign-up → onboarding → main app
- [ ] Onboarding can't be skipped: relaunching mid-onboarding returns to it
- [ ] Onboarded users never see onboarding again

**Verification:**
- [ ] Mobile checks pass (route-decision function unit-tested for each state)
- [ ] Manual: new account flow on one platform

**Dependencies:** Task 8

**Files likely touched:** `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(onboarding)/{_layout.tsx,profile.tsx}`, `apps/mobile/src/features/identity/route-state.ts`

**Estimated scope:** M

### Task 11: Edit profile screen

**Description:** `settings/profile` edits display name, bio and grade system, with Zod validation; changes show up on the public profile.

**Acceptance criteria:**
- [ ] Edits persist and appear on the public profile, including when viewed as a guest
- [ ] Over-length display name or bio is blocked client-side, and by DB constraints if bypassed

**Verification:**
- [ ] Mobile checks pass (schema tests and a component test for the form)

**Dependencies:** Task 10

**Files likely touched:** `apps/mobile/app/(app)/settings/profile.tsx`, `apps/mobile/src/features/identity/{api.ts,schemas.ts}`, `apps/mobile/src/features/identity/components/ProfileForm.tsx`

**Estimated scope:** M

### Task 12: Avatar upload

**Description:** Pick an image, resize it client-side to ≤ 512px, upload it to `avatars/<uid>/`, save `avatar_path`, and render it on profiles.

**Acceptance criteria:**
- [ ] Uploaded avatar shows on own and public profile; replacing it removes the old file
- [ ] Uploaded file's longest edge is ≤ 512px
- [ ] Uploading to another user's folder is rejected (covered by Task 4's storage policy tests)

**Verification:**
- [ ] Mobile checks pass
- [ ] Manual: upload from photo library on both platforms

**Dependencies:** Task 11

**Files likely touched:** `apps/mobile/src/features/identity/{avatar.ts,components/AvatarPicker.tsx}`, `apps/mobile/app/(app)/settings/profile.tsx`

**Estimated scope:** S

### Task 13: Private body measurements screen

**Description:** `settings/body` edits height and ape index in `profile_private` (upserted), and is visible only to the owner.

**Acceptance criteria:**
- [ ] Values persist and reload; out-of-range values are rejected
- [ ] Values never appear on any public profile view

**Verification:**
- [ ] Mobile checks pass (schema tests); RLS already covered by Task 4

**Dependencies:** Task 10

**Files likely touched:** `apps/mobile/app/(app)/settings/body.tsx`, `apps/mobile/src/features/identity/{api.ts,schemas.ts}`

**Estimated scope:** S

## Checkpoint C: Profile complete
- [ ] All checks pass; CI green
- [ ] Profile-related acceptance criteria in SPEC-identity.md checked
- [ ] Review with human before proceeding

---

## Phase 4: Other sign-in methods

### Task 14: Username step in onboarding (for Apple/Google users)

**Description:** Users who signed in without choosing a username (Apple, Google) have no `profiles` row yet. Onboarding gains a first step to choose an available username, which creates the profile, before the grade-system step. Username/password accounts skip it.

**Acceptance criteria:**
- [ ] A signed-in user with no profile must choose an available, valid username before reaching the grade-system step
- [ ] Taken usernames (case-insensitive) show an inline error
- [ ] Username/password accounts never see this step

**Verification:**
- [ ] Mobile checks pass (route-decision tests for the "no profile" state; component test for the username step)
- [ ] Manual: create a profile-less auth user in Supabase Studio, sign in as it, complete onboarding

**Dependencies:** Task 10

**Files likely touched:** `apps/mobile/app/(onboarding)/{profile.tsx,username.tsx}`, `apps/mobile/src/features/identity/{route-state.ts,api.ts}`

**Estimated scope:** S

### Task 15: Sign in with Apple

**Description:** Native Apple sign-in via `expo-apple-authentication` → `supabase.auth.signInWithIdToken`, shown on iOS only; new users continue to the username onboarding step.

**Acceptance criteria:**
- [ ] New and returning Apple users can sign in on a physical iPhone (EAS development build)
- [ ] Button hidden on Android

**Verification:**
- [ ] Mobile checks pass
- [ ] Manual: physical iOS device

**Dependencies:** Task 14 · **Needs:** Apple Developer membership, EAS account, Supabase Apple provider configured

**Files likely touched:** `apps/mobile/app.json`, `apps/mobile/eas.json`, `apps/mobile/src/features/identity/auth.ts`, `apps/mobile/app/(auth)/welcome.tsx`, `supabase/config.toml`

**Estimated scope:** S

### Task 16: Google sign-in

**Description:** Native Google sign-in (`@react-native-google-signin/google-signin`) → `signInWithIdToken` on both platforms; new users continue to the username onboarding step.

**Acceptance criteria:**
- [ ] New and returning Google users can sign in on physical iOS and Android devices
- [ ] Cancelling the Google dialog returns to the welcome screen without an error

**Verification:**
- [ ] Mobile checks pass
- [ ] Manual: physical iOS and Android devices

**Dependencies:** Task 14 · **Needs:** Google Cloud OAuth clients, EAS account, Supabase Google provider configured

**Files likely touched:** `apps/mobile/app.json`, `apps/mobile/src/features/identity/auth.ts`, `apps/mobile/app/(auth)/welcome.tsx`, `supabase/config.toml`

**Estimated scope:** S

---

## Phase 5: Account management

### Task 17: Change password, recovery email, and password reset

**Description:** `settings/account`: change password; add a recovery email via `auth.updateUser({ email })` (once confirmed it becomes the auth email, and a trigger on `auth.users` updates `username_logins.auth_email`); and "Forgot password?" on the username sign-in screen, backed by a `request-password-reset` Edge Function. Sign-out moves here.

**Acceptance criteria:**
- [ ] Change password works; the old password stops working
- [ ] After confirming a recovery email, "Forgot password?" sends a reset to it and the user can set a new password
- [ ] `request-password-reset` returns the same response for unknown usernames, accounts without a recovery email, and valid ones; the user can still sign in with their username after adding a recovery email

**Verification:**
- [ ] DB checks pass (pgTAP for the `auth.users` trigger); function checks pass
- [ ] Manual: full reset flow locally, reading emails from the local mail catcher (Mailpit/Inbucket)

**Dependencies:** Tasks 8, 10

**Files likely touched:** `apps/mobile/app/(app)/settings/account.tsx`, `apps/mobile/app/(auth)/username.tsx`, `supabase/functions/request-password-reset/{index.ts,index.test.ts}`, `supabase/migrations/<ts>_identity_auth_email_sync.sql`, `supabase/tests/identity_auth_email.test.sql`

**Estimated scope:** M

### Task 18: Account deletion

**Description:** `delete-account` Edge Function (verifies the caller's JWT, removes avatar files, deletes the auth user, and the related rows cascade), plus a confirmation UI in `settings/account` where the user types their username.

**Acceptance criteria:**
- [ ] Deletion removes the auth user, profile, private data, login mapping and avatar files
- [ ] The username is immediately available for a new sign-up
- [ ] Calling the function without a valid JWT returns 401; it can only delete the caller

**Verification:**
- [ ] Function checks pass; DB checks pass
- [ ] Maestro: `e2e/delete-account.yaml`

**Dependencies:** Task 17

**Files likely touched:** `supabase/functions/delete-account/{index.ts,index.test.ts}`, `apps/mobile/app/(app)/settings/account.tsx`, `apps/mobile/e2e/delete-account.yaml`

**Estimated scope:** M

## Checkpoint D: identity complete
- [ ] Every acceptance criterion in SPEC-identity.md checked
- [ ] All checks pass; CI green; all Maestro flows green on both platforms
- [ ] Manual Apple and Google sign-in verified on physical devices
- [ ] CAPABILITY-MAP.md updated (identity ✅); review with human before starting the `walls` spec
