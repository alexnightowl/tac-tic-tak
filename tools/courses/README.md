# tools/courses

Content for the four themed puzzle courses (Basic, Intermediate, Advanced,
Endgames): `apps/backend/src/library/courses/<course>.json`. Each chapter is
one tactical theme with 15 Lichess puzzles sorted easy to hard, plus a short
intro (2–3 sentences, a composed diagram with arrows, a caption) and a tip,
in English and Ukrainian. Each course ends with a 30-puzzle exam (pass mark
24) of fresh puzzles mixed across its chapter themes. The app's types are in
`packages/core/src/library/courses.ts`; course titles and colours live in the
backend catalog, not here.

```sh
pnpm db:up                                   # local Postgres (container taktic_postgres)
node tools/courses/build.mjs [course…]       # select puzzles, write the JSON (all four by default)
node tools/courses/check.mjs [file.json…]    # the gate; exits 1 on any failure
```

Node 22; `chess.js` resolves from `packages/core/node_modules`. Queries are
read-only. A run always selects all four courses in a fixed order, so a
re-run gives byte-identical files.

| File | Does |
|---|---|
| `defs.mjs` | Courses, chapters (theme slug, rating band, selection slugs), quality floors and every word: titles, tips, intros, diagrams, captions |
| `build.mjs` | Queries candidates per chapter, selects, writes the files, prints a table (band used, rating range, colours, clean count, relaxations) |
| `check.mjs` | Counts, ids unique across all files, lines legal and ending on a solver move, mates end in mate with the right `mateIn`, chapter theme present (and `endgame` in Endgames), ratings non-decreasing, one game per chapter, exam spread even, intro FEN legal, the arrowed move legal and named by the caption (no other SAN in it), threat arrows starting at a piece of the mover, en/uk strings non-empty |

## Selection rules

- Source: the `Puzzle` table (Lichess), never `lib-*` ids. Lichess format:
  `fen` is before the opponent's setup move; `moves` is UCI, setup first,
  ending on a solver move.
- Quality floor: popularity ≥ 92, nbPlays ≥ 800, ratingDeviation ≤ 80. A
  chapter that cannot fill steps down to 90/500, then 88/300, and the table
  says so. The current build needs no relaxation.
- Clean examples first: tags other than the chapter theme count against a
  candidate (structural tags such as `mate*`, `short`, `middlegame`,
  `crushing` do not; the endgame-phase tags do not in Endgames; descriptive
  tags such as `kingsideAttack` or named mates count half). Attack on the
  king prefers puzzles also tagged `sacrifice`; Mating patterns spreads its
  picks over the named mates.
- 15 per chapter: targets evenly spaced from band low + 5% to band high − 5%;
  for each, the cleanest unused candidate within half a step (then a step),
  keeping the side to move balanced, nearest first, then popularity, plays,
  id. Lichess has almost no well-measured puzzles at the bottom of some
  bands (nothing under ~500; trapped piece and remove the defender start
  near 800), so the targets span the part of the band where the strict
  floor has supply: from its 10th-lowest to its 10th-highest candidate.
- No puzzle and no game is used twice anywhere (chapters and exams of all
  four courses). Chapters pick first, then the exams.
- Exam: 30 puzzles spread over the chapter themes as evenly as possible (the
  earlier chapters take the remainder), from the upper 60% of each chapter's
  band, sorted by rating; each carries `theme`, the chapter it stands for.
- `goal`: `mate` (with `mateIn` = solver moves) when tagged `mateInN`,
  `equal` when tagged `equality`, else `win`.
