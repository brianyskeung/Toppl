# Spec: toppl (project-level)

Cross-cutting decisions shared by every module. Module behavior lives in `SPEC-<module-id>.md`; the module index is [CAPABILITY-MAP.md](CAPABILITY-MAP.md).

## Objective

Reproduce the climber-facing feature set of the spray-wall app Stōkt on iOS and Android, as a **learning project** whose main new skill is integrating ML into a production backend. The flagship ML feature is **hold detection**: photograph a wall, get proposed holds, correct them. AI route-setting and beta are future goals; V1 data models leave room for them.

- **User:** the builder first; real climbers are a bonus.
- **Success:** V1 parity with Stōkt's climber experience (set, browse, send, log, social, metrics) plus hold detection that works on real wall photos, running on both platforms.
- **Constraint:** integrate existing models/services; train or fine-tune only if off-the-shelf results are clearly inadequate. Polished UI/UX is a nice-to-have.
- **Out of scope:** monetization, competitor/market research, LED hardware, custom model training, AI setting/beta (reserved), gym tools (reserved post-V1).
- **Guest access:** the app is usable read-only without an account — anyone can browse walls, climbs, and profiles. Creating or interacting (set, log, like, comment, follow, add a wall) requires an account. Every module's RLS follows this: public content readable by `anon`, all writes require `authenticated`.
- **Release:** public App Store and Google Play release is the eventual goal, so store rules apply from the start (see Store Readiness).
- **Naming:** the product is toppl. No Stōkt name, branding, screenshots, copy, or data anywhere in the app or store listings.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo (React Native) + TypeScript, Expo Router | One codebase for iOS + Android; managed native builds via EAS |
| Server state | TanStack Query | Caching/refetching for Supabase reads |
| Validation | Zod | Shared runtime validation of forms and API payloads |
| Backend | Supabase (Postgres, Auth, Storage, Row Level Security, Edge Functions) | Skip rebuilding known fullstack plumbing |
| ML service | Python 3.12 + FastAPI, managed with `uv`, deployed to managed cloud (no self-owned servers) — serverless container or serverless GPU, chosen in the `hold-detection` spike | Vision ecosystem lives in Python; isolated so models can be swapped |
| Hold detection | Existing models only (candidates: published climbing-hold detectors on Roboflow Universe, SAM 2 for outlines) — chosen in the `hold-detection` spike | Learning goal is integration, not training |
| CI | GitHub Actions | Lint, typecheck, unit, pgTAP, and ML tests on every PR |
| Package manager | pnpm workspaces (`node-linker=hoisted` for Expo compatibility) | Monorepo |

Versions: use the latest stable releases at project init; exact versions are pinned by lockfiles (`pnpm-lock.yaml`, `uv.lock`), not in this spec.

## Commands

```bash
# Install
pnpm install
cd services/ml && uv sync

# Local backend (Docker required)
supabase start
supabase db reset                 # re-apply migrations + seed
supabase gen types typescript --local > apps/mobile/src/lib/database.types.ts

# Mobile
pnpm --filter mobile start        # Expo dev server
pnpm --filter mobile test         # Jest (jest-expo)
pnpm --filter mobile lint         # ESLint
pnpm --filter mobile typecheck    # tsc --noEmit
eas build --profile development --platform all

# ML service
cd services/ml && uv run fastapi dev app/main.py
cd services/ml && uv run pytest
cd services/ml && uv run ruff check . && uv run ruff format --check .

# Database tests
supabase test db                  # pgTAP, incl. RLS policies

# E2E
maestro test apps/mobile/e2e
```

## Project Structure

```
apps/mobile/                 Expo app
  app/                       Expo Router routes (screens only, thin)
  src/features/<module-id>/  Feature code per module: api.ts, hooks.ts, schemas.ts, components/
  src/lib/                   Supabase client, generated DB types, shared utils
  src/ui/                    Shared presentational components / theme
  e2e/                       Maestro flows
services/ml/                 FastAPI hold-detection service
  app/                       API + model adapters
  tests/
supabase/
  migrations/                SQL migrations (one per change, never edited after merge)
  functions/                 Edge Functions
  tests/                     pgTAP tests
  seed.sql                   Local dev seed data
docs/                        ADRs and notes
CAPABILITY-MAP.md, SPEC.md, SPEC-<module-id>.md
```

Feature folders under `src/features/` use the capability-map module ids exactly.

## Code Style

```ts
// src/features/identity/api.ts
import { supabase } from '@/lib/supabase';
import { profileUpdateSchema, type ProfileUpdate } from './schemas';

export async function updateProfile(userId: string, input: ProfileUpdate) {
  const values = profileUpdateSchema.parse(input);
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- TypeScript `strict`; no `any` without a comment explaining why.
- Files `kebab-case.ts`, components `PascalCase.tsx`, hooks `useThing`.
- DB: `snake_case` tables/columns, plural table names, `uuid` primary keys, `created_at`/`updated_at` on every table.
- Screens in `app/` only compose feature hooks/components; data access lives in `features/<id>/api.ts`.
- Python: ruff defaults, type hints on public functions, Pydantic models for request/response.
- Prettier/ruff formatting is not up for debate in review.

## Testing Strategy

| Level | Tool | Covers |
|---|---|---|
| Unit | Jest (mobile), pytest (ML) | Pure logic: schemas, grade conversion, metric calculations, model-output post-processing |
| Database | pgTAP via `supabase test db` | Every RLS policy (allowed + denied cases), constraints, triggers |
| Component | React Native Testing Library | Forms and non-trivial components |
| E2E | Maestro | One happy-path flow per module's primary user story |

- Business logic (grades, metrics) aims for high unit coverage; UI is covered by E2E happy paths, not snapshot tests.
- Every RLS policy ships with a pgTAP test proving both access and denial — including the `anon` (guest) role.
- GitHub Actions runs on every PR: mobile lint + typecheck + Jest, `supabase test db` (local Supabase in the runner), ML `ruff` + `pytest`. E2E (Maestro) and EAS builds run manually or on release branches.

## Store Readiness (required before public release)

- In-app account deletion (`identity`).
- User-generated content safeguards — report content, block users, and a way to remove reported content (`social`).
- Privacy policy URL and accurate privacy labels (App Store) / Data safety form (Play).
- Sign in with Apple offered alongside Google (`identity`).
- CAPTCHA / rate limiting on username-password sign-up (`identity`).

## Boundaries

- **Always:** run lint, typecheck, and tests before committing; write a migration for every schema change; enable RLS on every new table; validate inputs with Zod/Pydantic; keep module code inside its feature folder.
- **Ask first:** schema changes that alter existing columns; adding dependencies; changing the hold-detection model or provider; anything touching auth config; changing CI.
- **Never:** commit secrets or `.env` files; disable RLS; use the Supabase service-role key in the mobile app; edit a merged migration; use Stōkt's name, assets, or data; delete failing tests to get green.

## Success Criteria (V1)

- [ ] Every module in CAPABILITY-MAP.md (V1 rows) has an approved spec and meets its acceptance criteria.
- [ ] App runs on a physical iOS device and a physical Android device from EAS development builds.
- [ ] A new user can: sign up → add a wall from a photo → accept/correct detected holds → set a climb → log attempts and a send → see it in metrics and in a follower's feed.
- [ ] Hold detection meets the target defined in `SPEC-hold-detection.md`.
- [ ] All tests pass locally; every RLS policy has a pgTAP test.

## Open Questions

- ML service cloud target (e.g. Google Cloud Run, Modal, Fly.io) vs calling a hosted inference API from the FastAPI service — decided in the `hold-detection` spike, weighing cold-start latency and cost at hobby scale.
- Remote GitHub repository name/visibility — needed before CI can run.
