# B6 + B7: session lifecycle for mobile networks, abandoned-session sweeper (off by default)

Branch `api/session-lifecycle`, based on `api/test-harness` (B0). **Merge B0 first.** Three commits:

- `eb266ed` feat(backend): B6 session lifecycle for mobile networks
- `c5455aa` feat(backend): B7 abandoned-session sweeper behind SESSION_SWEEPER_ENABLED
- `4cdb1e4` fix(backend): includeNext never fails a committed attempt (verifier pass)

## What and why

Mobile has flaky networks, backgrounding and app kills (PLAN §2.10). Today a retried `/attempt` records the attempt twice and steps the rating twice, and a retried `/next` loses a puzzle. Abandoned sessions also stay unfinished forever, and their Redis keys never expire. Everything in B6 is opt-in through new optional fields. The web sends none of them.

### B6 (all under `/api/sessions`)

| Change | Contract |
|---|---|
| Idempotent attempt | Optional `clientAttemptId` on the attempt body (8–64 chars of `A-Za-z0-9_-`, e.g. a UUID). The first request records the attempt and steps the rating. Every replay within 24 h, concurrent or later, gets the first response body back verbatim (byte-identical), even after the session is finished. A unique column `TrainingAttempt.clientAttemptId` backs this up when the cache is gone: no second row and no second step; the body is rebuilt with `step: 0`. Reusing the key on a different session → 409 `clientAttemptId already used`. |
| `includeNext` | Optional `includeNext: true` on the attempt body adds `next`: the `/next` response, served after the rating step, or `null` if it could not be served (no puzzles, session ended, or a transient Redis/DB error, which is logged). On `null` the client calls `/next` itself, which reports the real error. A failure to serve `next` never turns the attempt into a 500, because the attempt is already recorded and the rating stepped. It is part of the cached body, so a replay returns the same `next` and pops nothing. |
| `/next` replay | Optional body `{requestId}`. The same `requestId` returns the same response (same puzzle) for 5 min. A body-less `/next` (the web) still pops every time. |
| `responseMs` | Max raised from 600 000 to 3 600 000 (relaxing only). |
| `serverNow` | ISO timestamp added to the `POST /sessions` and `/next` responses, but **only when the body has `client: 'mobile'`** (also inside `next` of an attempt with `client: 'mobile'`). |
| `GET /sessions/active` | New route. Returns `{session: {id, mode, style, theme, startRating, durationSec, startedAt, lastActivityAt, attempts, solved, failed, currentRating} \| null, serverNow}`: the caller's latest unfinished session. It reports no "remaining" time, because the server cannot know paused time (PLAN §2.10: Finish / Discard only). |
| finish `tz` | Optional `?tz=Europe/Kyiv`. A real IANA zone is stored in the new nullable `User.timezone`. When `localDate` is missing or malformed, the streak day is computed in that zone. An explicit valid `localDate` always wins. An invalid `tz` is silently ignored. |
| finish `progression` | `?client=mobile` adds `progression: {style, startPuzzleRating, currentPuzzleRating, unlockedStartRating, calibrationSessionsLeft, weakSessionStreak}`: the style's row after this finish, the same shape as `/users/me` `progressions[style]`. It covers saved, already-finished and discarded sessions. |
| Redis hygiene | `session:{sid}:queue` and `:seen` get `EXPIRE durationSec + 24 h`, refreshed on every serve and on every preload. `user:{uid}:recent` drops entries older than 30 days (`ZREMRANGEBYSCORE`) on every serve. `DELETE /sessions/:id` also deletes the buffer keys. The replay caches are `session:{sid}:attempt:{cid}` (24 h) and `session:{sid}:next:{rid}` (5 min). Their locks are `…:lock`, set with `PX`, and released by compare-and-delete. |

### B7 sweeper (`src/sessions/session-sweeper.service.ts`)

- **Schedule.** Runs every 10 min through `@nestjs/schedule` (`SchedulerRegistry.addInterval`).
- **Lock.** Takes the Redis lock `SET lock:session-sweeper <token> NX PX 9min`. If another instance holds it, the run is skipped.
- **Candidates.** Sessions with `endedAt IS NULL` whose **last activity** (latest attempt `createdAt`, else `startedAt`) is older than 12 h. It handles up to 20 batches of 100 per run.
- **Policy (PROVISIONAL, PLAN §8 #10):**
  - 0 attempts: delete the session.
  - Otherwise: save it as an early exit. Stats are derived with the production `deriveSessionStats`, and `endedAt` is set to the last activity. Nothing else changes: no unlock, demote or calibration change, no streak tick, and no achievement evaluation (the next real finish evaluates achievements and toasts them as usual). The per-attempt rating drift already applied stays, as with the web's own early exit. Review items stay.
  - Both cases clear the session's Redis buffer.
- **Race safety.** `deleteMany` / `updateMany` re-check "still unfinished and still idle". A finish or an attempt that races the sweeper wins.
- **Off by default.** The interval is registered only when `SESSION_SWEEPER_ENABLED=true` (or `1`). With the flag unset, which is prod after merge, no timer exists at all.

## WEB IMPACT

**None that the web can observe in its requests or responses.** The web sends none of `clientAttemptId`, `includeNext`, `requestId`, `client`, `tz`. `ValidationPipe({whitelist: true})` keeps stripping unknown fields. All new response fields are gated on `client: 'mobile'` or on a new route, so web response bodies are byte-identical: same keys, same key order.

Proof:
- **Web-contract golden (117 web requests):** green and **unchanged**. No snapshot was updated.
- **Rating transcript golden (11 scripted sessions):** green and **unchanged**.
- **Legacy smoke:** `tools/contract/legacy-smoke.ts`, pristine `origin/main` (b25dbd3) on :4160 against this branch on :4161, both on `taktic_test` *with this branch's migration applied*: identical status codes, shapes and messages on all 117 steps, 3 runs in a row. This also shows that the **old code runs fine on the migrated schema**, which is the rollback case.
- **Rating equivalence:** a new e2e test plays the same 7-move script once the web way and once the mobile way (`requestId`, `clientAttemptId` with a retry of every attempt, `includeNext`, `tz`, `client=mobile`). Its per-attempt `step/newRating/streak`, puzzle order and finish payload equal the web run exactly.

Server-side behaviour changes that a web user could only notice indirectly:
1. **`user:{uid}:recent` trimmed to 30 days.**
   - Before: a player active at least every 30 days kept every served puzzle in the zset forever (the key TTL was refreshed on each serve). That excluded those puzzles from selection for good.
   - Now: puzzles served more than 30 days ago can be picked again. This matches the documented intent ("recent = 30 days", `RECENT_TTL_S`) and bounds a zset that is read whole on every preload. Rating rules are unaffected.
2. **Redis TTL on queue and seen.** A web session left idle for more than `durationSec` + 24 h after its last served puzzle loses its prefetched queue and its seen set. The next `/next` re-preloads, and the 30-day recent set still excludes repeats.
3. **`responseMs` up to 1 h.** An attempt with 10 min < `responseMs` ≤ 1 h now gets 201 instead of 400. This only relaxes the validator.
4. **`DELETE /sessions/:id`** now also deletes the Redis buffer. The response is unchanged.
5. **`GET /sessions/active`** used to fall into `GET /sessions/:id` (404 `session not found`). The web never calls it.
6. **B7 (only when enabled):** orphaned web sessions become finished early-exit rows, so they show up in recent-session lists, analytics and the public profile. Sessions with 0 attempts disappear.

## Migration `20261025120000_session_lifecycle` (additive)

```sql
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;
ALTER TABLE "TrainingAttempt" ADD COLUMN "clientAttemptId" TEXT;
CREATE UNIQUE INDEX "TrainingAttempt_clientAttemptId_key" ON "TrainingAttempt"("clientAttemptId");
```

- Both columns are nullable, with no default, no backfill and no rewrite. Postgres allows any number of NULLs under a unique index.
- `CREATE UNIQUE INDEX` (not `CONCURRENTLY`, because Prisma runs plain SQL) takes a lock that blocks writes to `TrainingAttempt` while it scans the table. Every value is NULL, so the build should take well under a second at the current size. Check the row count first (checklist below).
- `prisma migrate diff` from the migrated test DB to `schema.prisma` reports no difference.

## How it was tested

`pnpm --filter backend test`: **9 suites, 56 tests, 20 snapshots, all green.** Before this branch it was 5 suites, 29 tests and the same 20 snapshots, unchanged.

New `test/e2e/session-lifecycle.e2e-spec.ts` (17 tests):
- **Same `clientAttemptId`, 5 concurrent posts plus a later replay:**
  - exactly 1 row (`SELECT count(*) … WHERE "clientAttemptId" = $1`) and 1 attempt in the session;
  - one rating step, and the DB rating equals the body;
  - all 6 bodies identical, `next` included;
  - the queue popped exactly once for `next`;
  - the replay still returns the same body after finish;
  - a new key on the finished session gets the web's 400 `session ended`.
- **Mutation check:** with the lock disabled the test fails (5 distinct bodies), so it really exercises concurrency.
- **Attempt variants:**
  - `includeNext` with a transient error serving `next`: 201 with the real step and `next: null`, and the retry gets the same body (fails with a 500 without the fix);
  - cache lost: no second row and `step: 0`;
  - key reused on another session: 409;
  - validation messages for the new fields;
  - `responseMs` 3 600 000 accepted and 3 600 001 rejected;
  - without `includeNext`, exactly the web keys.
- **`/next` with `requestId`:**
  - 3 concurrent posts plus 1 later replay: the same puzzle, popped once, with a TTL of at most 300 s;
  - a new `requestId` serves the next puzzle;
  - the body-less web `/next` still pops every time;
  - a malformed `requestId` gets 400.
- **`serverNow`:** present only with `client: 'mobile'`, on both create and next.
- **`GET /sessions/active`:**
  - `null` → the latest session, with the exact payload → the older one after a discard → `null`;
  - another user's session is never shown;
  - 401 without a token.
- **finish:**
  - `tz` is stored, and the streak day is computed in it;
  - an invalid `tz` is ignored (streak `null`, as on the web today);
  - an explicit `localDate` wins over `tz`;
  - `progression` matches the DB row for saved, already-finished and discarded sessions.
- **Redis:**
  - every `session:{sid}:*` key has TTL > 0, with no leftover locks;
  - queue and seen TTL equal `durationSec` + 86 400;
  - a cold preload also gets the TTL;
  - recent entries older than 30 days are trimmed and newer ones kept;
  - DELETE removes the queue and seen keys.
- **Rating equivalence,** mobile flow against web flow (above).

New `test/e2e/session-sweeper.e2e-spec.ts` (5 tests):
- **Not scheduled** when the flag is unset. `SESSION_SWEEPER_ENABLED=true` registers the `session-sweeper` interval, and it is removed on close.
- **Seeded policy run** → `{deleted: 1, finalized: 1, failed: 0}`:
  - the 0-attempt idle session and its Redis keys are deleted;
  - the idle session with attempts is saved with the derived stats, `endedAt` = last attempt and its Redis keys cleared;
  - progression rows are unchanged (calibration 3, weak streak 1, ceiling 1250), the user's streak fields are unchanged, no achievements are created and review items are kept;
  - untouched: a session started 13 h ago with an attempt 1 h ago, a session started 1 h ago, and an already-finished one;
  - `GET /sessions/:id` shows the swept session, and `finish` returns its summary (with `progression` for mobile);
  - `/sessions/active` shows the remaining live session;
  - a second sweep is a no-op.
- **Lock:** while another holder has the Redis lock, the sweep returns `null` and changes nothing, and the foreign lock is left alone. Two concurrent sweeps: one runs, the other skips.

Unit tests: `test/unit/session-lifecycle.spec.ts` (tz validation and local day across DST and date lines, key TTL) and `test/unit/session-sweeper.spec.ts` (flag parsing).

Other checks, all green:
- backend `prisma generate`, `typecheck`, `typecheck:test`, `build`;
- `pnpm --filter frontend typecheck`;
- `pnpm -r run typecheck`.

Not done: a browser run of the local web against this backend. The legacy smoke replays every request shape the web sends, but no frontend dev server was started, so the owner's :3000 / :4000 stay untouched.

## Dependency

`@nestjs/schedule` **4.1.2**, pinned exactly because the backend Dockerfile installs without the lockfile. Its peer range covers Nest 10. It pulls in `cron` 3.2.1, `luxon` 3.5.0 and `uuid` 11.0.3. I added it with pnpm in the worktree (it was in the offline store). `pnpm-lock.yaml` only gains entries.

## Prod verification checklist (after merge and deploy)

- [ ] **Before deploy:** `pg_dump` (first migration in this series, if B4 has not already shipped one). Optional read-only size check: `SELECT count(*) FROM "TrainingAttempt";`.
- [ ] The deploy log shows `20261025120000_session_lifecycle` applied, and the backend container is healthy.
- [ ] Spot-check the web: log in, play a 1-min session, finish, open the summary and the session detail. Discard a session. Delete a session from the list.
- [ ] GET-only smoke with a throwaway account:
  - `GET /api/sessions/active` returns `{"session":null,"serverNow":"…"}`, or the account's open session;
  - `GET /api/users/me` is unchanged.
- [ ] The backend log has **no** `session sweeper enabled` line, which confirms B7 is inactive.
- [ ] Optional, read-only, to size B7 before enabling it (the number of orphans the first sweep would finalise or delete):
  ```sql
  SELECT count(*) FILTER (WHERE n = 0) AS would_delete, count(*) FILTER (WHERE n > 0) AS would_save
  FROM (
    SELECT s.id, count(a.id) AS n, greatest(s."startedAt", max(a."createdAt")) AS last
    FROM "TrainingSession" s LEFT JOIN "TrainingAttempt" a ON a."sessionId" = s.id
    WHERE s."endedAt" IS NULL GROUP BY s.id
  ) x WHERE last < now() - interval '12 hours';
  ```

## Enabling the sweeper (owner, after answering PLAN §8 #10)

1. Confirm or adjust the policy in `docs/mobile/OWNER-QUESTIONS.md`.
2. Add `SESSION_SWEEPER_ENABLED: ${SESSION_SWEEPER_ENABLED:-false}` under `backend.environment` in `docker-compose.yml`. That file is outside agent scope, so this goes in an owner edit or the B17 ops PR.
3. Set `SESSION_SWEEPER_ENABLED=true` in the VPS root `.env`, then redeploy.
4. The log should show `session sweeper enabled: every 10 min, idle > 12 h`. Within about 10 min it should also show `swept abandoned sessions: N deleted, M saved as early exit, 0 failed`.

## Rollback

- **Code:** revert the two commits. The old code runs on the migrated schema: the legacy smoke ran `origin/main` against the migrated DB. The new columns stay unused and harmless. Leftover Redis keys expire on their own (24 h and 5 min caches, queue/seen TTLs).
- **B7 only:** set `SESSION_SWEEPER_ENABLED=false` (or remove it) and redeploy. Sessions it already finalised stay finished; restoring them would need the `pg_dump`. Sessions it deleted had 0 attempts.
- **Schema:** no down-migration is needed or planned. If one were ever required (not before B18): `DROP INDEX "TrainingAttempt_clientAttemptId_key"; ALTER TABLE "TrainingAttempt" DROP COLUMN "clientAttemptId"; ALTER TABLE "User" DROP COLUMN "timezone";`.

## Owner decisions taken provisionally

1. **Sweeper policy (PLAN §8 #10)** as the default: idle more than 12 h on last activity; 0 attempts → delete; otherwise early exit with no progression change and no streak tick. **Also no achievement evaluation**, so achievements are not unlocked silently without a toast. `endedAt` is set to the last activity, not the sweep time. Merged **disabled**.
2. **New response fields are gated on `client: 'mobile'`** (`serverNow`, `progression`), not always added. This keeps web bodies byte-identical and both goldens unchanged. Mobile must send `client: 'mobile'` on create, next and attempt bodies, and `client=mobile` on the finish query.
3. **`tz` and `client` on finish are query params**, like the existing `save` / `localDate`. Finish has no body.
4. **A replay returns the first body verbatim,** including its original `serverNow` and `next`, whatever flags the replay itself carries. Byte-identity wins over freshness.
5. **Cache-lost replay** (more than 24 h, or Redis lost the cache) answers 201 with `step: 0`, the current rating and the recomputed streak, rather than an error.
6. **`/sessions/active`** returns only the latest unfinished session (not a list), always with 200 (`session: null` when there is none).
7. **The `tz` is stored as sent** if the runtime knows the zone (not ICU-canonicalised, so `Europe/Kyiv` stays `Europe/Kyiv`). Fixed offsets (`+02:00`) are rejected.

## Independent verification (second agent)

- Re-ran backend `prisma generate`, `typecheck`, `typecheck:test`, `build`, `pnpm --filter frontend typecheck`, and `pnpm --filter backend test` (9 suites, 56 tests, 20 snapshots, green twice in a row when no other branch's jest was running on `taktic_test`; see risks).
- Read the full diff against `origin/api/test-harness`. Migration is additive, every new DTO field is `@IsOptional`, no validator was tightened, no secrets, all new response fields are gated on `client: 'mobile'` or on the new route.
- Ran pristine `origin/main` (b25dbd3) on :4170 and this branch on :4171, both on `taktic_test` + Redis db 1: legacy smoke identical on all 117 steps (twice). A separate curl replay of the web's own session flow (register, login, `/users/me`, create, attempt, body-less `/next` with and without `Content-Type`, validation errors, finish with `localDate`, double finish, `/next` after finish, detail, review-items, discard, theme create, DELETE, 404 DELETE) gave identical status codes and identical key order on both servers. The only difference is `GET /sessions/active` (404 on main, 200 on the branch), a route the web never calls.
- Mobile flow over real HTTP with curl: 5 concurrent identical attempts → 5×201, 1 distinct body, 1 row (`psql`), rating 1200 → 1217 once; same `requestId` → identical `/next` bodies; TTLs queue/seen 86 520 s (120 + 86 400), attempt cache 86 400 s, next cache 300 s; finish with `tz` stored `Europe/Kyiv` and returned `progression`; replay after finish identical; only the two replay caches remain after finish.
- Built the backend Docker image from a clean `git archive` of the branch with the unchanged Dockerfile: the lockfile-less install pulls `@nestjs/schedule` 4.1.2, the image boots, `prisma migrate deploy` reports nothing pending on the migrated test DB, and there is no `session sweeper enabled` log line.

## Residual risks and open questions

1. **Finishing a stale session from `/sessions/active` counts as a full-duration finish.** `finish` decides "early exit" from server wall time (`now - startedAt < durationSec - 3`). A session abandoned days ago and finished with Finish (save) from the `/sessions/active` card is therefore *not* early. It runs unlock / demote / calibration on a handful of attempts and ticks today's streak. While the sweeper is off (the prod default), `/sessions/active` can surface such sessions, including old orphaned web sessions. Suggested before Phase 5 wires the resume card: on mobile, treat a session whose last activity is older than its `durationSec` as Discard-or-summary only, or add a server rule keyed on `client=mobile` that finishes such sessions as early exits. Owner decision.
2. **Two different 409s.** `clientAttemptId already used` is permanent, while `duplicate request still in progress` (a duplicate waited more than 10 s for the first request) is retryable. The mobile outbox can tell them apart only by `message`.
3. **Pre-existing Redis keys keep no TTL.** Only keys written after deploy get `EXPIRE`. Orphaned `session:*:queue|seen` keys already in prod Redis stay until touched. An optional one-off cleanup (owner, on the VPS, after deploy) gives them a TTL instead of deleting them, so live sessions are unaffected (their TTL is refreshed on the next serve): `redis-cli --scan --pattern 'session:*' | while read k; do redis-cli expire "$k" 90000 nx >/dev/null; done` (`NX` needs Redis 7; on older Redis drop it).
4. **Migration timestamps across branches.** `api/auth-refresh` adds `20261025070514_auth_refresh_tokens`, which sorts *before* this branch's `20261025120000_session_lifecycle`. If this branch deploys first, `prisma migrate deploy` still applies the older-named one later (they touch different columns), but both branches edit `model User` in `schema.prisma`, so expect a trivial text conflict on the second merge.
5. **Shared `taktic_test`.** Other branches' e2e runs `TRUNCATE` the same DB and `FLUSHDB` Redis db 1. Running two branches' suites at once makes both fail spuriously (seen during verification). Run them one at a time.
6. The sweeper's candidate query has no index on `endedAt`. That is fine at today's size, but it is a scan every 10 minutes once enabled.

## Notes for other branches

- The mobile client (`packages/core/src/api` on `mobile`) does not send any of the new fields yet. Phase 5 wires `clientAttemptId`, `requestId`, `includeNext`, `client: 'mobile'` and `tz` into the outbox and runner.
- The shared `taktic_test` DB now has this migration applied. Other branches' `migrate deploy` only sees an extra applied migration, and the extra nullable columns do not affect their tests.
