# Spec: identity

Module id: `identity` · Depends on: — · Index: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Shared conventions: [SPEC.md](SPEC.md)

## Objective

Let anyone browse toppl without an account, and let a climber create an account (username + password, Apple, or Google), set up a profile, choose their preferred grade system, and delete their account. Every other module keys its data off `profiles.id`.

### User stories

1. As a guest (no account), I can open the app and view climbs and profiles. Any action that creates or interacts (set, log, like, comment, follow) prompts me to sign up.
2. As a new climber, I can sign up with **just a username and password** — no email required.
3. I can alternatively sign up with Apple or Google.
4. After sign-up I pick my preferred grade system (Hueco / Font / DanKyu), and a username if my sign-up method didn't include one.
5. I stay signed in across app restarts until I sign out.
6. I can view and edit my profile (display name, avatar, bio, grade system).
7. I can optionally record height and ape index, visible only to me (reserved for `ai-setting` / `ai-beta`).
8. As a username/password user, I can optionally add a recovery email so I can reset a forgotten password. I still sign in with my username.
9. I can delete my account from inside the app (App Store requirement).

## Auth methods

| Method | Notes |
|---|---|
| **Username + password** | No email. Implemented on Supabase Auth with a synthetic, undeliverable address `<user_id>@users.toppl.invalid` (see below). |
| **Sign in with Apple** | Required by App Store rules when other third-party logins are offered. |
| **Google sign-in** | Native Google sign-in → Supabase `signInWithIdToken`. |

Sessions persist via Supabase Auth with `expo-secure-store`.

### Username + password on Supabase

Supabase Auth requires an email or phone, so username accounts get a synthetic address the user never sees:

- **Sign-up:** Edge Function `sign-up-username` validates the username and password, checks availability, creates the auth user with email `<new uuid>@users.toppl.invalid` (pre-confirmed, server-side admin call), inserts the `profiles` row and the `username_logins` mapping, then returns. The app then signs in normally.
- **Sign-in:** Edge Function `sign-in-username` looks up the account's current auth email (`username_logins.auth_email`) for the username and calls password sign-in, returning the session. The auth email is never sent to the client.
- **Username changes** only touch `profiles.username`; the login mapping is keyed on the user id, so it never changes.
- **Recovery email:** adding one calls Supabase's email change (`auth.updateUser({ email })`), which sends a confirmation to the new address. Once confirmed, it **replaces the placeholder as the account's auth email**, and a trigger on `auth.users` updates `username_logins.auth_email`. The user keeps signing in with their username.
- **Password reset:** "Forgot password?" takes a username; Edge Function `request-password-reset` looks up the auth email and, if it is a real (non-`.invalid`) address, calls Supabase's built-in `resetPasswordForEmail`. It always returns the same response, so it never reveals whether an account or email exists. Without a recovery email, a forgotten password means a lost account — the sign-up screen says so plainly.
- **Abuse:** password sign-up and sign-in are rate-limited per IP in the Edge Functions; add CAPTCHA (Turnstile / hCaptcha, which Supabase supports) before public release.

The `.invalid` TLD is reserved and can never receive mail.

## Data Model

```sql
create type grade_system as enum ('hueco', 'font', 'dankyu');

create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      citext unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name  text check (char_length(display_name) <= 50),
  avatar_path   text,                     -- Storage path in bucket `avatars`
  bio           text check (char_length(bio) <= 280),
  grade_system  grade_system not null default 'hueco',
  onboarded_at  timestamptz,              -- null until grade system confirmed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Owner-only fields, kept in a separate table so RLS stays simple.
create table profile_private (
  id              uuid primary key references profiles (id) on delete cascade,
  height_cm       smallint check (height_cm between 100 and 250),
  ape_index_cm    smallint check (ape_index_cm between -30 and 30),
  updated_at      timestamptz not null default now()
);

-- Server-only: maps username accounts to their current auth email (the .invalid
-- placeholder, or the confirmed recovery email). No client access.
create table username_logins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  auth_email  text unique not null
);
```

- Username/password sign-up creates the profile immediately; Apple/Google sign-ups create it in onboarding (username step). "Signed in but no profile" or `onboarded_at is null` means "needs onboarding".
- Usernames are stored lowercase; uniqueness is case-insensitive.

### Row Level Security

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | **everyone, incl. `anon`** | own row only (`id = auth.uid()`) | own row only | via account deletion only |
| `profile_private` | own row only | own row only | own row only | cascades |
| `username_logins` | none (RLS on, no policies; service role only) | none | none | cascades |
| Storage `avatars` | public read | own folder `avatars/<uid>/` only | own folder only | own folder only |

Guest access pattern (applies to all modules, see SPEC.md): public content is readable by `anon`; every write requires `authenticated`.

### Account deletion

Edge Function `delete-account` (service role, server-side only): verifies the caller's JWT, deletes their avatar files, then deletes the `auth.users` row; `profiles`, `profile_private`, and `username_logins` cascade. Later modules decide per table whether user content cascades or is anonymized; each module spec must state this.

## Screens (Expo Router)

```
app/(app)/...                       main app — reachable as guest (read-only) or signed in
app/(auth)/welcome.tsx              sign-in options; also shown as a sheet when a guest tries to act
app/(auth)/username.tsx             username + password sign-up / sign-in
app/(onboarding)/profile.tsx        grade system (+ username if not yet set), display name optional
app/(app)/profile/[username].tsx    public profile
app/(app)/settings/profile.tsx      edit profile + avatar
app/(app)/settings/body.tsx         height / ape index (private)
app/(app)/settings/account.tsx      recovery email, change password, sign out, delete account
```

Route logic: no session → `(app)` in guest mode, with a "Sign in" entry point and an auth sheet on any write action; session but not onboarded → `(onboarding)`; otherwise → `(app)`.

## Acceptance Criteria

- [ ] A guest can launch the app, browse, and open any public profile without signing in.
- [ ] Every write action attempted as a guest opens the auth sheet; nothing is written.
- [ ] Sign-up with only username + password works on both platforms; no email is requested.
- [ ] Sign-in with username + password works; wrong password and unknown username both return the same generic error.
- [ ] Apple (iOS) and Google sign-in work.
- [ ] Session survives app kill and relaunch; sign-out returns to guest mode.
- [ ] Usernames that are taken (case-insensitive) or invalid are rejected with an inline message.
- [ ] A signed-in user who hasn't finished onboarding is always routed to onboarding.
- [ ] Profile edits persist and appear on the public profile, including for guests.
- [ ] Avatar upload is resized client-side to ≤ 512px, stored under `avatars/<uid>/`, and shown on the profile.
- [ ] A username/password user can add and confirm a recovery email, still sign in with their username, and use "Forgot password?" to reset their password.
- [ ] `request-password-reset` returns the same response whether or not the username exists or has a recovery email.
- [ ] `anon` can read `profiles` but cannot insert, update, or delete anything (proven by pgTAP).
- [ ] Another user's `profile_private` row cannot be read or written; `username_logins` is unreadable by `anon` and `authenticated` (proven by pgTAP).
- [ ] The auth email (placeholder or real) never appears in any Edge Function response.
- [ ] Account deletion removes auth user, profile, private data, login mapping, and avatar; the username becomes available again.

## Testing

- **pgTAP:** every RLS policy above, allowed and denied, for `anon`, owner, and another user; username check constraint; cascades on delete.
- **Deno tests** (Edge Functions): `sign-up-username`, `sign-in-username`, `request-password-reset` — validation, duplicate username, generic errors, rate limit, auth email never returned.
- **Jest:** Zod schemas for username, password, display name, bio, body measurements.
- **Maestro:** guest browse → tap a write action → username sign-up → onboarding → edit profile → sign out → sign back in.
- **Manual:** Apple and Google sign-in on physical devices.

## Out of Scope

- Email one-time code sign-in (dropped 2026-10-28), phone/SMS auth, MFA.
- Following, blocking, reporting users (`social` — blocking and reporting are required before public release).
- Push notification tokens (`notifications`).
- Gym admin roles (`gym-tools`, reserved).
