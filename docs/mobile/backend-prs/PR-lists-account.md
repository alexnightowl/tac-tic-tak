# feat(backend): B9 lists + B10 account deletion

Branch `api/lists-account`, based on `api/test-harness` (B0). **Merge B0 first.**

## What and why

PLAN §4 B9 and B10, needed by mobile Phase 6 (history, review cards) and Phase 9 (account
deletion, which the App Store and Google Play require).

### B9: lists

- **`GET /api/sessions?cursor=&limit=&style=`** (new route; `/api/v1/sessions` too once B2's
  versioning is on `main`).
  - Returns the caller's **finished** sessions (`endedAt` set), sorted `startedAt desc, id desc`.
  - Response: `{ items: SessionRow[], nextCursor: string | null }`. Each row has the same fields
    and values as `/analytics` `recentSessions` (`id, startedAt, solved, failed, accuracy,
    avgResponseMs, peakRating, startRating, durationSec, mode, style, theme`), plus `endedAt`.
  - Pagination is keyset, not offset. `nextCursor` is an opaque base64url token built from the
    last row's `(startedAt, id)`, so rows that are finished or deleted while the user scrolls are
    never repeated or skipped. `nextCursor` is `null` on the last page.
  - `limit`: default 20, range 1–50. `style`: `bullet|blitz|rapid`; leave it out for all styles.
  - Validation is strict because the route is new: a bad `limit`, an unknown `style` or a
    malformed `cursor` returns 400. The existing indexes `(userId, startedAt)` and
    `(userId, style, startedAt)` cover the query.
- **`GET /review/themes`** adds **`firstPuzzleId`** to each row (additive).
  - It is exactly the first item that `GET /review?theme={slug}` returns: lowest rating, with
    ties in queue order.
  - Mobile cards can link straight to `/review/{firstPuzzleId}?theme={slug}`. That replaces the
    web's N+1 pattern of one list request per card.
  - To make "first" well defined, both `list()` and `themes()` now read with
    `orderBy: [createdAt asc, id asc]`. The rating sort is stable, so this only fixes the order of
    equal-rating items, which used to be Postgres heap order (undefined).
- **`POST /review/:puzzleId/resolve` is idempotent.**
  - It uses `updateMany({ userId, puzzleId, resolvedAt: null })`, so only the first call stamps
    `resolvedAt`.
  - Repeated or concurrent calls get the same `201 { ok: true }` and keep the first timestamp.
  - A puzzle that was never in the caller's queue now gets **404 `not in review queue`**, the same
    message as `GET /review/:puzzleId`. Before, Prisma's P2025 error surfaced as a **500**.

### B10: account deletion

- **`DELETE /api/users/me`** with body `{ password }` (new route; `/api/v1/users/me` after B2).
  - Needs the JWT. A missing password gets 400, a wrong password gets **403
    `password is incorrect`**, and success gets **204** with an empty body.
  - The password DTO only checks that it is a string, like `LoginDto`. Old or admin-set passwords
    may not meet today's rules, and that must not block a deletion.
- **Rows.** It deletes the `User` row. Every foreign key to `"User"` is `ON DELETE CASCADE`
  (checked in the schema and in `pg_constraint`), so that one delete removes everything that
  belongs to the user:
  - `UserSetting`, `UserProgression` and `UserStyleProgression`;
  - `TrainingSession` and `TrainingAttempt`;
  - `UserPuzzleHistory` and `ReviewItem`;
  - `Friendship`, both as requester and as addressee;
  - `UserAchievement`.

  No relation lacked a cascade, so no explicit deletes were needed. It uses `deleteMany`, so a
  concurrent duplicate request is not an error.
- **Files and Redis.** After the row is gone, the server removes:
  - every `uploads/avatars/{id}.*` file;
  - the user's Redis buffer keys: `user:{id}:recent`, plus `session:{sid}:queue` and `:seen` for
    the user's unfinished sessions (finish already clears them for finished ones).

  This cleanup is best-effort. A failure is logged and never turns a completed deletion into an
  error.
- **Afterwards.** The old token keeps hitting the deleted-user paths that already exist: `GET
  /users/me` returns 404 (the frozen B0 quirk), and the access token stays valid until it expires.
  The nickname is free to register again.
  - Known residual (pre-existing, same as after `DELETE /api/admin/users/:id` on `main`): a
    *write* with the stale token returns **500**, not 401, because the JWT strategy does not
    check that the user exists. Verified locally: `POST /api/sessions` and
    `PATCH /api/users/me/settings` both give 500 after the 204; `GET /api/sessions` gives
    `{items:[],nextCursor:null}`. That matters when the same account is still signed in on
    another device (for example a web tab). Mobile drops its tokens on the 204. The real fix
    belongs in B4's JwtStrategy `tv` check: treat a missing user as revoked (401). Today B4's
    check accepts a token when the user row is gone.
- **Refresh tokens and push devices (B4/B15).** Those models are not on `main` yet. When they
  land, they **must** use `onDelete: Cascade` on `userId`, or add an explicit delete in
  `UsersService.deleteAccount`. The new e2e test reads every foreign key to `"User"` from
  `pg_constraint` and fails if any of them does not cascade. It also checks that every
  user-scoped table is empty for the deleted user. So B4 (`RefreshToken`) and B15 (`PushDevice`,
  `NotificationLog`) are covered automatically as soon as they rebase onto this branch, and a
  model without a cascade fails CI. If B4 lands first, also revoke the refresh-token families
  explicitly. Rows that cascade away are revoked in effect, but the refresh endpoint must treat a
  missing user as revoked.

## WEB IMPACT

- **No change to any request the web sends, except two additive or error-path changes.** The
  legacy smoke (pristine `origin/main` build against this branch, same DB and Redis) replays all
  117 web requests. It found **exactly one difference**, which is intended:

  ```
  #59 review themes [GET /review/themes]: shape
    base:    [{"count":"number","minRating":"number","slug":"string"}]
    compare: [{"count":"number","firstPuzzleId":"string","minRating":"number","slug":"string"}]
  ```

  The other 116 steps have identical status codes, shapes and messages. The web's
  `ReviewTheme` type does not read `firstPuzzleId`, and extra JSON keys are ignored.
- **Golden snapshot updated explicitly** (`web-contract.e2e-spec.ts.snap`): one line,
  `+ "firstPuzzleId": "string"`, in the `review themes` step. Nothing else changed. The rating
  transcript snapshot is byte-identical.
- **`POST /review/:id/resolve`** returns the same `201 {ok:true}` for the web's only call path,
  which is resolving a queued puzzle after solving it.
  - A repeat call used to re-stamp `resolvedAt`; now it keeps the first value. Nothing reads that
    value except the "is it null" check.
  - A never-queued puzzle used to get a 500 and now gets a 404. The web wraps resolve in
    `try/catch` and ignores errors, so nothing visible changes. This is the PLAN B2 "P2025 → 404"
    class of change, done locally.
- **`GET /review?theme=`**: items with equal ratings now come in a fixed order (queue order)
  instead of an undefined one. Shapes and values are unchanged.
- **New routes** `GET /sessions` and `DELETE /users/me` were 404 before. The web never calls them.
- **Migrations: none.** There are no schema changes and no env vars.

## How it was tested

- New `apps/backend/test/e2e/lists-account.e2e-spec.ts` (14 tests):
  - **`GET /sessions`**:
    - 50 finished sessions page as 20/20/10 in exact `startedAt desc, id desc` order, with no
      gaps or repeats;
    - two sessions share a `startedAt`, and a page break placed exactly between them neither drops
      nor repeats one;
    - the default page size is 20;
    - the `style` filter works for each style, paginated with `limit=7`;
    - rows match `/analytics` `recentSessions` values, plus `endedAt`;
    - an empty user gets `{items:[], nextCursor:null}`;
    - live sessions and other users' sessions are never listed;
    - another user's cursor only narrows the caller's own rows;
    - 400 for `limit` 0, 51, `abc` and `2.5`, for an unknown style and for three malformed
      cursors; 401 without a token.
  - **`firstPuzzleId`**:
    - for every theme row it equals `GET /review?theme={slug}[0].puzzleId`, and that puzzle's
      rating is `minRating`;
    - a resolved item with a lower rating is ignored;
    - for the equal-rating fork pair (`00Aas` and `005nD`, both 1111) the one queued first wins;
    - after resolving, `firstPuzzleId` moves to the next puzzle.
  - **Resolve**:
    - called twice, both return `201 {ok:true}` and `resolvedAt` is unchanged after the second;
    - two concurrent duplicates both get 201;
    - an item that was already resolved earlier keeps its original timestamp;
    - a never-queued or unknown puzzle gets 404 `not in review queue`;
    - another user's queued item cannot be resolved and stays unresolved.
  - **`DELETE /users/me`**:
    - every foreign key to `"User"` is `ON DELETE CASCADE`, read from `pg_constraint`;
    - 401 without a token, 400 without a password, 403 with a wrong password, and after the 403
      the user still exists and can log in;
    - on the 204 path:
      - the setup gives every user-scoped table at least one row for the victim (all 10 FK
        columns, checked before the delete);
      - after the delete, all of them are 0, the `User` row is gone, the `.png` and `.webp`
        avatars are unlinked and the Redis `user:{id}:recent` and `session:{sid}:queue`/`:seen`
        keys are deleted;
      - other users keep their own rows and avatar, and only their friendship rows with the
        victim are removed;
      - the old token then gets 404 on `/users/me` and on a second DELETE, login gets 401, and
        the nickname can be registered again.
- `pnpm --filter backend test` gives 6 suites and 43 tests (29 from B0 plus 14 new), with 20
  snapshots, all green three runs in a row. The golden web-contract and rating transcript tests
  pass; only the documented `firstPuzzleId` line changed.
- `pnpm --filter backend exec prisma generate`, `typecheck`, `typecheck:test` and `build` pass, and
  so does `pnpm --filter frontend typecheck`.
- Legacy smoke: `origin/main` (b25dbd3, built in a clean detached worktree) on :4120 against this
  branch on :4121, both on the same test DB and Redis index. Two runs both reported only the
  single `firstPuzzleId` difference above.
- **Test DB note.** Several `api/*` agents ran e2e suites at the same time, and they truncate the
  same `taktic_test` and Redis db 1. That broke a run with foreign rows (`Unique constraint failed
  on nickname`). So this branch's runs used the harness's documented overrides:
  `TEST_DATABASE_URL=postgresql://taktic:taktic@localhost:5433/taktic_lists_test?schema=public`
  and `TEST_REDIS_URL=redis://localhost:6380/9`. That is a dedicated local `*_test` DB, which I
  created, and the guards accept it. The defaults in the harness are unchanged.

## Prod verification checklist (after merge and deploy)

GET-only, with a throwaway account (never `.claude-test-account`):

- [ ] `curl -s -o /dev/null -w '%{http_code}' https://tactictak.online/api/sessions` returns `401`
      (the route exists and is guarded; it was 404 before).
- [ ] With the throwaway token: `GET /api/sessions?limit=5` returns `200 {items, nextCursor}`.
      Following `nextCursor` gives the next page, and `GET /api/sessions?limit=0` returns 400.
- [ ] `GET /api/review/themes` returns `[]` or rows with `firstPuzzleId` (an account with review
      items needs a played session; skip that unless the owner approves POSTs).
- [ ] Web spot-check: the review landing still lists theme cards, a drill resolves and advances,
      and the dashboard history still shows the latest sessions.
- [ ] Do not run `DELETE /api/users/me` on prod except on the throwaway account, and only with the
      owner's approval (it is a mutating call). If approved: it returns 204, and then login
      returns 401. If the throwaway account had an avatar, check (owner, on the VPS) that
      `uploads/avatars/{id}.*` is gone. That confirms the container's working directory is the
      same as the avatar upload path.
- [ ] `curl -s -o /dev/null -w '%{http_code}' -X DELETE https://tactictak.online/api/users/me`
      returns `401` (the route exists and is guarded; it was 404 before). This needs no account.
- [ ] Backend container logs for the first hour after deploy: no new `ERROR` lines from
      `ReviewService`, `SessionsService` or `UsersService`.
- [ ] If B2 (URI versioning) is already deployed: `GET /api/v1/sessions` also returns 401
      without a token.

## Rollback

There is no migration and no data shape change, so reverting the merge commit is enough. Deleted
accounts cannot be restored (by design). Before rollback, the only persistent effect of this PR is
deleted rows from user-requested deletions.

## Owner decisions taken provisionally

1. **`resolve` on a never-queued puzzle returns 404** (`not in review queue`), not a silent
   `201 ok`. It used to be a 500. The mobile mistakes runner will resolve the global queue
   (PLAN §8 #14), but "slow" solves are not `ReviewItem`s, so the client must ignore a 404 from
   resolve. Alternative: answer `201 {ok:true}` for unknown items too.
2. **Resolve keeps status 201**, Nest's POST default, which the web golden freezes. The task asked
   for "200 both", which I read as "success both times". Switching to 200 would change a web
   status code.
3. **The `GET /sessions` row shape** is the `/analytics` `recentSessions` row plus `endedAt`.
   Limits are default 20 and max 50. Validation is strict (400), unlike the leaderboard, which
   clamps silently.
4. **Account deletion has no grace period or soft delete.** It is immediate and permanent, and an
   admin may delete their own account here (`/admin` forbids self-delete only to avoid locking the
   operator out).
5. **The wrong-password status on DELETE is 403**, the same as B5's change-password fix, so mobile
   handles one rule ("403 from a password form is a form error, never expiry").

## Follow-ups (not in this PR)

- `DELETE /api/admin/users/:id` still leaves the avatar file behind. It could reuse
  `deleteAccount`'s cleanup.
- B4 and B15: see the cascade note above. The FK-cascade e2e test enforces it. On
  `api/auth-refresh` (5e616bd), `RefreshToken.user` already has `onDelete: Cascade`.
- B11 throttling: also rate-limit `DELETE /users/me`. A stolen access token plus a password guess
  is enough to delete an account. The B11 list in PLAN §4 does not name this route yet.
- Merge conflicts: `api/session-lifecycle` (B6) touches `sessions/dto.ts`,
  `sessions.controller.ts` and `sessions.service.ts` too (`git merge-tree` reports conflicts in
  all three). Both sides add code, so resolving means keeping both. Whichever branch merges
  second rebases on the first and re-runs the suite. `api/auth-refresh`, `api/bootstrap` and
  `api/ci` merge cleanly with this branch.
- Mobile client note (branch `mobile`): `client.del(path, o)` has no body parameter, so Phase 9
  must pass `{ password }` through the request options body. Its 204 handling (`return
  undefined`) already fits this route.
- The Play Store web deletion page (`/delete-account`) is B16.
- `apps/backend/test/README.md` could recommend a per-branch `TEST_DATABASE_URL` and
  `TEST_REDIS_URL` when several worktrees run e2e at the same time.

## Before and after merge (owner)

- Merge **B0 (`api/test-harness`) first**. This branch is stacked on it, so after B0 merges the PR
  diff is only this change.
- No env vars, no migration, no `pg_dump` needed for this PR.
- After merge: merge `main` into `mobile`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
