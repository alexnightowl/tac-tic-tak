# Backend PRs for the mobile contract (Phase 3)

Each branch is pushed to GitHub and verified (backend e2e suite, web-contract golden test,
rating transcript, legacy smoke against `origin/main`). Nothing is merged; the owner merges.
PR bodies are the `PR-*.md` files here. Open a PR with
`https://github.com/alexnightowl/tac-tic-tak/pull/new/<branch>`.

## Merge order

| # | Branch | Items | Base | Migration | Owner action |
|---|---|---|---|---|---|
| 1 | `api/ci` | B1 CI: node 22, strict lockfile, tests with Postgres/Redis services, mobile job, deploy only on backend/frontend/deploy changes | main | — | — |
| 2 | `api/test-harness` | B0 jest + supertest e2e, web-contract golden, rating transcript, seed script, legacy smoke | main | — | — |
| 3 | `api/bootstrap` | B2 `/api/v1` versioning, trust proxy, helmet, `/api/health`, JWT_SECRET fail-fast, P2025→404; B3 `/api/v1/app-config` + 426 gate | test-harness | — | **Before:** confirm the VPS root `.env` has `JWT_SECRET` (same value as now) |
| 4 | `api/auth-refresh` | B4 refresh tokens (mobile only), tokenVersion, logout / logout-all; B5 change-password 401→403 | test-harness | `RefreshToken` table, `User.tokenVersion` | `pg_dump` before; optional env `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS` |
| 5 | `api/session-lifecycle` | B6 idempotent attempts, `/next` requestId, `/sessions/active`, tz, Redis TTLs; B7 sweeper (merged **disabled**) | test-harness | `User.timezone`, `TrainingAttempt.clientAttemptId` | `pg_dump` before; sweeper stays off until `SESSION_SWEEPER_ENABLED=true` |
| 6 | `api/lists-account` | B9 paginated `/api/v1/sessions`, `firstPuzzleId`, idempotent resolve; B10 `DELETE /api/v1/users/me` | test-harness | — | — |
| 7 | `api/hardening` | B11 throttling (Redis), B12 nginx gzip | **bootstrap** | — | Merge after #3. See the note on port 4000 below |

After each merge: `curl https://tactictak.online/api/health` (from #3 on) and a quick web
spot-check; then the agent merges `main` into `mobile`.

## Things to know

- Branches 3–7 are stacked on `api/test-harness` (7 on `api/bootstrap`), so until those merge,
  their PR diffs include the base commits. Merge in the order above and the diffs shrink.
- Web behaviour is unchanged except two deliberate fixes: change-password with a wrong current
  password returns 403 (the web no longer logs the user out on a typo), and a Prisma "not found"
  returns 404 instead of 500.
- Mobile-only response fields are gated on `client: 'mobile'` in the request, so web responses
  stay byte-identical.
- **Port 4000 is published on the VPS host** (`docker-compose.yml` `"4000:4000"`). With
  `trust proxy`, a client hitting :4000 directly could spoof `X-Forwarded-For` and dodge per-IP
  limits. Bind it to `127.0.0.1:4000:4000` (and Postgres to `127.0.0.1:5432`) — planned as B17,
  or firewall those ports.
- Provisional decisions inside the PRs (refresh reuse detection without a grace window,
  `logout-all` also ending web sessions, login throttling counting failed attempts only, the
  sweeper policy) are listed in each PR file.
