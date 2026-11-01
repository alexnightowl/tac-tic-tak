# Library: feature spec and API contract

Owner request (2026-11-01). A section of "books": themed collections of puzzles from real games of
the old masters (before ~1930) or public-domain books. Players read a book chapter by chapter and
then again, faster each time ("cycles"), so the positions stick as patterns. The design lives in
the canvas "Library" page: `LibShelf`, `LibBook`, `LibSolve`, `LibChapterDone`, plus `LibStates`
(states the four screens don't show). Decisions: D26.

## Behaviour

- **Entry.** A "Library" row on the Play tab, above "Offline puzzles". The shelf is a pushed
  screen with a "‹ Play" back (the canvas draws the tab bar under it; see D26).
- **Shelf** (`/library`). "Continue reading" with the book read last (cover, chapter, progress,
  "Continue · cycle N"), filter chips (All / In progress / Downloaded / Finished), and a grid of
  covers with the puzzle count, the chapter or "Done", the download state (✓ downloaded, spinner,
  ↓ not downloaded) and a progress bar for the current cycle. Offline, the stored list (or the
  downloaded books) with a note.
- **Book** (`/library/[bookId]`). Cover, era, players, description, puzzles / level range / time
  per cycle, the cycles strip (done with its average, now, next with its target), the chapters
  with their progress in the current cycle, and the docked CTA: "Start reading", "Continue · Ch.
  III, puzzle 6" or "Read again · cycle N". The header chip downloads the book (Download →
  Downloading… → Offline). A downloaded book can be removed; progress stays.
- **Solving** (`/library/solve?book&chapter&cycle`, full-screen modal). The practice runner in
  `library` mode on the usual board. Header: chapter back, cycle chip, clock "0:14 / 0:25" (time on
  this puzzle / the cycle target; rose past the target; time only in cycle 1). One segment per
  puzzle of the chapter. The goal ("White mates in 2", "White to play and win"), "Puzzle n of N ·
  III. Chapter". Under the board the historical card: players, place and year, our note.
  - A wrong move rewinds (as in drills) and the puzzle counts as **missed**; Hint (two levels)
    counts as **hint**; "Show solution" steps the line on the board and counts as **missed**,
    then "Next". A clean solve advances on its own.
  - Each puzzle's result is queued once, when it ends: `clean | hint | missed`, the time from the
    player's first turn, the cycle.
- **Chapter complete** (`/library/done`). The cover with the chapter seal, "Chapter complete ·
  cycle N" ("Book complete" on the last one), the comparison with the previous cycle (average
  time, right answers, one bar per puzzle), misses sent to Review, the next cycle's target, and
  "Next · IV. Chapter" or "Read again · cycle N+1".
- **Cycles.** A cycle is one pass over the whole book. The current cycle is the highest with a
  result; when every puzzle has one, the next CTA starts cycle N+1 from the top. Chapters can be
  opened in any order; Continue follows book order. Targets (owner, Q47): each cycle aims 30% under
  the one before. Cycle 2 = 70% of the first pass's average (rounded to 5 s), each later cycle =
  70% of min(previous target, previous average), never under 5 s.
- **Rules.** Not rated: no rating, level or norm moves. Training time earns XP (2 per minute, as
  everywhere). Hint and missed results put the puzzle in Review. A day with a library result
  counts for the streak (owner, Q47), like an offline day: up to 3 days late.

## Offline

- "Download" stores the whole book (JSON, ~50–100 KB) in MMKV `library`; solving then needs no
  network. A book that is not downloaded is solved online from the server copy.
- Results go to a per-user queue in MMKV first (synchronously), then `POST /library/sync`. They
  leave the queue only after a 2xx. Sync runs on app start, foreground, network back (the offline
  host's triggers), after every puzzle and on leaving the runner.
- Dedupe: the server keeps one result per `clientId` and per (user, puzzle, cycle); the first wins.
  The phone shows server ∪ queue with the same rule, so nothing is lost or counted twice, also
  across two devices.
- Removing a download deletes the book only; results stay. A downloaded book whose server
  version grew is fetched again on the next shelf refresh.

## API (`/api/library`, JWT)

| Route | Returns |
|---|---|
| `GET /library/books` | `{ books: Summary[] }`: id, version, title/authors/players/era/description `{en,uk}`, cover, coverPiece, puzzleCount, ratingMin/Max, minutesPerCycle, chapters `{id,title,subtitle,count,puzzleIds}` |
| `GET /library/books/:id` | Summary + `chapters[].puzzles`: id, fen, moves (UCI, first = setup), rating, themes, goal `mate|win`, mateIn, game `{white,black,event,site,year,…,source}`, note `{en,uk}`. 404 for an unknown book |
| `GET /library/progress` | `{ attempts: {bookId,puzzleId,cycle,result,timeMs,solvedAt}[] }` |
| `POST /library/sync` | body `{ tzOffsetMin?, attempts: [{clientId,bookId,puzzleId,cycle 1–99,result,timeMs,solvedAt,localDay?}] }` (≤ 1000). Returns `{accepted, duplicates, unknown, reviewAdded, xp, streak}`; the days in `localDay` tick the streak through the offline path |

Storage: table `LibraryAttempt` (unique `clientId`, unique `(userId, puzzleId, cycle)`). Content
ships with the backend (`apps/backend/src/library/content/*.json`). At boot the library puzzles are
upserted into `Puzzle` (+ `PuzzleTheme`) with popularity −100 and 0 plays, under every selection
floor, so Review can hold them and no rated, casual, theme or offline pick serves them. XP comes
from the user's total library time, so results synced one by one still add up to whole minutes.

## Content

`tools/library/` (fetch, mine, verify; see its README). Positions are taken from the games
themselves (the setup move is the move actually played before the puzzle), every solution move is
Stockfish's best and the only one that works, and `verify.mjs` re-checks a book file before it
ships. Notes are ours; facts are kept to what is well documented.
