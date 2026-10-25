# feat(backend): mobile refresh tokens, tokenVersion, change-password 403 (B4, B5)

Branch `api/auth-refresh`, based on `api/test-harness` (B0). **Merge B0 first**; this PR's diff against `main` includes B0's commit until then.

## What and why

Mobile users must not be logged out every 7 days, and the API needs a way to revoke sessions. This PR adds refresh tokens that only `client:'mobile'` logins receive. It also fixes a web bug: a typo in the current password used to log the user out (PLAN §2.4, §4 B4/B5).

### B4: refresh tokens + `tokenVersion`

- **Schema (additive):**
  - New table `RefreshToken`. Columns: `id`, `userId` (FK, cascade delete), `familyId`, `tokenHash` (unique), `deviceId?`, `platform?`, `createdAt`, `lastUsedAt`, `expiresAt`, `revokedAt?`, `replacedById?`.
  - `tokenHash` is the SHA-256 hex of an opaque 256-bit token (base64url, 43 chars). The raw token is returned once and never stored.
  - New column `User.tokenVersion Int @default(0)`.
- **Login / register** gain three optional fields: `client` (`'web' | 'mobile'`), `deviceId` (1–128 chars) and `platform` (`'ios' | 'android'`). When the body omits `deviceId` or `platform`, the server falls back to the `X-Device-Id` / `X-Platform` headers.
  - **Without `client`, or with `client:'web'`:** exactly today's response, `{token, user:{id, nickname}}`. The token is the same 7-day `{sub, nickname}` JWT, and no row is written.
  - **With `client:'mobile'`:**
    - The response is `{token, refreshToken, expiresIn, user}`. `expiresIn` is the access-token lifetime in seconds.
    - `token` is a short access token: `ACCESS_TOKEN_TTL`, default `30m`. Its payload is `{sub, nickname, tv, fid}`, where `fid` is the refresh family id.
    - A new refresh *family* starts. It expires after `REFRESH_TOKEN_TTL_DAYS` (default 90), and the expiry slides forward on every rotation.
    - A re-login with the same `deviceId` revokes that device's previous family.
- **`POST /auth/refresh {refreshToken}`** (public):
  - It rotates the token: the old row gets `revokedAt` and `replacedById`, and a successor is created in the same family. It returns the same shape as a mobile login.
  - Every failure (unknown, expired, revoked, reused) is `401 'invalid refresh token'`.
  - **Reuse detection:** presenting a token that was already rotated or revoked revokes the whole family. The same happens to the loser of two concurrent refreshes with one token. The race is caught by a conditional `updateMany` inside the transaction.
- **`POST /auth/logout {refreshToken}`** (public, idempotent): revokes that token's family and returns `{ok:true}`, including for unknown tokens.
- **`POST /auth/logout-all`** (JWT): bumps `tokenVersion`, revokes every refresh token of the user, and returns `{ok:true}`. For a token whose user row is gone it returns `401 'not authenticated'` (as change-password does) instead of a Prisma P2025 500.
- **`JwtStrategy`:**
  - It rejects a token whose `tv` is below the user's `tokenVersion`; a token without `tv` counts as 0. The reply is `401 {statusCode, message:'Unauthorized'}`, the same body as an expired token.
  - The version is read through a 60 s Redis cache (`auth:tv:<userId>`). The Redis call has a 250 ms timeout and falls back to Postgres, so a Redis outage cannot hang every authenticated route.
  - The check uses `<` rather than `!==`, so a cache entry up to 60 s stale never rejects a token minted after the bump.
  - When the user row is missing, the request passes through as before: the frozen quirk where a deleted user gets 404 on `/users/me`.
- **Housekeeping:** a new family deletes the user's expired rows. Rows revoked more than 30 days ago are pruned from the user (on login) and from the family (on rotation).
- `GET /auth/me` now returns `{id, nickname}` picked explicitly. Before, it returned `req.user`, which can now carry the server-side `familyId`. For web tokens the output is identical.

### B5: change-password

- A wrong current password is now **403** `'current password is incorrect'` for all clients. It was 401, and the web logs out on any 401.
- A successful change revokes the user's **other** refresh families; the caller's own family (from the access token's `fid`) survives. From the web, which has no `fid`, the change revokes every family, so mobile devices are logged out at their next refresh.
- No `tokenVersion` bump. Access tokens on other devices stay valid until they expire (at most 30 min for mobile; B18 adds the bump).

## WEB IMPACT

- **The only web-visible change is the deliberate B5 fix.** `POST /auth/change-password` with a wrong current password returns 403 instead of 401, with the same `{statusCode, message, error}` shape and the same message. `apps/frontend/src/lib/api.ts` only logs out on 401, so the settings form now shows "current password is incorrect" instead of bouncing to `/login`. I made no frontend change.
- **Web login and register are byte-identical:** same keys, the same 7-day JWT with payload keys `exp, iat, nickname, sub`, and no DB rows. The web sends none of the new fields, and the ValidationPipe whitelist behaves as before.
- **Every web-authenticated request now does one Redis GET.** Postgres is read at most once per user per 60 s, with a timeout and Postgres fallback.
- **Only a user who calls `logout-all` (mobile only) is affected beyond that.**
  - Their open web sessions are logged out, which is what "log out everywhere" means.
  - Their next web login token carries an extra `tv` claim. The web never decodes the token, and without that claim the next login would be rejected.
  - No web flow bumps `tv`.
- **Proof:**
  - The web-contract golden (117 web requests) differs in exactly one step, `change-password: wrong current`, `"status": 401` → `"status": 403`. I updated it explicitly with `jest --ci=false -u test/e2e/web-contract.e2e-spec.ts`, and changed the scenario comment to match.
  - The rating transcript is unchanged.
  - Legacy smoke, run three times: pristine `origin/main` (b25dbd3) on :4140 against this branch on :4141. Both servers shared one migrated test DB, so the old code also ran on the new schema, as during a rolling deploy. Result: `117 steps (0 skipped)`, `1 difference(s)`, `#20 change-password: wrong current: status 401 -> 403`.
  - Cross-version check:
    - a token issued by `main` is accepted by the branch (200 on `/users/me`);
    - a branch mobile token is accepted by `main` (200), which keeps rollback safe;
    - `main` ignores `client:'mobile'` and returns `{token, user}`.

## Migration

`20261025070514_auth_refresh_tokens` is additive only:

```sql
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;  -- constant default: metadata-only on PG 11+, no rewrite
CREATE TABLE "RefreshToken" (id TEXT PK, "userId" TEXT NOT NULL, "familyId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "deviceId" TEXT, platform TEXT, "createdAt"/"lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "replacedById" TEXT);
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

No existing migration is edited, and nothing is dropped. **This is the first migration of the mobile backend work: take a `pg_dump` before deploying it.**

## How it was tested

- I ran `pnpm --filter backend test` three times in a row; every run had 7 suites, 56 tests and 20 snapshots, all green. That is B0's 29 tests plus 27 new ones.
- **New `test/e2e/auth-refresh.e2e-spec.ts`** (21 tests), covering the PLAN §5 Phase 3 exit criteria:
  - **Web path:**
    - web login (no client and `client:'web'`) and web register give exactly `{token, user}` and a 7-day `{sub, nickname}` JWT, with no refresh rows;
    - `/auth/me` returns exactly `{id, nickname}` for web and mobile tokens;
    - a bad `client`, `platform` or oversized `deviceId` gets 400.
  - **Mobile login and register:**
    - a mobile login returns `refreshToken` and a 30-min `tv`/`fid` token;
    - only the SHA-256 hash is stored, and the row has a 90-day expiry, `deviceId` and `platform`;
    - mobile register reads the `X-Device-Id` / `X-Platform` header fallback;
    - a re-login on the same device revokes only that device's family.
  - **Refresh:**
    - it rotates: the old row is revoked and linked to its successor, the family stays the same, and the expiry slides;
    - **reusing an old token revokes the family**, including its legitimate successor, while other devices survive;
    - with two concurrent refreshes, one gets 201 and one 401, and the family is revoked;
    - unknown and expired tokens get 401; malformed ones get 400;
    - rows revoked more than 30 days ago are pruned;
    - a deleted user's tokens go with the cascade.
  - **Logout:** it revokes only its own family and is idempotent.
  - **`tv`:**
    - **logout-all invalidates every earlier web and mobile access token** and all refresh tokens, then fresh logins work with `tv:1`;
    - **a `tv` bump in the DB invalidates access tokens** once the 60 s cache entry lapses (the key's TTL is ≤ 60 s), and a token without `tv` counts as 0;
    - a deleted user still gets 404 on `/users/me`.
  - **change-password:**
    - **a wrong current password gets 403** for web and mobile and revokes nothing;
    - a success from mobile keeps the caller's own family, revokes the others, and bumps no `tv`;
    - a success from the web revokes all families.
  - **Env overrides:** `ACCESS_TOKEN_TTL=5m` and `REFRESH_TOKEN_TTL_DAYS=7` take effect, and the web token stays 7 days.
- **New `test/unit/auth-config.spec.ts`** (6 tests):
  - duration and days parsing, including falling back on a bad value instead of failing boot;
  - `TokenVersionService` reads Redis first, falls back to Postgres in under 1 s when Redis hangs, and returns null for a missing user without caching it.
- **Other checks:** `prisma generate`, `pnpm --filter backend typecheck`, `typecheck:test` and `build`, `pnpm --filter frontend typecheck` and `pnpm -r run typecheck` all pass.
- **Test DB:** the e2e and smoke runs used a dedicated local DB, `taktic_authrefresh_test`, with Redis index 4. That is the harness's `TEST_DATABASE_URL` / `TEST_REDIS_URL` override. Other branch agents were running against `taktic_test` at the same time, so I kept this branch's migration off it. The default `pnpm --filter backend test` uses `taktic_test` as usual.

- **Independent verification:** a second agent re-ran prisma generate, backend typecheck / typecheck:test / build, frontend typecheck and the full suite (7 suites, 56 tests, 20 snapshots) on a fresh DB (`taktic_vauth_test`, Redis index 12); checked `prisma migrate diff` (migrations == schema); re-ran the legacy smoke against a fresh `origin/main` build (117 steps, the same single 401 -> 403 difference); and replayed the web and mobile auth calls with curl against both servers. It fixed one defect: `logout-all` with a deleted user's still-valid token returned 500 (P2025), now 401 `not authenticated`, covered by the e2e spec.

## Prod verification checklist (after merge and deploy)

- [ ] Container logs show `prisma migrate deploy` applied `20261025070514_auth_refresh_tokens`, and the app started.
- [ ] The web at tactictak.online loads, an existing session still works (no forced logout), and login works.
- [ ] Settings → change password with a wrong current password shows the error and does **not** log you out. Throwaway account only.
- [ ] GET-only smoke with a throwaway account: `GET /api/auth/me` and `GET /api/users/me` return 200.
- [ ] Optional, needs the owner's OK because it is a POST: `POST /api/auth/login` with `{"client":"mobile"}` and a throwaway account returns `refreshToken` and `expiresIn: 1800`.
- [ ] `psql`: `SELECT count(*) FROM "RefreshToken";` works, and `SELECT max("tokenVersion") FROM "User";` returns 0.
- [ ] Redis: after browsing the web while logged in, `redis-cli --scan --pattern 'auth:tv:*' | head` shows keys and `TTL <key>` is at most 60.
- [ ] Backend logs show no `tokenVersion cache read failed` warnings (Redis fallback path) and no new 500s on authenticated routes; authenticated pages feel no slower.

## Rollback

- **Code:** revert the merge commit. The old code ignores the new table, column and claims:
  - mobile access tokens stay valid on the old code until they expire (≤ 30 min);
  - `/auth/refresh`, `/auth/logout` and `/auth/logout-all` return 404, so the mobile client must treat a failed refresh as a logout;
  - change-password goes back to 401.
- **Rollback, then roll forward again:** if any user ran `logout-all` before the revert (`tokenVersion > 0`), the old code issues them tokens without `tv`; once this PR is redeployed those tokens count as `tv` 0 and are rejected, so that user has to log in again once. Check with `SELECT count(*) FROM "User" WHERE "tokenVersion" > 0;` (0 means nobody is affected).
- **Schema:** leaving it is harmless. If it really has to go: `DROP TABLE "RefreshToken"; ALTER TABLE "User" DROP COLUMN "tokenVersion"; DELETE FROM _prisma_migrations WHERE migration_name = '20261025070514_auth_refresh_tokens';`. Only do this after the code is reverted, and B18 forbids destructive SQL before Phase 12, so prefer leaving it.

## Owner decisions taken provisionally

1. **`logout-all` invalidates web tokens too.** A token without `tv` counts as 0, as the plan says. To keep the user's *next* web login working, web tokens carry `tv` **only when** `tokenVersion > 0`. The JWT is otherwise identical, and the web never decodes it. The alternative was to exempt tokens without `tv` from the check, which would leave web sessions alive after "log out everywhere".
2. **Strict reuse detection with no grace window.** If the refresh response is lost (a timeout after the server rotated) and the client retries with the old token, that device is logged out. The mobile single-flight mutex prevents concurrent refreshes, but not this case. A configurable reuse grace window of 10–30 s could follow if logouts show up in beta.
3. **New routes return 201** (Nest's POST default), consistent with `/auth/login` and `/auth/change-password`.
4. **One error message, `invalid refresh token`,** for every refresh failure, so nothing can be probed.
5. **A re-login on the same `deviceId` revokes that device's previous family** (one live session per device per user).
6. **Change-password revokes refresh families but does not bump `tv`** while the web is alive, per the plan (B18).
7. **A bad `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL_DAYS` logs a warning and uses the default** instead of failing boot, so a typo in the VPS env cannot take the web down.
8. **`POST /admin/users/:id/password` (admin set-password) does not revoke refresh tokens yet.** Recommended follow-up: revoke all families there too.
9. **Revoked rows are pruned after 30 days.** Replaying an older token is still a 401, but no longer revokes its family.

## Before and after merge

- **Before:**
  - merge `api/test-harness` (B0) first;
  - **text conflict with `api/bootstrap` (B2/B3)**, whichever merges second: `src/auth/auth.module.ts` (keep B2's `JwtModule.registerAsync({ useFactory: () => ({ secret: requireJwtSecret(), ... }) })` **and** this PR's `providers: [AuthService, JwtStrategy, RefreshTokenService, TokenVersionService]` plus imports), `src/auth/jwt.strategy.ts` (keep both imports, B2's `secretOrKey: requireJwtSecret()` and this PR's constructor injection / `validate`), `test/test-env.ts` (keep both env-clearing blocks) and `test/README.md`. Verified with `git merge-tree`; `api/session-lifecycle`, `api/lists-account` and `api/ci` merge cleanly with this branch. Re-run `pnpm --filter backend test` after resolving;
  - take a `pg_dump` of prod (this is the first migration).
- **Env (optional):**
  - the defaults (`30m`, `90`) apply without any env change;
  - to tune them, set `ACCESS_TOKEN_TTL` and `REFRESH_TOKEN_TTL_DAYS` in the VPS `.env` **and** add them to the backend `environment:` in `docker-compose.yml`, which this PR does not touch (only `JWT_SECRET` and `JWT_EXPIRES_IN` pass through today);
  - `.env.example` files document both.
- **After:**
  - merge `main` into `mobile`;
  - mobile (Phase 4) can send `client:'mobile'` plus `deviceId`, store `refreshToken` in secure-store and call `/auth/refresh`. Until B2 lands, it uses `/api/*`.
  - The mobile client should treat a login response without `refreshToken` (an older server) as a legacy 7-day session.
  - A 401 from `/auth/refresh` itself must never trigger another refresh.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
