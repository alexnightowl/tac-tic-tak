# B11 rate limiting + B12 nginx gzip (api/hardening)

Branch `api/hardening`, two commits on top of **`api/bootstrap`** (3043ef1):

- `c143278` feat(backend): B11 rate limiting with @nestjs/throttler on Redis
- `b2561aa` perf(deploy): B12 gzip API responses in nginx

## Merge order (important)

This branch is based on `api/bootstrap`, not on `main`. Per-IP limits need B2's
`app.set('trust proxy', 1)`. Merge in this order:

1. `api/test-harness` (B0)
2. `api/bootstrap` (B2/B3). Check the prod logs/health first: `trust proxy` should resolve real
   client IPs. PLAN §4 says B11 lands only after that is verified.
3. the other Phase 3 PRs (`api/auth-refresh`, `api/session-lifecycle`, `api/lists-account`)
4. **this PR last**

After `api/auth-refresh` (B4) and this PR are both on `main`, add a one-line follow-up:
`@RateLimit('refresh')` on `POST /auth/refresh` (and optionally on `POST /auth/logout`). The
`refresh` throttler (30/min/IP) is already defined here, but the route does not exist on this
base. Expect a small conflict in `auth.module.ts` exports (`JwtModule` is exported here) and in
`auth.controller.ts` imports. Both are trivial.

## What and why

### B11: throttling (`apps/backend/src/throttle/`)

The API had no rate limiting at all: bcrypt login could be brute-forced, register could be spammed
and search allowed enumeration. `@nestjs/throttler` 6.5.0 (exact pin, zero transitive deps) is now
a global guard with a custom Redis storage.

| Throttler | Limit | Key | Applies to |
|---|---|---|---|
| `global` | 120 / 60 s | user (verified JWT `sub`), else client IP | every route except `/api/health` |
| `login-ip` | 5 / 60 s | client IP | `POST /auth/login`, failed attempts only* |
| `login-nickname` | 10 / 1 h | nickname, case-insensitive | `POST /auth/login`, failed attempts only* |
| `register` | 3 / 1 h | client IP | `POST /auth/register`, created accounts only* |
| `refresh` | 30 / 60 s | client IP | defined, applied once B4 is merged |
| `search` | 30 / 60 s | user | `GET /users/search` |
| `avatar` | 10 / 1 h | user | `POST /users/me/avatar` |
| `friend-request` | 30 / 1 h | user | `POST /friends/request` |

\* "Refunds": every request counts while it is in flight, so a parallel burst cannot overshoot.
Once the response finishes, a successful login (or a rejected registration) gives its hit back.
A household or a carrier-NAT IP where people log in normally is never blocked, but the 6th
**failed** login in a minute is.

- **429 response:** `Retry-After: <seconds>` header, body
  `{statusCode:429, message:"Too many requests, try again in N s", error:"Too Many Requests", retryAfter:N}`.
  The web's `api.ts` already shows `body.message`. The mobile `ApiError` carries the body, so
  `retryAfter` is usable without reading headers.
- **Normal responses are unchanged:** `setHeaders: false`, so no `X-RateLimit-*` headers.
- **Storage:** fixed-window counter plus a block key, one atomic Lua script per hit, keys
  `throttle:<name>:<sha256(tracker)[:32]>` with TTLs, on the existing `REDIS_URL`. It has its own
  connection with the offline queue disabled and a 300 ms op timeout. If Redis is down or slow,
  requests **fail open** (allowed, with a warning at most once a minute) instead of hanging.
- **Proxy safety:** IPv4-mapped IPv6 is unwrapped, and IPv6 is keyed per /64. If `trust proxy`
  were ever off, a request carrying `X-Forwarded-For` skips per-IP limits instead of throttling the
  whole site as nginx's single IP. Per-user and per-nickname limits still apply.
- `/api/x` and `/api/v1/x` share counters (keys do not include the route).
- **Env overrides** (tests, local dev; prod needs none): `THROTTLE_<NAME>_LIMIT`,
  `THROTTLE_<NAME>_TTL_SEC` (e.g. `THROTTLE_LOGIN_IP_LIMIT`), and `THROTTLE_ENABLED=false`.
  Documented in `apps/backend/.env.example`.

### B12: nginx gzip (`deploy/nginx.conf`)

Only the `location /api/` block changed: `gzip on; gzip_types application/json text/plain text/csv;`
(text/html is nginx's implicit default), `gzip_min_length 1024`, `gzip_comp_level 5`,
`gzip_proxied any`, `gzip_vary on`. `/uploads/`, `/` (Next) and both redirect servers are byte
for byte the same. Timeline and analytics JSON is large, and mobile is often on cellular. BREACH
is not a practical concern here: auth is a bearer header, not a cookie, so a cross-site request
carries no secret to probe.

## WEB IMPACT

- **Normal traffic:** no change. Same status codes, bodies and headers. The web does not poll
  (its only `setInterval` is a local 250 ms clock), and a play session is far below 120 req/min.
- **Abusive bursts:** they now get 429 with an English message, which the web shows as is.
  Realistic edge cases:
  - a shared IP that creates more than 3 accounts in an hour;
  - more than 5 wrong passwords per minute from one IP;
  - more than 10 wrong passwords per hour on one nickname.
- **gzip:** browsers send `Accept-Encoding` and decompress transparently. JSON bodies are
  identical after decompression (verified). Express weak ETags/304 keep working.
- **Proof:** I ran the legacy smoke three times against the live builds. It replays all 117 web
  requests. Each run gave identical status codes, shapes and messages:

  | Base | Compare | Result |
  |---|---|---|
  | pristine `origin/main` (b25dbd3) on :4100 | this branch on :4101 | 117/117 identical, 3 runs in a row |
  | `api/bootstrap` (3043ef1) on :4102 | this branch `/api` | 117/117 identical |
  | `api/bootstrap` (3043ef1) on :4102 | this branch `/api/v1` | 117/117 identical |

  Response headers on `GET /api/leaderboard` (401), `GET /api/health`, a failed
  `POST /api/auth/login` and `GET /api/users/me` hash identically to `api/bootstrap` (ignoring
  Date, ETag and Content-Length).
- **Golden test:** the in-process web-contract golden runs under the **default** limits and is
  green with **no snapshot change**. So is the rating transcript.

## How it was tested

- `pnpm --filter backend test`: 11 suites, **121 tests, 20 snapshots, all green**, 3 runs in a
  row. No snapshot was added or changed.
- New `test/e2e/throttle.e2e-spec.ts`. Each block boots its own app with its env.
  - **Defaults:**
    - 5 wrong logins give 401, the **6th gets 429 with `Retry-After`** (1..60), and the correct
      password also gets 429 while blocked;
    - 8 successful logins are never blocked;
    - 2 rejected registrations plus 1 "nickname taken" are refunded, 3 accounts are created, and
      the 4th attempt gets 429 (`Retry-After` ≤ 3600);
    - normal responses have no ratelimit or retry-after headers;
    - behind a proxy, each `X-Forwarded-For` client gets its own bucket, and a spoofed first XFF
      entry is ignored (last hop only);
    - with `trust proxy` off, per-IP limits are skipped but the per-nickname limit still blocks.
  - **Low env limits:**
    - global is per user, counted across routes; another user and the anonymous bucket on the
      same IP are unaffected, and a garbage token counts as anonymous;
    - health is never throttled, and `/api` and `/api/v1` share counters;
    - per-nickname is case-insensitive;
    - search, avatar and friends/request each block once over their limit.
  - **Switch and storage:**
    - `THROTTLE_ENABLED=false` turns every limit off;
    - Redis storage: fixed window, block, fresh window after the block, refunds never go below 0,
      every key has a TTL.
- New `test/unit/throttle.spec.ts`:
  - defaults equal PLAN §4 B11;
  - env overrides, with junk values falling back to the defaults;
  - the refund policy and `THROTTLE_ENABLED` parsing;
  - IP normalisation (v4-mapped, IPv6 /64, zone ids) and `clientIp` with and without
    `trust proxy`;
  - an unreachable Redis fails open in under 1 s.
- `prisma generate`, backend `typecheck`, `typecheck:test`, `build`, `pnpm --filter frontend
  typecheck` and `pnpm -r run typecheck` all pass. `pnpm install --frozen-lockfile --offline` is
  consistent.
- **nginx:** `docker run --rm nginx:alpine nginx -t` on the real file (dummy self-signed certs,
  `--add-host` for the upstreams) printed "syntax is ok / test is successful". The only warning is
  the existing `listen ... http2` deprecation. I also ran a functional check on a throwaway nginx
  container, with upstreams pointed at a local static server and only in a scratch copy:
  - `/api/*.json` with `Accept-Encoding: gzip` returned `content-encoding: gzip` and
    `vary: Accept-Encoding`;
  - the same file under `/uploads/` was not compressed;
  - `/api` without `Accept-Encoding` was not compressed;
  - the decompressed body was byte-identical.

## Independent verification (second pass)

A separate verifier re-ran everything on `b2561aa` without reusing the builder's servers:

- `pnpm install --frozen-lockfile --offline`, `prisma generate`, backend `typecheck`,
  `typecheck:test`, `build` and `pnpm --filter frontend typecheck`: all pass.
  `pnpm --filter backend test`: 11 suites, 121 tests, 20 snapshots, green.
- Legacy smoke, fresh `origin/main` (b25dbd3) build on :4110 vs this branch on :4111, both on
  `taktic_test` / Redis db 1: **117/117 steps identical** (status codes, shapes, messages).
- Headers of `POST /api/auth/register` main vs branch differ only by the helmet headers that come
  from `api/bootstrap` (B2); nothing new from this branch, no `X-RateLimit-*`.
- curl on :4111: 5 wrong logins give 401, the 6th gives 429 with `Retry-After: 60` and the
  documented body; `/api` and `/api/v1` share the counter; a parallel burst of 12 wrong logins
  gives exactly 5x401 + 7x429 (no overshoot).
- Throwaway nginx (`deploy/nginx.conf` with only the two upstream hosts rewritten) in front of
  :4111: `/api/users/me` (1.2 KB) and `/api/achievements` (2.2 KB) come back gzipped with
  `vary: Accept-Encoding` and decompress byte-identical; `/api/leaderboard` (905 B) and
  `/api/health` stay plain; weak ETag `If-None-Match` still gives 304 through gzip; a
  client-forged `X-Forwarded-For` through nginx does not escape the per-IP login limit.
- `nginx -t` on the unmodified file: ok (only the pre-existing `listen ... http2` warning).
- No migrations, no Prisma schema change, no new required DTO field, no secrets in the diff.

## Prod verification checklist (after the deploy, GET only)

- [ ] `curl -s https://tactictak.online/api/health` returns 200, no `x-ratelimit-*` headers.
- [ ] `curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' https://tactictak.online/api/leaderboard`
      returns 401 with a small body and **no** `content-encoding` (under the 1 KiB threshold, as
      expected). With the throwaway account's token,
      `curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' -H 'Authorization: Bearer <token>' https://tactictak.online/api/achievements`
      (about 2.2 KB even for a fresh account) shows `content-encoding: gzip` and
      `vary: Accept-Encoding`; without `Accept-Encoding` it comes back plain.
- [ ] `curl -s -o /dev/null -D - https://tactictak.online/` has no `content-encoding` change
      (the frontend is untouched).
- [ ] Web smoke with the throwaway account: login, a 1-min session, finish, open stats, search a
      nickname, save a setting. No 429.
- [ ] Backend logs: no `[Throttle] X-Forwarded-For present but 'trust proxy' is off` warning.
      If it appears, B2's trust proxy is not active and per-IP limits are being skipped. That is
      safe but ineffective.
- [ ] Backend logs: no `[Throttle] redis: ...` / `hit failed open` warnings.
- [ ] (Owner, on the VPS) `docker compose exec redis redis-cli client list | grep name=throttler`
      shows the throttler connection, and after some traffic
      `redis-cli --scan --pattern 'throttle:global:*' | head` lists keys (counting is live, not
      silently failing open).

## Rollback

- **Code:** revert both commits (or the merge). There is no migration, and Redis keys
  (`throttle:*`) expire on their own within 1 h. Optional cleanup:
  `redis-cli --scan --pattern 'throttle:*' | xargs redis-cli del`.
- **Kill switch without a revert:** `THROTTLE_ENABLED=false`. It only works if it is added to the
  backend `environment:` block in `docker-compose.yml`, which I did not touch (do-not-touch).
  Today a revert is the fastest rollback.
- **nginx:** revert the `gzip*` lines in `location /api/`.

## Migrations

None.

## Dependencies

`@nestjs/throttler` **6.5.0** (exact pin, because the Dockerfile installs without the
lockfile). Peer range covers Nest 10/11, no transitive deps. `pnpm-lock.yaml` was updated with
pnpm in the worktree.

## Provisional decisions (owner, please confirm)

1. **Login counts failed attempts, not all attempts.** A successful login gives its hit back.
   PLAN §4 says "login 5/min/IP". Counting every login would block carrier-NAT users and
   households, and it would trip the golden scenario's normal logins. Test: the 6th *failed*
   login in a minute gets 429.
2. **Register counts created accounts.** Rejected attempts (validation, nickname taken) are
   refunded. Once 3 accounts exist in the hour window, any further attempt is blocked for the
   rest of that hour.
3. **Block length = window length.** That is the throttler default: 60 s for login-ip, 1 h for
   login-nickname and register. There is no exponential backoff yet (the inventory mentions it as
   optional).
4. **`refresh` keyed by IP**, because the request carries no valid access token. Revisit if
   carrier-NAT collisions show up.
5. **Fail open when Redis is down.** Availability over strictness. Login still costs bcrypt.
6. **IPv6 keyed per /64.**
7. **429 message is English** (`Too many requests, try again in N s`). Mobile localises from
   `status === 429` and `retryAfter`, and the web shows the server message as it does for all
   errors.

## Open questions / things the owner should know

- **Backend port 4000 is published on the VPS host** (`docker-compose.yml` `"4000:4000"`).
  With `trust proxy 1`, a client reaching :4000 directly (bypassing nginx) can set
  `X-Forwarded-For` to rotate its apparent IP and evade per-IP limits. Per-user and per-nickname
  limits still hold. Fix: firewall 4000, or bind it to `127.0.0.1:4000:4000` (a B17 compose
  change, not done here).
- **Local dev and Maestro:** after merge, the owner's local backend enforces the defaults too.
  A Maestro suite that registers more than 3 accounts per hour from the simulator will hit 429.
  Set `THROTTLE_REGISTER_LIMIT=1000` (or `THROTTLE_ENABLED=false`) in `apps/backend/.env` locally.
- **Legacy smoke:** two runs within an hour against a throttled server trip `register` (each run
  creates 2 accounts). Clear `throttle:*` in Redis db 1 between runs, or start the server with
  `THROTTLE_REGISTER_LIMIT=1000`. Documented in `apps/backend/test/README.md`.
- **Per-nickname lockout is a griefing vector (inherent in "10/h/nickname").** Anyone who knows a
  nickname can send 11 wrong passwords (2-3 minutes from one IP, faster from several) and lock that
  account out of *new* logins for up to an hour, correct password included. Web users who are
  already logged in keep working (7-day JWT). Owner decision: keep as specified, shorten the
  nickname window, or let a correct password through the nickname limit while the IP limit still
  holds. Not changed here.
- **"The 6th login in a minute" (PLAN §5 exit criterion) is read as the 6th *failed* login.** See
  provisional decision 1. If the owner wants every login counted, drop `refund` from `login-ip`
  in `throttle.config.ts`; the golden scenario then needs `THROTTLE_LOGIN_IP_LIMIT` raised.
- Optional later: nginx `limit_req_zone` for `/api/auth/` as a second layer.
- I did not run `/code-review` in this session; please run it on the diff before opening the PR.

## Before / after merge

- **Before:** nothing (no env var, no migration, no `pg_dump` needed). Confirm B2's trust proxy
  works in prod first.
- **After:** merge `main` into `mobile`. Add `@RateLimit('refresh')` once B4 is on `main`. The new `deploy/nginx.conf` goes live through the normal deploy: the job already runs
  `docker compose --profile app up -d --force-recreate nginx` because the config is a bind-mount.
  No manual reload is needed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
