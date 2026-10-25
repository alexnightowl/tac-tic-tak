# B0: backend test harness, web-contract golden, rating transcript, legacy smoke

Branch: `api/test-harness` (cut from `origin/main` b25dbd3). Plan item B0 (`docs/mobile/PLAN.md` §4, §2.11).

## What and why

Every later backend PR for the mobile app (B2–B11) must prove that the live web is unaffected.
This PR adds the tooling for that proof and changes no runtime behaviour.

- **jest + ts-jest + supertest** in `apps/backend`, in two projects:
  - `unit`: pure rule functions, no IO.
  - `e2e`: boots the real `AppModule` in-process over supertest. It runs against the local docker
    Postgres DB **`taktic_test`** (:5433) and Redis **db index 1** (:6380).
  - Scripts: `test` (both), `test:unit`, `test:e2e`, `typecheck:test`. All run with `--ci`, so a
    missing snapshot fails instead of being written silently.
- **Harness setup**:
  - `globalSetup` runs `prisma migrate deploy` on the test DB, the same command prod runs on start.
  - Each spec file calls `resetDatabase()`. It TRUNCATEs every table except `_prisma_migrations`,
    FLUSHDBs only the test Redis index, then re-inserts the puzzle fixture.
  - Guards in `test/test-env.ts` refuse to run against a non-local host, a DB whose name does not
    end in `_test`, or Redis index 0. Unit tests cover these guards.
- **Fixtures and seed helpers**:
  - `test/fixtures/puzzles.json` holds 30 real Lichess puzzles copied from the dev DB: ratings
    1088–1361, 7 tagged `fork`. All pass the buffer's popularity/plays filters, so the real
    selector serves them.
  - `test/helpers/seed.ts`: `createUser` (mirrors register), `tokenFor`, `createFinishedSession`,
    `createReviewItem`, `createFriendship`, `primeQueue` (a fixed `/next` order through the Redis
    buffer) and `backdateSession` (makes finish count as full duration).
- **Golden tests**:
  1. `test/unit/rules.golden.spec.ts` covers the rating step, `deriveSessionStats`,
     `solvedTarget`, unlock, demote, calibration, streak and `isValidDay`. Inputs are edge cases
     plus a seeded sweep (about 600 cases), each one snapshot line `[input, output]`. The constants
     are snapshotted too.
  2. `test/e2e/web-contract.e2e-spec.ts` replays **117 requests**, every request shape that
     `apps/frontend/src` sends: register/login/me, `/users/me`, settings, profile, avatar,
     change-password, sessions (create/next/attempt/finish in the full, early, theme and discard
     variants)/detail/review-items/delete, puzzle viewer, review list/themes/puzzle/resolve, every
     analytics route, leaderboard, search, friends, public profile, achievements, reset-progress
     and admin. It also replays the main 4xx paths. For each request it snapshots the status code,
     the response **shape** (keys and value kinds, no volatile values) and the error `message`,
     which the web renders verbatim. It also asserts:
     - login returns exactly `{token, user:{id,nickname}}`;
     - the JWT is HS256 with payload keys `exp, iat, nickname, sub` and `exp - iat = 7 days`;
     - unknown body fields are stripped, not rejected with 400;
     - `/uploads/avatars/*` is served statically;
     - CORS stays `*`.
  3. `test/e2e/rating-transcript.e2e-spec.ts` runs scripted sessions with fixed puzzles (primed
     through the buffer) and fixed answers. It snapshots each attempt's
     `{puzzle@rating, servedAt, step, newRating, streak}`, the full finish payload and the
     progression before/after. There are 11 scenarios:
     - calibration strong;
     - calibration weak (floor clamp);
     - calibration ignores the client's `startRating`;
     - stable unlock +50;
     - stable second weak session demotes −25;
     - demote clamped by `startPuzzleRating` (the **B8 baseline**);
     - comfort-zone weak session;
     - early exit;
     - discard rollback;
     - theme session (unrated);
     - a 9-day streak walk (started / same-day / continued / frozen / reset / regen / bad date).
- **`tools/contract/legacy-smoke.ts`** (`pnpm --filter backend contract:smoke -- …`) runs the same
  scenario with `fetch` against two running local servers and diffs them step by step. It refuses
  non-local hosts. With `--db` and `--redis` it primes the puzzle queues identically on both
  servers and deletes its throwaway users afterwards.
- **`seed-test-sessions.ts` is parameterised**: `pnpm --filter backend seed:test-sessions
  <nickname> [count] [--style bullet|blitz|rapid|any]`. It used to be hard-coded to
  `lazynightowl` with 20 sessions and never set `style` (every row defaulted to blitz). It now
  writes `style`, uses per-style duration presets and refuses non-local databases.
- **The only production code change** is that `src/main.ts`'s app construction moved verbatim into
  `src/app.setup.ts` as `createApp()`: global prefix, ValidationPipe, the 6 MB JSON limit, static
  uploads and `cors: true`. `main.ts` calls `createApp()` and then `listen(PORT)` as before. The
  tests boot through the same function, so they exercise the exact production pipeline.

## WEB IMPACT

**None.** The runtime API is unchanged:
- `createApp()` does the same calls in the same order with the same options.
- Nothing else in `src/` changed except the dev-only seed script.
- No migration, DTO change or new route.

Proof: I started a server built from pristine `origin/main` (:4100) and one built from this
branch (:4101), both on `taktic_test`, and ran the legacy smoke between them. It reported
**identical status codes, shapes and messages on all 117 steps, three runs in a row.** The step
list recorded from the `origin/main` server is also **identical to this branch's committed golden
snapshot** (117/117, 0 diffs). So the snapshot freezes what prod serves today, not something this
branch introduced.

Build/deploy note: the backend Dockerfile's deps stage copies only `package.json`, without the
lockfile, and installs dev dependencies. The image build therefore also installs jest, ts-jest and
supertest (about 200 extra packages, resolved from the same `^` ranges). Nothing loads them at
runtime. Compile output is unchanged: `dist/` still holds only `src/`, and `test/` is outside
`tsconfig.include`. No Dockerfile, compose or workflow file is touched.

## How it was tested

- `pnpm --filter backend exec prisma generate && pnpm --filter backend typecheck && pnpm --filter backend build`: pass.
- `pnpm --filter frontend typecheck` and `pnpm -r run typecheck`: pass.
- `pnpm --filter backend typecheck:test`: pass (type pass over `test/` and `tools/contract/`).
- `pnpm --filter backend test`: **5 suites, 29 tests, 20 snapshots, all green**. The e2e project
  ran 5+ times in a row with no flake.
- The legacy smoke compared `origin/main` with the branch as described above.
- The seed script was run against `taktic_test`:
  - `webA 3 --style rapid` wrote 3 rapid sessions;
  - a bad `--style` is rejected;
  - a remote `DATABASE_URL` is refused.

## Prod verification checklist (after merge + deploy)

- [ ] The GitHub Actions deploy job is green (the image build installs the extra dev deps).
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://tactictak.online/api/auth/me` returns `401`
      (the API is up; `/api/health` arrives with B2).
- [ ] Web spot-check with a throwaway account: log in, play a 1-min session, finish it, save a
      setting.
- [ ] `docker compose logs backend` shows `API listening on :4000` and no new errors.

## Rollback

Revert the merge commit. There is no data, migration or env change, so the revert is risk-free.

## Provisional decisions (owner may override)

- **jest 29 + ts-jest** (transpile-only; types are checked by `typecheck:test`) rather than
  `@swc/jest`. These are the most common Nest pairing and need no extra native binary.
- **`test` runs unit and e2e**, so it needs the docker Postgres and Redis. When B1 adds
  `pnpm -r --if-present run test` to CI, it must either start the Postgres and Redis services and
  create `taktic_test`, or call `test:unit` for the backend.
- **Snapshots are the golden format** (`__snapshots__/*.snap`) and the scripts use `--ci`. An
  intentional change (B5's 401→403, B8) is updated with `jest --ci=false -u <spec>`, and the
  snapshot diff goes in that PR.
- **The web contract freezes today's quirks** on purpose, for example: change-password with a
  wrong current password returns 401 (until B5); a deleted user's token gets 404 on `/users/me`;
  `POST /friends/:id/accept` returns 400 when the request is already accepted.
- `seed:e2e` (the Maestro users `e2e_fresh` …) is **not** in this PR. It belongs to the mobile
  e2e work and can reuse `test/helpers/seed.ts`.
- The fixture holds Lichess puzzle data (CC0).

## Owner actions

- Before/after merge: nothing. No env vars, no `pg_dump` (no migration).
- Local: `taktic_test` must exist on :5433 (it already does on the dev Mac). Elsewhere, run
  `createdb -h localhost -p 5433 -U taktic taktic_test`.
- Merge order: merge this **first**. B2–B11 rely on `test:e2e`, the golden snapshot and the
  legacy smoke being on `main`. After merging, merge `main` into `mobile`. The `mobile` branch's
  `apps/backend/CLAUDE.md` still says "no test runner today" and should then point to
  `apps/backend/test/README.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
