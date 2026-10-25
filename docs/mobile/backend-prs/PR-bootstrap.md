# feat(backend): B2 bootstrap hardening + B3 app-config and min-build gate

Branch `api/bootstrap` (commits `d4a7d18` + verifier fix-up), based on `api/test-harness` (B0, `b2859d5`). **Merge B0 first**; GitHub then shows only this commit.

> ## ⚠️ BEFORE MERGE: the VPS env must have `JWT_SECRET`
>
> This PR removes the `'dev-secret'` fallback. **If `JWT_SECRET` is missing or blank, the backend will not start.** It exits at boot with `JWT_SECRET is not set: refusing to start`.
>
> - **Prod:** `docker-compose.yml` already requires it (`JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET in root .env}`), so a compose deploy without it already fails today. Still, confirm that the VPS root `.env` has a non-empty `JWT_SECRET` before merging. Keep the value unchanged, or every web user is logged out.
> - **Local dev:** `pnpm --filter backend dev` reads `apps/backend/.env`. If that file has no `JWT_SECRET`, the dev server on :4000 will refuse to start once this reaches your checkout. Add `JWT_SECRET=dev-secret` there to keep existing dev tokens valid.

## What and why

PLAN §4 B2 and B3: the bootstrap work Phase 3 needs before mobile can move to `/api/v1`.

### B2: bootstrap hardening (`src/app.setup.ts`, the shared `createApp()` used by `main.ts` and the tests)

| Change | Detail |
|---|---|
| URI versioning | `enableVersioning({ type: URI, defaultVersion: [VERSION_NEUTRAL, '1'] })`. `/api/x` (what the web calls) and `/api/v1/x` (mobile) reach **the same handler**. `/api/v2/x` is 404. |
| `trust proxy` | Set to `1`, because nginx is the single hop. `req.ip` becomes the client address from `X-Forwarded-For`, which B11 throttling needs. No code reads `req.ip` today. |
| `enableShutdownHooks()` | SIGTERM/SIGINT run `onModuleDestroy` (Prisma `$disconnect`, Redis `quit`). |
| helmet 8 | Default headers, except that HSTS is **off**: nginx already sends it, so the response carries one header with one policy. CORP is set to `cross-origin` so avatars under `/uploads` still load from another origin (the web dev server on :3000 loads them from :4000). `X-Powered-By` is removed. |
| `GET /api/health` | Public. Returns 200 `{status:'ok', db:'up', redis:'up'}` when `SELECT 1` and `PING` both answer within 2 s. Otherwise returns 503 with the same keys and `status:'error'`. Sends `Cache-Control: no-store`. |
| JWT_SECRET fail-fast | New `requireJwtSecret()`: a missing or whitespace-only secret throws at boot. The value is used **verbatim** (no trim), so existing tokens stay valid. `createApp()` calls it first. `JwtModule` moves to `registerAsync`, so the secret and `JWT_EXPIRES_IN` are read when the module is instantiated, after ConfigModule loads `.env`. That is the same moment `JwtStrategy` reads them, so signing and verification can no longer disagree. Prod is unaffected because compose injects real env vars. |
| Prisma filter | New global `PrismaExceptionFilter`. P2025 ("record not found", including `find*OrThrow`) now returns the standard Nest 404 body `{statusCode:404, message:'not found', error:'Not Found'}`. Every other Prisma error goes to Nest's default handler, so it is still logged and still a 500. |

### B3: app config and min-build gate (`src/app-config/*`)

`GET /api/v1/app-config` is public, sends `no-store`, and also answers on `/api/app-config` (see the versioning row above). Its values are read once at boot from env:

```json
{
  "minSupportedBuild": { "ios": 0, "android": 0 },
  "latestBuild": { "ios": null, "android": null },
  "storeUrls": { "ios": null, "android": null },
  "featureFlags": {},
  "maintenance": null
}
```

| Env | Effect | Default when unset |
|---|---|---|
| `MIN_SUPPORTED_BUILD_IOS`, `MIN_SUPPORTED_BUILD_ANDROID` | Integer build number. Builds below it get 426. | `0` (no gate) |
| `LATEST_BUILD_IOS`, `LATEST_BUILD_ANDROID` | Integer build number. | `null` |
| `APP_STORE_URL`, `PLAY_STORE_URL` | Store links. | `null` |
| `FEATURE_FLAGS` | Comma list `a,b,-c` → `{a:true,b:true,c:false}`, or a JSON object of booleans. | `{}` |
| `MAINTENANCE_MESSAGE` | A non-empty value → `maintenance: {message}`. | `null` |

A malformed value never stops the boot. It falls back to its default and logs a warning, so a typo cannot take the web down.

The **426 middleware** (`min-build.middleware.ts`, plain express, registered before the router and the guards) answers 426 **only** when all of these hold:

1. the request has an `X-App-Build` header;
2. `X-Platform` is `ios` or `android` (case-insensitive);
3. the build parses as an integer;
4. the build is below a configured minimum (> 0).

Every other request passes through untouched: the web, curl, a missing or unknown platform, a malformed build, or no minimum configured. These are always exempt (path match is case-insensitive, like Express routing): `/api[/vN]/app-config`, `/api[/vN]/health` (an outdated build must still be able to learn that it needs to update), `OPTIONS` preflights, and anything outside `/api` (such as `/uploads`). The response body is:

```json
{ "statusCode": 426, "message": "app update required", "error": "Upgrade Required", "minSupportedBuild": 50, "storeUrl": "https://play.google.com/..." }
```

## WEB IMPACT

**None on any request the web sends, with one documented exception: a P2025 now returns 404 where it returned 500.**

- **Unversioned paths:** `/api/*` keeps the same paths, handlers, status codes, bodies and error messages. The unknown-route 404 still reads `Cannot GET /api/...`.
- **Golden test:** the B0 web-contract golden passes with **zero snapshot changes**: 117 requests, 20 snapshots, no `-u`. The rating transcript is also unchanged.
- **Legacy smoke:** a pristine `origin/main` (b25dbd3) on :4100 against this branch on :4101 gave identical status codes, shapes and messages on all 117 steps, three runs in a row. A fourth run against **`/api/v1`** on the branch was also identical on all 117 steps, which proves the mobile path equals the web path.
- **The web never sends `X-App-Build`,** so the 426 gate cannot fire for it. A CORS preflight is never gated, and CORS stays `*`; the golden CORS check still passes.
- **Headers:** the only change the web can see is in response headers. helmet adds `Content-Security-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy: cross-origin`, `Origin-Agent-Cluster`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Frame-Options: SAMEORIGIN`, `X-Permitted-Cross-Domain-Policies` and `X-XSS-Protection: 0`, and removes `X-Powered-By`. The backend serves only JSON and images, never HTML, so CSP and COOP do not affect the web pages (Next serves those). CORP `cross-origin` keeps avatar `<img>` loads working from any origin. HSTS is not duplicated.
- **P2025 → 404 (documented exception, PLAN §4 B2):** `POST /api/review/:puzzleId/resolve` for a puzzle that is not in the queue went from 500 `{"statusCode":500,"message":"Internal server error"}` (checked on `origin/main`) to 404 `{"statusCode":404,"message":"not found","error":"Not Found"}`. No golden step hits a P2025, so no snapshot changed. Other `update`/`delete` calls that could P2025 in a race now return 404 instead of 500 in the same way.

## How it was tested

The local docker Postgres on :5433 and Redis on :6380 served every run. Several sibling `api/*` worktrees were running their e2e suites at the same time, so most runs used a dedicated DB, `taktic_bootstrap_test`, with Redis index 7, set through the harness's `TEST_DATABASE_URL` / `TEST_REDIS_URL`; sharing one DB would let one suite truncate another's data mid-run. The final run used the default `taktic_test` with Redis db 1.

- `pnpm --filter backend test` gives **9 suites, 97 tests, 20 snapshots, all green** (96 at `d4a7d18`: 3 runs on the dedicated DB and 1 on `taktic_test`; 97 after the verifier fix-up, re-run on a separate `taktic_bverify_test` / Redis db 13).
  - **New `test/e2e/bootstrap.e2e-spec.ts`:**
    - Versioning: 12 representative authed GETs return 200 on both `/api` and `/api/v1` with **identical bodies**. The routes are `auth/me`, `users/me`, `users/by-nickname`, `users/search`, `review`, `review/themes`, `analytics`, `analytics/timeline`, `achievements`, `leaderboard`, `friends` and `friends/pending`.
    - Admin routes work on both paths. Login returns 201 on both. A full create → next → attempt → finish session works on v1.
    - 400 and 401 bodies are identical on both paths. `v2` and unknown routes return 404 with the default message.
    - Health returns 200 on both paths.
    - Helmet headers are present, HSTS is absent, and CORP is `cross-origin`.
    - `trust proxy === 1`.
    - SIGTERM listeners are registered on boot and released on close.
    - P2025: resolving a missing item returns 404 on both paths, and resolving a queued item still returns `{ok:true}`.
    - `createApp()` rejects when `JWT_SECRET` is unset, empty or whitespace.
    - `app-config` returns the exact env-derived JSON. It stays reachable by an outdated build, and the defaults are correct when env is unset.
    - **426 matrix**, on both `/api` and `/api/v1`:
      - no header → 200;
      - ios 99/100/101 against a minimum of 100 → 426/200/200;
      - android 49/60 against 50 → 426/200;
      - `iOS` (case) → 426;
      - no platform, `web` or a malformed `1.2.3` build → 200;
      - a low build gets 426 before auth runs (on login);
      - an OPTIONS preflight returns 204;
      - `/uploads` is not gated.
  - **New unit specs:**
    - `app-config.spec.ts`: env parsing, flags (comma list and JSON), header parsing, gate exemptions and look-alike paths (`/api/healthz` is gated).
    - `jwt-secret.spec.ts`: the throw cases, verbatim return, and a guard that no `src` file contains the `'dev-secret'` literal again.
    - `prisma-exception.filter.spec.ts`: P2025 → 404; P2002, P2003 and P2034 → the default 500.
  - `test/test-env.ts` now also clears the app-config env keys, so a value in the developer's shell cannot leak into a spec.
- `pnpm --filter backend exec prisma generate && pnpm --filter backend typecheck && pnpm --filter backend build`, `pnpm --filter backend typecheck:test`, `pnpm --filter frontend typecheck` and `pnpm -r run typecheck` all pass.
- **Built-server checks** with `node dist/main.js`:
  - `/api/health` returns `{"status":"ok","db":"up","redis":"up"}`, and `/api/v1/app-config` returns the defaults.
  - SIGTERM makes the process exit cleanly within about 1 s.
  - Starting without `JWT_SECRET` exits at once with the fail-fast message.
  - `POST /api/review/nope/resolve` returns 500 on `origin/main` and 404 on the branch.

### Independent verification (second agent)

- Re-ran prisma generate, backend `typecheck`, `typecheck:test`, `build`, `pnpm --filter frontend typecheck` and the full suite on its own DB: all green, no snapshot changes.
- Started pristine `origin/main` (b25dbd3) on :4140 and the branch's `dist/main.js` on :4141, both on the same test DB, same `JWT_SECRET`:
  - `contract:smoke` main `/api` vs branch `/api`: identical on 117/117 steps; main `/api` vs branch `/api/v1`: identical on 117/117.
  - A separate curl/urllib replay of the web flow (register, login, bad login, 7 authed GETs, 401, session create/next/attempt/finish, double finish, avatar upload + fetching the file, settings PATCH) compared status, body keys, error messages **and every non-helmet response header** (CORS, `Content-Type`, `Cache-Control`, `Accept-Ranges` on the avatar file): identical except the documented `review/:id/resolve` 500 → 404.
  - CORS preflight for `PATCH /api/users/me` from `http://localhost:3000`: identical `Access-Control-*` / `Vary` headers.
  - A token issued by `main` is accepted by the branch and vice versa; both are HS256 with `{sub, nickname, iat, exp}` and a 7-day lifetime.
  - `JWT_SECRET` supplied only through a `.env` file in the cwd boots fine (ConfigModule loads it before the fail-fast check); with no secret at all the process exits with the fail-fast error; SIGTERM exits cleanly.
  - With `MIN_SUPPORTED_BUILD_IOS=10`, a malformed `MIN_SUPPORTED_BUILD_ANDROID` and malformed `FEATURE_FLAGS`, the server boots, logs two `[AppConfig]` warnings, serves the config, returns 426 for build 9 and passes build 10.
- Fix-up: the gate's exemption check was case-sensitive while Express routing is not, so `/api/v1/App-Config` reached the config endpoint but got 426. The path is now lower-cased before matching (unit test added).

## Prod verification checklist (after deploy, GET only)

- [ ] `curl -s https://tactictak.online/api/health` returns 200 `{"status":"ok","db":"up","redis":"up"}`.
- [ ] `curl -s https://tactictak.online/api/v1/health` returns 200 with the same body.
- [ ] `curl -s https://tactictak.online/api/v1/app-config` returns JSON (zero minimums unless the env passthrough below was added).
- [ ] `curl -sI https://tactictak.online/api/health` shows exactly **one** `Strict-Transport-Security` header (from nginx), plus `X-Content-Type-Options: nosniff`, and no `X-Powered-By`.
- [ ] `curl -s -o /dev/null -w '%{http_code}' -H 'X-App-Build: 1' -H 'X-Platform: ios' https://tactictak.online/api/v1/health` returns 200 (health is exempt).
- [ ] With a throwaway account (never `.claude-test-account`): `GET /api/users/me` and `GET /api/v1/users/me` both return 200 with the same body.
- [ ] Web spot-check: log in, open Home and Review, and check that avatars render (CORP and CSP), then play a 1-minute session and save settings. The browser console should show no CSP or CORP errors.
- [ ] Backend logs after a restart: no `JWT_SECRET is not set`, and no `[AppConfig]` warnings.

## Rollback

- **Code:** revert this commit. There is no migration and no data change, so a revert is safe at any time.
- **Mobile:** if mobile already calls `/api/v1/*`, it breaks on a revert. Mobile still uses `/api` until it switches after this merge, so revert before mobile switches, or keep the versioning part.
- **Secret:** if the deploy fails at boot with `JWT_SECRET is not set`, set the secret in the VPS root `.env`; reverting is not needed. The value must equal the previous one, or every web user is logged out.

## Owner actions

- **Before merge:**
  1. Confirm that the VPS root `.env` has a non-empty `JWT_SECRET` (see the warning at the top).
  2. Merge **B0 (`api/test-harness`) first**.
- **No `pg_dump` needed:** this PR has no migration.
- **Optional, for the mobile gate:** `docker-compose.yml` has no `env_file`, so B3's env vars reach the container only if they are added to the backend `environment:` block. That file is do-not-touch outside B17, so this PR leaves it alone. Without the passthrough, app-config serves defaults and the gate is off, which is safe. When you want the gate, add these lines:
  ```yaml
  MIN_SUPPORTED_BUILD_IOS: ${MIN_SUPPORTED_BUILD_IOS:-0}
  MIN_SUPPORTED_BUILD_ANDROID: ${MIN_SUPPORTED_BUILD_ANDROID:-0}
  LATEST_BUILD_IOS: ${LATEST_BUILD_IOS:-}
  LATEST_BUILD_ANDROID: ${LATEST_BUILD_ANDROID:-}
  APP_STORE_URL: ${APP_STORE_URL:-}
  PLAY_STORE_URL: ${PLAY_STORE_URL:-}
  FEATURE_FLAGS: ${FEATURE_FLAGS:-}
  MAINTENANCE_MESSAGE: ${MAINTENANCE_MESSAGE:-}
  ```
- **After merge:** merge `main` into `mobile`. On `mobile`, `apps/mobile/src/platform/config.ts` can then switch the base to `/api/v1`, and the client should start sending `X-App-Build` (today it sends only `X-Platform` and `X-App-Version`).
- **Dependency:** adds `helmet ^8.1.0` (8.3.0, zero transitive dependencies) and updates `pnpm-lock.yaml`. The backend Dockerfile installs without the lockfile, so the image resolves the newest `^8` release.

## Decisions taken provisionally

1. **`latestBuild` and `storeUrls` are per platform** (`{ios, android}`). PLAN lists a scalar `latestBuild`, but build numbers differ by platform.
2. **Unset values:** `minSupportedBuild` defaults to `0` (meaning no gate); the other fields default to `null`. `forceUpdate` (mentioned in the inventory) is not returned, because the client derives it from `minSupportedBuild`.
3. **The 426 gate needs a known platform.** A build sent without `ios` or `android` in `X-Platform` passes, as the task specifies.
4. **Config is read once at boot.** Compose recreates the container when env changes, so a DB- or Redis-backed config can come later if live toggles are wanted.
5. **The P2025 404 message is `not found`** (lowercase, like the codebase's other messages). The Prisma model name is not exposed.
6. **helmet keeps its default CSP;** only HSTS and CORP are overridden.
7. **Every route is reachable on v1, including admin and `/api/app-config`,** as `defaultVersion` implies. B18 later drops `VERSION_NEUTRAL`.

## Open notes

- **Shutdown hooks in Docker:** the backend Dockerfile (do-not-touch) runs `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]`. On `docker stop`, SIGTERM goes to `sh`, which does not forward it, so node is killed after the 10 s grace period and the new hooks never run in prod. Changing the CMD to `... && exec node dist/main.js` would fix that; the owner decides.
- **`trust proxy` cannot be verified from prod logs yet:** PLAN B11 says throttling lands after `trust proxy` is verified in prod logs, but the backend has no request logging that prints `req.ip`. B11 (or a small logging change before it) needs to add a way to see the resolved client IP.
- **helmet version in the image:** the Dockerfile copies only `package.json` (no lockfile), so the `--frozen-lockfile` install fails and falls back to a plain install that resolves the newest `helmet@^8`. A future 8.x minor could change default headers without a code change here; pin it exactly if you want reproducible images.
- **`trust proxy` and B11:** compose also publishes `4000:4000` on the host. If that port is reachable from the internet, a client hitting it directly can spoof `X-Forwarded-For`. That matters once B11 keys throttling on IP. Binding it to `127.0.0.1` or firewalling it (B17) closes the gap.
