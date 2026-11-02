# Courses (draft, 2026-11-02)

Owner request: themed puzzle courses next to the Library books, all under a new top-level
**Learn** tab (books + courses), moved out of Play. **Design first**: the owner draws the Learn tab
and the course screens in the canvas; nothing is built until then.

## Shape

- Four courses: **Basic**, **Intermediate**, **Advanced**, **Endgames**.
- A course reuses the book machinery: chapters, cycles with the −30% target, offline download,
  sync, missed or hinted puzzles go to Review, not rated.
- One chapter per motif, ~15 puzzles sorted by rating, so a chapter ramps up and finishes with a
  clear "done". The last chapter of every course is a mixed exam (motif not named, no hint,
  no solution), because a motif title gives the answer away.
- Each chapter opens with 2–3 sentences on the motif (en + uk, written by us).

## Content source

Lichess puzzles already in the `Puzzle` table, by their own ids (not `lib-*`), so the Play pool
and Review keep working. Quality floor: popularity ≥ 92, nbPlays ≥ 800, ratingDeviation ≤ 80.
"Clean" examples: the course motif plus as few other tactical tags as possible (structural tags
like `mate`, `mateInN`, `short`, `middlegame`, `crushing` do not count). No duplicates across
courses; colour and opening variety within a chapter.

Backend note for later: course puzzles must not be upserted with library popularity (−100);
that would pull real Lichess puzzles out of Play. Insert-if-missing with their real stats.

## Curriculum and supply (local DB, quality floor above)

| Course | Band | Chapters (Lichess theme) |
|---|---|---|
| Basic | 400–1400 | hanging piece (11k), mate in 1 (44k), fork (74k), pin (31k), skewer (12k), discovered attack (31k), back-rank mate (9k), trapped piece (4k), removing the defender (4k), mate in 2 (86k), exam |
| Intermediate | 1100–1900 | attraction (57k), deflection (51k), double check (7k), intermezzo (15k), clearance (13k), interference (5k), f2/f7 attack (5k), promotion (27k), defence (40k), smothered and other named mates, mate in 3 (42k), exam |
| Advanced | 1800–2600 | quiet move (19k), x-ray (1.2k), zugzwang (7k), sacrifice on the king (33k), long combinations (46k), defence (25k), intermezzo (4k), deflection (14k), mate in 4+ (5.6k), exam |
| Endgames | 800–2300 | pawn (42k), rook (63k), knight (10k), bishop (17k), queen (14k), queen + rook (7k), promotion (34k), zugzwang (12k), exam |

Every chapter has thousands of candidates except x-ray (1.2k) and underpromotion (126, dropped).
Rough size: ~15 puzzles × ~40 chapters + exams ≈ 650 puzzles.
