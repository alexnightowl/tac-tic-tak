# feat(backend): offline puzzle packs and result sync

Branch `api/offline`, cut from `main` (independent of the other api/* branches). Spec and contract:
`docs/mobile/OFFLINE.md` (owner request 2026-10-30). Additive: one new module, one new table, two
new routes. The rule files mirrored in `packages/core` (`unlock.ts`, `rating.ts`, `streak.ts`) are
untouched.

## What changed

- **Migration `20261029232412_offline_attempt_receipt`**: new table
  `OfflineAttemptReceipt(clientId PK, userId → User ON DELETE CASCADE, createdAt)` plus an index on
  `(userId, createdAt)`. `CREATE TABLE` + index + FK only; no existing table is altered.
- **`GET /api/offline/pack?kind=level|weak|mate|endgame|hard&style=bullet|blitz|rapid&count=1..150`**
  (JWT). Base = the style's `currentPuzzleRating`. Bands: level ±100, hard +150…+250, weak ±150 on
  the 3 weakest themes, mate ±200 on `mateIn1|2|3`, endgame ±150 on `endgame`. Same quality floor
  as the session buffer (popularity ≥ 95, plays ≥ 1000), random order. Excludes every puzzle in
  the user's `UserPuzzleHistory` and unresolved review queue. Default counts 50/30/40/40/30.
- **`POST /api/offline/sync`** (JWT, 200). Idempotent per `clientId` (receipt insert
  `ON CONFLICT DO NOTHING` inside the transaction, so concurrent retries cannot double-apply).
  Pack attempts, in `solvedAt` order, become one `TrainingSession` with `mode: "offline"`, are
  rated exactly like the online `attempt` handler (`computeRatingStep` over a sliding `WINDOW`
  of this batch + the correct-run multiplier, clamped 400–3000), upsert `UserPuzzleHistory`, and
  misses upsert `ReviewItem`. No unlock, demote, calibration or `startPuzzleRating` change.
  Correct review attempts resolve the item. Each distinct `localDay` within the last 3 days goes
  through the same `tickStreak` / `applyStreakOnPlay` path `finish` uses, ascending. Achievements
  are evaluated like `finish`.
- **Refactor for reuse (no behaviour change)**: `PuzzleBufferService.hydrate()` lifted out of
  `preload()`; exported `MIN_POPULARITY`/`MIN_PLAYS`, `WINDOW`/`MIN_RATING`/`MAX_RATING`,
  `META_THEME_SLUGS`; `SessionsService.tickStreak` and `styleProgression` made public and the
  service exported from `SessionsModule`.

### Decisions beyond OFFLINE.md

- `moves` in pack puzzles is a **string array**, the exact object `/next` serves
  (`{id, fen, moves[], rating, themes[], gameUrl}`); the doc example showed a space-joined string.
- Unknown puzzle ids are **skipped**, not rejected: the receipt is kept and they are counted in a
  new `unknownPuzzles` field, so one bad id never blocks the queue.
- `tzOffsetMin` is `Date#getTimezoneOffset()` (UTC − local, Kyiv summer = −180). "Within the last
  3 days" = local days today−3 … today; future days are ignored.
- The streak runs over every attempt in the batch, duplicates included (a no-op for counted days),
  so a retry heals a lost tick. Review attempts count for the streak too.
- `streak` carries the full `finish` shape plus `daysApplied`; when several days apply, `outcome`
  is the most significant (reset > frozen > continued > started > same-day; `skipped` when none).
- `solved/total/accuracy/timeMs/mistakesToReview` cover pack attempts only (the session);
  review results are in `reviewResolved`. A batch with no pack attempts returns `sessionId: null`.
- `weak` falls back to all-styles analytics if the style has no theme rows, drops meta themes
  (`short`, `middlegame`, …), and if there is still nothing it serves a mixed ±150 pack. The
  response adds `weakThemes`.
- Extra response fields: `style`, `unknownPuzzles`, `achievementsUnlocked`.

## Web impact

None in the API: no existing route, DTO or response shape changes. Offline sessions show up in the
web history/analytics with mode "offline" (`SessionList` prints `s.theme ?? s.mode`), and their
`durationSec` is the summed solve time. They count as finished sessions for achievements and
lifetime stats, like any other session.

## Local verification (docker Postgres 5433 / Redis 6380, branch backend on :4100)

- `tsc --noEmit -p apps/backend`: clean. Migration applied with `prisma migrate deploy`.
- Packs: all 5 kinds × 3 styles returned the default counts, ratings inside the bands, every mate
  puzzle carries `mateIn1-3`, every endgame `endgame`, every weak one of `weakThemes`; zero overlap
  with history or unresolved review; no duplicates. `count=1/150` ok, `151/0/abc` → 400, bad
  kind/style → 400, no token → 401. Latency 0.1–3.6 s (weak/mate in the dense 1100–1300 band).
- Sync, 16 attempts shuffled (12 pack over two local days, 1 correct + 1 wrong review, 1 unknown
  id, 1 in-batch duplicate): rating 1233 → 1316, matching an independent re-implementation in
  `solvedAt` order (payload order would give 1329); session row `mode=offline`, start/end =
  first/last `solvedAt`, attempts' `createdAt` = `solvedAt`; history +12; review +3 opened, 1
  resolved; `startPuzzleRating`/norm/calibration unchanged; streak 5 → 7 `continued`.
- Replay of the same batch: `duplicates: 16`, nothing written. Two concurrent identical batches: one
  session, the other `duplicates: 5`. Empty batch: zeros, streak `skipped`. Day 4+ days old: no
  streak tick; day 3 days old after a one-day gap: `frozen`. `tzOffsetMin=600` moves "today" correctly.
- `GET /api/sessions/:id` and `/review-items` render the offline session normally. Online
  create → next → discard and `GET /api/analytics` still work on the branch.
- The e2e user's state was restored afterwards.

## Prod checklist

- [ ] The deploy job dumps the DB before the migration (CI); the migration only adds a table.
- [ ] After deploy: web login, open history and a session, play a 1-min session and finish (GET-only
      smoke otherwise).
- [ ] `GET /api/offline/pack?kind=level&style=blitz&count=5` with a throwaway account returns 5 puzzles.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
