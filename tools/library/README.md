# tools/library

Content pipeline for the Library books (`apps/backend/src/library/content/*.json`):
tactical moments from real games played before 1930, each line checked by
Stockfish. Re-runnable; nothing here runs at build time.

**Requirements:** Node 22+, Stockfish (`/opt/homebrew/bin/stockfish`, override
with `STOCKFISH=`), network access for `fetch-games.mjs`. `chess.js` resolves
from `packages/core/node_modules` (no install). Raw pages and intermediate
files live in `$LIBRARY_CACHE` (default `$TMPDIR/tac-library-cache`), never in
the repo.

```sh
export LIBRARY_CACHE=/some/tmp/dir
node tools/library/fetch-games.mjs greco          # -> $LIBRARY_CACHE/games-greco.json
node tools/library/mine.mjs greco --workers 8     # -> candidates-greco.json, rejects-greco.json
node tools/library/assemble.mjs greco --list      # browse candidates (key, players, SAN line, auto themes)
node tools/library/assemble.mjs greco             # books/greco.json selection -> content/greco.json
node tools/library/verify.mjs apps/backend/src/library/content/greco.json   # the gate
```

| File | Does |
|---|---|
| `sources.json` | Per book: chessgames.com player ids, year range, `winnerOnly`, optional `maxMoves`, extra game ids |
| `fetch-games.mjs <book>` | Pages through each player's game list, keeps games in the year range that the player won, fetches their pages and extracts the PGN. Every page is cached; requests are ≥ 1.2 s apart, User-Agent `Mozilla/5.0`, with backoff when the site answers its "overloaded" stub |
| `mine.mjs <book>` | Replays each game, finds puzzle moments and builds verified lines. Resumable (`progress-<book>.jsonl`). Flags: `--workers N`, `--back N` (scan the winner's last N moves; default 40), `--max-moves N`, `--target N` (stop after N candidates), `--first gid,…` (mine these first), `--gids gid,…`, `--all` (every moment, forward), `--endgame` (only positions with queens off or ≤ 6 pieces; same thresholds), `--depth N` (mining depth; a lower one is only a pre-filter, verify re-checks at ≥ 22), `--tag x` |
| `assemble.mjs <book>` | Joins `books/<book>.json` (chapters, picked candidates, notes) with the candidates; computes themes and rating; sorts each chapter by rating; numbers the ids |
| `verify.mjs <file>` | Independent re-check of a finished book; exits 1 on any failure |
| `lib.mjs` | chess.js loader, Stockfish UCI pool, thresholds (`RULES`) |

## Puzzle format

Same as the Lichess puzzles the app already plays. `fen` is the position
before the opponent's last move in the game; `moves` is UCI: that setup move,
then the solution, solver and defender alternating, ending on a solver move.
The first solver move is always the move played in the game.

## Rules (mine and verify)

Stockfish 19, one thread per engine, MultiPV 2, depth 22 on every position of
the line; depth 28 when a number is within 40 cp of a threshold (80 cp for the
"trivial" check). Scores are from the side to move.

- **Moment** (mine, pass 1, depth 14): the winner of the game is to move, the
  game move is the engine's best, and it is a mate in ≤ 6 or ≥ +250 with the
  second-best ≤ +150. Pass 2 then builds the line at full depth.
- **Solver moves**, every one: the engine's best move and an only move.
  - goal `mate` (≤ 5 solver moves): the best is a mate of exactly the
    remaining length and the second-best is no mate of any length. On the
    last move any mate is accepted (the app accepts any mate there).
  - goal `win`: best ≥ +300 and second ≤ +120. If the best is a mate (a mate
    too long for a mate puzzle), the second must be no mate and ≤ +300.
    That is stricter than "gap ≥ 300", on purpose: a second move that wins
    too means the moment is not unique.
- **Not already won:** at the first solver move the second-best must be
  below +500 (otherwise the position is lost anyway and the puzzle teaches
  nothing). Applies to mate-in-1 too.
- **Defender moves:** the game's move when it is a best defence (same mate
  distance, or within 60 cp of the best); otherwise the engine's best, and
  the puzzle gets `"deviates": true`. After the game ends (resignation) the
  line continues with the engine's best defence; that is not a deviation.
  If the game's solver move later stops being the only move but the
  engine's best still is, the engine move is used (also `deviates`).
- **End of a win line:** the line is extended while the next solver move is
  unique (at most 5 solver moves), then cut back to the last solver move
  after which the gain is realized: either the solver is ≥ +300 and is still
  ≥ 2 points of material (P1 N3 B3 R5 Q9) up on the start position after the
  1st and the 3rd ply of the defender's best line (so an in-between
  recapture does not count), or the defender is facing a forced mate (a
  mating attack longer than a mate puzzle). A line that never realizes a
  gain is rejected, and so is a one-move "win" that merely recaptures on the
  square of the setup capture.
- **Replay:** every move legal in chess.js; mate puzzles end in
  `isCheckmate()` with `mateIn` = number of solver moves; win puzzles do not
  end in mate.

`verify.mjs` restates the thresholds itself and also checks the schema (exact
keys, optional chapter `exam: true`, `lib-<book>-<chapter>-NN` ids, localized
strings, chapter titles ≤ 28 and subtitles ≤ 40 characters, notes ≤ 140
characters, no Russian-only letters in `uk`, theme slugs from
`packages/core/src/themes/index.ts`, exactly one `mateInN` on mate puzzles, a
phase slug, year < 1930, source URL, ascending rating per chapter, no
position twice; it warns when more than 30% of a book is mate in 1). If the game page is in `$LIBRARY_CACHE`, it also checks that
the setup and first solver move are the game's, and that a puzzle without
`deviates` follows the game for as long as the game lasts.

## Rating heuristic (Lichess scale)

| Line | Base |
|---|---|
| mate in 1 / 2 / 3 / 4 / 5 | 1000 / 1400 / 1750 / 1950 / 2100 |
| win in 1 / 2 / 3 / 4 / 5 solver moves | 1250 / 1500 / 1750 / 1900 / 2000 |

Then +150 if the first move is quiet (no check, capture or promotion), +100 if
the line sacrifices material (the solver is ≥ 2 points down after a defender
reply), +50 more for a queen sacrifice, −75 if the first move is a capture
with check. Clamped to 900–2300, rounded to 25. A pick in `books/<book>.json`
can override it.

## Themes

`mateInN` (mate goal), one phase slug (`endgame` if ≤ 6 pieces other than
kings and pawns, else `opening` up to move 12, else `middlegame`), then up to
three motifs detected on the line, in this order: `smotheredMate`,
`backRankMate`, `doubleCheck`, `discoveredAttack` (check by a piece that did
not move), `fork` (the moved piece hits two bigger pieces or king + piece and
one of them is taken later in the line), `attraction` (the king takes a
sacrificed piece), `sacrifice`, `promotion`, `hangingPiece` (win goal, the
first move takes an undefended piece), `quietMove`, `attackingF2F7`,
`exposedKing` (defending king off its first two ranks) or
`kingsideAttack` / `queensideAttack` (mate, or a line with checks, against a
king on the f–h / a–c files). A pick in `books/<book>.json` can override the
themes when the heuristics miss the point (pins, deflections, in-between
moves).
