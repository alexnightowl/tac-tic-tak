# apps/backend: rules for coding agents

NestJS 10 + Prisma 5 + Redis (ioredis). Serves the live web at tactictak.online and, from Phase 3,
the mobile app. **Every push to `main` deploys to prod and runs `prisma migrate deploy` on
container start**, so a bad migration or a breaking response shape hits real users immediately.
Root rules: `/CLAUDE.md`. Planned changes B0–B18: `docs/mobile/PLAN.md` §4. Route-by-route
reference: `docs/mobile/inventory/backend.md`.

## Where changes happen

- Branch `api/<topic>` cut from `main` (in its own worktree), one small PR per change into `main`.
  Only the owner merges. Never commit or push to `main`.
- The PR body has a **"web impact"** statement and a **prod verification checklist** (GET-only
  smoke with a throwaway account, `curl https://tactictak.online/api/health` once B2 exists).
- Before the first migration deploy the owner takes a `pg_dump`; say so in the PR.

## Contract rules

- **Additive only**: nullable or defaulted columns, new tables, optional DTO fields, new response
  fields, new routes. Never rename or remove a field the web reads, never tighten a validator the
  web hits, never change a status code the web depends on. The documented exceptions (PLAN §4):
  B5, change-password's wrong current password goes 401 → 403 (a deliberate web bug fix); B2,
  Prisma P2025 becomes 404 where it was a 500.
- `/api/x` and `/api/v1/x` are the **same handler** (after B2). Mobile-only behaviour is keyed on
  an optional DTO field such as `client: 'mobile'`, never on the path. `ValidationPipe({whitelist:
  true})` drops unknown fields, so the web is unaffected by new optional fields; do not add
  `forbidNonWhitelisted`.
- Rules changes that alter outcomes for web users (B7 sweeper, B8 `startPuzzleRating`) are gated on
  the owner's answer in `docs/mobile/OWNER-QUESTIONS.md` and land as separate commits with
  before/after fixtures.

## Migrations

- Additive migrations only. **Never edit, rename or delete an applied migration** in
  `prisma/migrations/*`; fix forward with a new one.
- Create with `pnpm --filter backend exec prisma migrate dev --create-only --name <name>`, read the
  generated SQL, then apply locally. Local DB only (Postgres on host port 5433).
- No data-destroying statements (`DROP COLUMN`, `DROP TABLE`, type narrowing) until Phase 12 (B18).

## Tests

- There is **no test runner today**. B0 adds jest + supertest e2e against the local docker
  Postgres 5433 / Redis 6380 (`pnpm --filter backend test:e2e`), a web-contract golden test and
  `tools/contract/legacy-smoke.ts` (replays every web request shape against `main` and the branch,
  diffs status codes and response keys).
- Once B0 exists, **the golden test and the legacy smoke are required green on every PR**. Before
  that, run the local web (`pnpm --filter frontend dev`) against the branch and smoke login, a
  1-min session, finish and a settings save. Do not run `next build` in `apps/frontend`.
- Auth changes (refresh, logout, `tv`, change-password) need e2e coverage.
- Every new endpoint gets an e2e test.

## Rule files are mirrored in core

`src/sessions/{unlock,rating,streak}.ts` have zero imports and are copied verbatim into
`packages/core/src/rules` (the backend does not import `@tac/core` until Phase 12, since the
Dockerfile does not copy `packages/`). `packages/core/test/parity.test.ts` imports the backend files
directly and compares them with the core copies on >10k seeded inputs. **A change to any of these
files must update the core copy in the same PR** and keep `pnpm --filter @tac/core test` green.

## Do not touch

`apps/backend/Dockerfile`, `docker-compose*.yml` (except B17), `deploy/` (except B12/B16/B17), the
`JWT_SECRET` handling until B2 (and confirm the VPS env has it before removing the fallback),
`.env`. Never run anything against prod.

## Commands

```bash
pnpm db:up && pnpm db:migrate          # local Postgres 5433 + Redis 6380, migrate
pnpm --filter backend dev              # http://localhost:4000/api
pnpm --filter backend typecheck
pnpm puzzles:import                    # local puzzle data from apps/backend/data
```
