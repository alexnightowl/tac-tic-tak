# Backend tests

```bash
pnpm db:up                                   # docker Postgres :5433 + Redis :6380 (once)
pnpm --filter backend test:unit              # pure rule goldens, no IO
pnpm --filter backend test:e2e               # real AppModule over supertest
pnpm --filter backend test                   # both
pnpm --filter backend typecheck:test         # type pass over test/ + tools/contract (jest only transpiles)
```

## Targets (never the dev DB)

| | Default | Override |
|---|---|---|
| Postgres | `postgresql://taktic:taktic@localhost:5433/taktic_test` | `TEST_DATABASE_URL` |
| Redis | `redis://localhost:6380/1` | `TEST_REDIS_URL` |
| JWT | fixed test secret, `JWT_EXPIRES_IN` unset (code default 7d) | |

`test/test-env.ts` refuses a non-local host, a DB name not ending in `_test`, or Redis index 0.
The DB must exist (`createdb -h localhost -p 5433 -U taktic taktic_test`); `globalSetup` runs
`prisma migrate deploy` on it before every run. Each spec file calls `resetDatabase()` in
`beforeAll`: TRUNCATE of every table except `_prisma_migrations`, FLUSHDB of the test index,
then the puzzle fixture is re-inserted. Files run `--runInBand`.

## Layout

- `fixtures/puzzles.json`: 30 real Lichess puzzles (1088–1361, 7 tagged `fork`) copied from the
  dev DB; they pass the buffer's popularity/plays filters, so the real selector serves them.
- `helpers/app.ts`: `bootTestApp()` builds the app with `createApp()` from `src/app.setup.ts`, the
  same function `main.ts` uses (prefix, ValidationPipe, body limit, static uploads).
- `helpers/seed.ts`: `createUser` (mirrors register), `tokenFor`, `createFinishedSession`,
  `createReviewItem`, `createFriendship`, `primeQueue` (deterministic `/next` order through the
  Redis buffer), `backdateSession` (finish counts as full duration).
- `helpers/shape.ts`: `shapeOf()` reduces a response to keys + value kinds.
- `contract/web-scenario.ts`: every request shape the web sends, transport-agnostic.

## Golden tests

| Spec | Freezes |
|---|---|
| `unit/rules.golden.spec.ts` | rating step, session stats, solvedTarget, unlock, demote, calibration, streak on recorded inputs |
| `e2e/web-contract.e2e-spec.ts` | status code, response shape and error message of 117 web requests; login keys and the 7-day JWT |
| `e2e/rating-transcript.e2e-spec.ts` | per-attempt rating sequence and finish outcomes of scripted sessions |

Scripts run jest with `--ci`, so a missing snapshot fails instead of being written. A snapshot
diff means the web would see something different. Update with
`pnpm --filter backend exec jest --ci=false -u <spec>` only for a deliberate, documented change
(B5's 401 → 403, B8's rules fix), and show the diff in the PR. A new spec that adds snapshots is
recorded once the same way.

## Legacy smoke (two running servers)

`tools/contract/legacy-smoke.ts` replays the same scenario with `fetch` against running servers
(e.g. `main` on :4100 and the branch on :4101, both on `taktic_test`) and diffs them step by step:

```bash
pnpm --filter backend contract:smoke -- --base http://localhost:4100/api --compare http://localhost:4101/api \
  --db postgresql://taktic:taktic@localhost:5433/taktic_test --redis redis://localhost:6380/1
```

It refuses non-local hosts and registers throwaway users, which `--db` deletes afterwards. The
avatar step leaves a 1x1 PNG in the server's `uploads/avatars/`.
