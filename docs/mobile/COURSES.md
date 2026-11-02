# Learn tab: courses and books

Owner spec (2026-11-02) plus the canvas page "Learn" (`LearnHome`, `LearnBooks`, `LearnCourse`,
`LearnCourseUA`, `LearnIntro`, `LearnSolve`, `LearnExam`, `LearnChapterDone`, `LearnCourseDone`,
`LearnStates`, `LearnOpenBook`). Decisions: D28. Books: LIBRARY.md. Mobile-only.

## Navigation

- Tab bar: **Home · Play · Learn · Rivals · Stats**. Review is a stack screen at `/review`
  (a row on Play shows how many puzzles wait); Settings is a stack screen at `/settings` (avatar
  menu). The Library card left Play; `/library` redirects to Learn → Books.
- Learn: "Calm study. Nothing here touches your rating." Two segments, **Courses** and **Books**
  (remembered per user). Each: Continue card, filters All / In progress / Downloaded / Finished,
  a 2-column grid. Courses add "At {rating} we suggest {course}" (`suggestedCourse`).
- Routes: `/course/[courseId]`, `/course/intro`, `/course/solve`, `/course/exam`,
  `/course/done`, `/course/result`, `/course/certificate`.

## Courses

| Course | Level | Chapters | Puzzles (with exam) | Colour | Piece |
|---|---|---|---|---|---|
| Basic / Базовий | 400–1400 | 10 + exam | 180 | `#8e4542` | pawn |
| Intermediate / Середній | 1100–1900 | 11 + exam | 195 | `#c98c55` | knight |
| Advanced / Просунутий | 1800–2600 | 7 + exam | 135 | `#cbbfae` | queen |
| Endgames / Ендшпіль | 800–2300 | 7 + exam | 135 | `#94a58e` | king |

- A chapter is one Lichess theme (its icon is the app's theme glyph), 15 puzzles easy → hard,
  with an intro (2–3 sentences, a composed diagram with move/threat arrows, a caption) shown before
  the first pass and skippable later. Hint and Show solution are available; misses go to Review.
- All chapters are open; the next one in order is highlighted.
- The exam: 30 fresh puzzles (in no chapter) mixed across the course's themes, theme hidden,
  no hint, no solution, only Skip. Opens when every chapter of the current cycle is done. Pass
  mark 24/30. A failed try keeps all progress and names the weakest themes ("Practice Pin",
  "Retake exam"). A pass shows the certificate (Share, "Start cycle 2").
- Cycles: same positions, each cycle's target 30% under the last (`cycleTargetSec`).
- Emblem: not started (grey) → in progress (ring = solved / total this cycle) → completed (exam
  passed: full ring, tinted disc, check). A passed course started again shows the new cycle's
  ring; "Passed" stays on the card.

## Content

`tools/courses` (README there): `defs.mjs` (chapters, intros, tips in en + uk), `build.mjs`
(deterministic selection from the local puzzle DB: popularity ≥ 92, plays ≥ 800, deviation ≤ 80;
clean examples; spread over the band; no game or puzzle reused anywhere; balanced side to move),
`check.mjs` (the gate). Output: `apps/backend/src/library/courses/<id>.json`; course meta
(titles, descriptions, colours, pieces, ranges) is in `apps/backend/src/library/courses.ts`.

## API

- `GET /library/courses` → `{ courses: CourseSummary[] }`; `GET /library/courses/:id` → `Course`.
- Results: library attempts with `bookId = course id` (`POST /library/sync`, first result per
  puzzle and cycle wins; XP and streak as for books).
- Exam tries: `exams[]` on `POST /library/sync` (deduped on `clientId`; the server recomputes
  `passed` from the pass mark), returned by `GET /library/progress` → `{ attempts, exams }`.
  Table `CourseExam`.
- Course puzzles are real Lichess rows: the backend inserts missing ones with their real stats at
  boot and never rewrites an existing row, so they stay in the Play pool unchanged.

## Phone

`features/library/{store,sync,model,api}.ts` hold courses next to books (MMKV `libraryKV`:
`courses`, `course.<id>`, `<uid>.exams`, `<uid>.examQueue`). Screens: `features/learn`
(tab, panes, covers, CourseEmblem, open-book transition) and `features/courses` (course page,
intro, solving, exam, chapter complete, exam result, certificate). Maestro: `14-learn`,
`15-courses`.
