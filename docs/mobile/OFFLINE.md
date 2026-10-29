# Offline puzzles: feature spec and API contract

Owner request (2026-10-30). Players download puzzles ahead of time and solve them without internet.
Every unresolved Review puzzle is kept on the phone automatically. The design lives in the canvas
"New: modes & social" page, section "Offline mode": `OfflinePacks`, `OfflineSolve`, `OfflineSync`.

Owner decisions:
- **Rated, as designed.** The rating is frozen while offline and catches up on sync, applied in the
  order the puzzles were solved. The norm (level-up / demote) never moves from offline play.
- **Streak.** Offline days count if they sync within 3 days.
- **Mistakes** go to Review.
- **Deploy.** The agent merges and deploys the backend change itself (the CI dumps the DB before migrations).

## Behaviour

- **Packs.** The screen opens from the Play tab and lists:
  - **Your level · mixed:** 50 puzzles around the current rating of the selected style. This is the auto pack, kept topped up when "Keep topped up on Wi-Fi" is on.
  - **Your weak spots:** 30 puzzles from the player's 3 weakest themes.
  - **Mate patterns:** 40 puzzles, mate in 1–3.
  - **Endgame technique:** 40 puzzles.
  - **Hard mode · +200:** 30 puzzles.
  - **Review:** every unresolved review puzzle, always kept, refreshed whenever the app is online. It is listed as automatic and can't be removed.
  - Each row shows its state: Get / downloading % / Saved (tap to remove).
  - The header shows the puzzles on the phone and the storage they use.
- **Solving.** It works with or without network.
  - The runner shows an OFFLINE chip, the pack name with "n of N", and the frozen rating with a `*`.
  - It also shows "N results waiting to sync", plus Hint and Skip. Using either counts the puzzle as missed.
  - Results are queued locally with a client id, the time solved and the local day.
- **Sync.** When the app is online and the queue is not empty (on app start, when the app returns to the foreground, or when the network comes back), it posts the queue.
  - The "Welcome back" summary shows the rating caught up (before → after, delta), solved / accuracy / time, whether the streak was kept, mistakes sent to Review, and puzzles left on the phone.
  - Buttons: "Refill to 50" and "Review N mistakes".
  - Solved puzzles leave the phone, except Review puzzles still unresolved.
- **Offline entry points.** When starting a session fails because there is no network, Play offers the offline puzzles. The offline pill also links to them.

## API (additive; `/api/offline/*`, JWT auth)

### `GET /api/offline/pack?kind=<level|weak|mate|endgame|hard>&style=<bullet|blitz|rapid>&count=<1..150>`

```json
{ "kind": "level", "style": "blitz", "generatedAt": "2026-10-30T09:00:00.000Z",
  "baseRating": 1612,
  "puzzles": [ { "id": "abc12", "fen": "…", "moves": "e2e4 e7e5 …", "rating": 1630,
                 "themes": ["fork", "middlegame"] } ] }
```

- **Base rating:** the style's `currentPuzzleRating`.
- **Selection per kind:**
  - `level`: base ±100;
  - `hard`: base +150…+250;
  - `weak`: the 3 weakest themes (same source as analytics), base ±150;
  - `mate`: themes `mateIn1|mateIn2|mateIn3`, base ±200;
  - `endgame`: theme `endgame`, base ±150.
- **Exclusions:** puzzles in the user's `UserPuzzleHistory` and in their unresolved review queue.
- **Default count:** level 50, weak 30, mate 40, endgame 40, hard 30. Max 150.
- **Response shape:** `moves` and `fen` are exactly what the session `next` endpoint returns: the first move is the opponent's.

### `POST /api/offline/sync`

```json
{ "style": "blitz", "tzOffsetMin": -240,
  "attempts": [ { "clientId": "uuid", "puzzleId": "abc12", "correct": true, "responseMs": 8400,
                  "solvedAt": "2026-10-30T08:12:03.000Z", "localDay": "2026-10-30",
                  "source": "pack" } ] }
```

- `source` is `pack` or `review`.
- `style` applies to every `pack` attempt in the batch. The client sends one batch per style.
- **Idempotent per `clientId`:** a new table `OfflineAttemptReceipt(clientId PK, userId, createdAt)`. Already-seen ids are skipped and counted as `duplicates`.
- **`pack` attempts**, in `solvedAt` order, go into one new `TrainingSession` per sync:
  - the session has `mode: "offline"`, `startRating` = the rating before, `startedAt` = the first `solvedAt`, `endedAt` = the last, `durationSec` = the sum of `responseMs` / 1000, and the stats filled in like `finish` does;
  - each attempt is a `TrainingAttempt` (with `createdAt` = `solvedAt`);
  - `UserPuzzleHistory` is upserted;
  - the rating is stepped with `computeRatingStep` over a sliding `WINDOW` of this batch's attempts, plus the correct-run multiplier, clamped to 400–3000;
  - a miss upserts a `ReviewItem`;
  - no unlock or demote, and no calibration change.
- **`review` attempts:** correct → resolve the review item (same as `POST /review/:id/resolve`); wrong → leave it. No rating.
- **Streak:** each distinct `localDay` within the last 3 days (server date, using `tzOffsetMin`) is applied with `applyStreakOnPlay` in ascending order.
- **Achievements:** run the same evaluation `finish` runs.

```json
{ "sessionId": "cm…", "ratingBefore": 1612, "ratingAfter": 1631, "delta": 19,
  "solved": 19, "total": 23, "accuracy": 0.83, "timeMs": 2460000,
  "mistakesToReview": 4, "reviewResolved": 3, "duplicates": 0,
  "streak": { "days": 13, "outcome": "continued" } }
```

**Web impact:** none in the API; offline sessions appear in the web history with mode "offline".
