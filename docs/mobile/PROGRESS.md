# Progress log

Newest entry first. One entry per working session: what was done, what is verified (and how), what
is next, blockers. Link screenshots under `docs/mobile/screens/<phase>/`.

---

## 2026-11-09 — Desktop web from the canvas "Desktop — redesign" (D36)

- **Shell:** sidebar with the five sections, streak card (this week's days) and the player card
  (style rating · XP rank) opening the account popover (profile, friends, settings, shortcuts,
  language, log out); compact 64 px rail on board screens; page header with player search (⌘K)
  and bell; desktop dialogs portal to `<body>` so the scrim covers the sidebar; window hotkeys.
- **Pages (artboard → route):** login, register, onboarding 1–4 (bare); Home + new-account Home,
  Play (rated / free / themes, inline theme grid, "how levels work" side panel), Storm intro and
  result, Challenge; session runner (move, selection, wrong, pause, exit dialog) and its summary,
  Storm run, review drill / mistakes runner, course / book / exam solve; Learn (courses, books),
  course page, chapter intro, book page, Review; League, Stats, Achievements + medal dialog,
  session history and detail (no artboard); profile, profile edit dialog, Experience, Friends,
  Settings (profile, gameplay with live board, sound, account, about).
- **Adapted or left out (no data / feature in the app):** forgot password, remember me; hero
  stats use real figures (47 themes, 3 styles, 1 min shortest session); no placement test or
  reminders in onboarding; difficulty "± spread"; per-puzzle time per style; hint / skip /
  "show solution" in rated sessions (the runner has none); league tier names, place changes and
  promotion zone; per-style peaks; "94 % of players"; friend rows show the API's
  `online` flag, no rating / last seen; "maybe you know", invite link; theme and reminders
  settings; per-event clip pickers beyond "rank down"; offline chips and "available offline".
- **Not desktop yet (phone layout in the column):** course done / result / certificate, library
  done, offline screens, puzzle viewer, challenge detail, Storm friends.
- **Verified:** `pnpm -r run typecheck`, mobile eslint (0 errors), core tests 259; web export
  builds; every page screenshotted at 1440 × 900, 1280 × 800 and 1024 × 768 with seeded local
  users, the runner / Storm / drills / chapter solve played by clicking squares; 390 px phone
  layout unchanged. Native regression on the iOS sim (tt-agent-1): 02-auth, 09-onboarding,
  06-review, 06-mistakes, 07-theme-drill, 07-stats, 07-achievements, 08-profile-edit, 09-account,
  09-settings, 14-learn, 12-play-v2, 16-storm, 13-library, 15-courses, 17-challenge, 18-league
  green (09-account and 07-achievements on a rerun: the first run hit a Metro refresh from the
  agents' edits, then a test user left in uk). 08-friends fails at the friends' league board:
  it expects the friend on this week's XP board, empty on a Monday (stale since D32).
- **iPhone:** Release build with the prod API reinstalled on the owner's phone (profile valid to
  2026-11-11 ~16:49 local).

## 2026-11-09 — Web pass: desktop shell, full flow, fixes

- Desktop shell (≥ 1024 px): left rail (brand, five tabs, the player → account menu) replaces
  the header and tab bar; runners, exams, completion screens and onboarding hide it. Every sheet
  (route sheets and ui/Sheet, the runner's exit sheet) is a centred dialog on a wider-than-phone
  browser; backdrop / Esc close. Canvas: two new boards on "Mobile app" (Web — desktop shell,
  Web — sheets as dialogs).
- Fixes found walking the whole flow on the web (register → onboarding → Play rated/casual/
  themes → session → pause/exit/summary → history/detail/viewer → mistakes → Review drill →
  Stats/achievements → League/profile/friends/search → Learn course intro/solve → Library →
  Settings → Storm → challenge create): fonts loaded on web (were system faces), logo glow in CSS
  (svg blur banded), image shadows as CSS drop-shadow (square around the art), difficulty
  readout (band name hidden, value off-centre), onboarding rank labels clipped, Share → clipboard
  fallback, avatar opens the file picker (RNW Alert is a no-op), app-only entries hidden on web
  (offline packs/downloads, haptics, reminders), no browser focus ring on fields.
- Checked at 1512, 820 and 390 px. Native regression: Maestro 12-play-v2 and 16-storm on iOS.
- Not verified: avatar upload end to end (OS file dialog), Safari/Firefox, real-hand drag feel.

## 2026-11-08 — The web becomes the app itself (react-native-web, D35)

- Owner asked whether the web should run the React Native app instead of a second (Next) client.
  Stopped the W3–W5 Next agents (unmerged worktrees left in the scratchpad) and ran a spike:
  the whole app bundles for web with three shims; login, Home, Play, a rated session (drag and
  tap-tap), Storm, Review, League, Stats, Learn and Library work, sound included. Owner: move.
- `apps/mobile` now builds for web: react-native-web + @expo/metro-runtime; `token.web.ts`
  (localStorage), web API host, no BackHandler / local reminders on web, null Pulsar lab route;
  `WebFrame` keeps the phone layout in a 600 px centred column (window width clamped for
  screens that size from it); pointer cursor CSS; web favicon/colours.
- `tools/web/export.sh` (tree-shaken export, ~0.9 MB gzipped first-load JS; @2x images copied to
  the bare names the web bundle asks for) and `tools/web/deploy-dev.sh` (rsync + swap into
  `/opt/tactictak-web/dev`).
- Test instance: **https://tactictak.online:8443** (nginx server on 8443 with the apex cert,
  static files, prod API). The Next site on 443 is untouched. Config checked with `nginx -t`
  on the server before the merge; prod healthy after the deploy.
- Native regression: Maestro 12-play-v2 green on iOS after the changes.
- Not on the web yet: a desktop side rail (bottom tabs for now), keyboard play on the board.

## 2026-10-25: inventory and plan done, Phase 0 started

**Done**
- Inventory of the web app and backend for the native port: `docs/mobile/inventory/*.md`
  (board, play, review, social, stats-settings-shell, sound, design-system, backend, gaps,
  stack-research). Committed in `e4016fe`.
- Architecture and delivery plan synthesised and approved: `docs/mobile/PLAN.md`.
- Phase 0 started on branch `mobile`:
  - `apps/mobile` scaffolded (Expo SDK 58, RN 0.88, React 19.3; `engines.node >=22.13` in the
    mobile package only; no `dev`/`build` scripts).
  - `packages/core` (`@tac/core`) created: pure TS, chess.js 1.4, vitest; `"./*"` subpath exports.
    Module extraction in progress (rules, puzzle, format, charts, i18n, themes, catalogs,
    validation, tokens, feel, board folders exist; runner and api not started).
  - React split verified: `apps/frontend` resolves react 18.3.1, `apps/mobile` resolves 19.3.0
    under pnpm's default isolated linker; no `.npmrc` needed.
  - Android toolchain present: SDK at `~/Library/Android/sdk`, JDK 17 (Homebrew), AVD
    `taktic_pixel` (Pixel 8, API 36, google_apis arm64). Maestro 2.11.0 installed.
  - Working docs written: root, `apps/mobile` and `apps/backend` CLAUDE.md;
    `docs/mobile/{PROGRESS,DECISIONS,OWNER-QUESTIONS,PARITY,IDEAS,FEEL}.md`.

**Phase 0 — done (exit checks)**
- `@tac/core`: 12 modules, 117 vitest tests green; rules parity 12k seeded inputs per function
  vs backend `sessions/*.ts` and web `levels.ts`; i18n key parity (only the intended
  `review.puzzle_word.*` plural-form differences).
- Asset pipeline (`tools/assets`, `tools/audio`, `tools/README.md`) → `apps/mobile/assets`
  (154 manifest keys, 7.8 MB incl. 5 MB fonts). Font file name = PostScript name, so one
  `fontFamily` string works on iOS and Android.
- App shell: `app.config.ts` (tac·tic·tak, scheme `tactictak`, placeholder id
  `online.tactictak.app`, dark, 120 Hz plist key, fonts embedded via expo-font plugin, stone
  splash). Hello screen renders `initPuzzle` + uk i18n + tokens from `@tac/core`.
- Builds: `expo run:ios` (iPhone 17 sim) and `expo run:android` (taktic_pixel, API 36) both
  build and run; `maestro test .maestro/00-smoke.yaml` passes on both. Screenshots:
  `docs/mobile/screens/phase0/`.
- `pnpm -r run typecheck` green; node 21 install of the whole workspace only WARNs on the
  mobile `engines` (no failure); both Docker images build from a clean `git archive` of the
  branch; `git diff main -- apps/frontend apps/backend/src apps/backend/Dockerfile deploy` empty.
- B1 CI change pushed as branch `api/ci` (not merged; needs the owner — `gh` is not
  authenticated on this machine, so no PR was opened).
- Not done in Phase 0, moved to Phase 2 where it is first needed: B0 seed parameterisation.
- Dev loop note: `expo run:ios` exits 1 at the end only because macOS denies the background
  `osascript` call that focuses Simulator; the build and install succeed. Run Metro separately
  (`npx expo start`) and launch with `xcrun simctl launch booted online.tactictak.app`.

## 2026-10-25 (night) — Phase 1: board + feel lab

**Done**
- Board v1 (`src/board`): Views + Reanimated 4 + RNGH 3 hook API, stable piece ids so every
  move slides, drag overlay, promotion, hint rings + svg arrows, flash/shake/sparks, imperative
  handle, 64 labelled squares, no `setTimeout`. A drag+drop = exactly 1 Board render; an
  illegal drop = 0. 10 Maestro board flows (iPhone 17 Pro coordinates) + a device-independent
  smoke that also passes on the Android emulator (tap and drag verified there).
- Feel layer (`src/feel`): `feel.emit` over FEEL_TABLE, react-native-audio-api engine (decoded
  buffers, ambient + mixWithOthers, long-clip fades, background suspend/resume), expo-haptics
  facade with timed patterns, MMKV prefs; sounds preloaded at app start. Debug sim: emit →
  `start()` p95 < 0.5 ms; gesture end → `start()` p95 < 3 ms.
- Brand primitives (`src/ui`) + kitchen sink, typography sheet (uk display candidates), NativeTabs
  vs custom tab-bar mocks. Screenshots in `docs/mobile/screens/phase1/`.

**Measured (Release, iPhone 17 Pro sim, 60 Hz)**
- Bench FrameStats p50 16.7 / p95 16.7 ms. Frames over 33 ms: idle 1.0% (simulator noise
  floor), JS jam 1.5%, autoplay 3.1%. `animateMove(280)` resolves late by mean 28.8 / p95
  42 ms from the call → a React commit precedes each slide. Fix in progress (Phase 2 stream
  'board-perf'): start slides on the UI thread, reconcile React after.

**Owner checks pending (need a real iPhone)**: drag feel at 120 Hz, haptics, metronome slow-mo
(< 30 ms flash→click), Spotify mixing + silent switch, uk display font, tab-bar style.

**Notes**
- NativeTabs on iOS 26 render as Liquid Glass (background colour ignored, inactive items white);
  the first tap on it is occasionally dropped under Maestro.
- Reanimated 4.7 `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS` re-renders its internal animated
  wrapper when an animation settles (+2 commits per press in the kitchen sink); not our code.

## 2026-10-25 (morning) — Phase 2: vertical slice

**Done** (no backend changes; local API)
- `@tac/core/runner` (pure reducer, effects as data, session mode complete, snapshot/restore) and
  `@tac/core/api` (client + typed endpoints + query keys); core tests 173/173.
- Platform: secure-store token, MMKV-hydrated zustand stores, `Stack.Protected` guard, login,
  temporary Home, logout clears everything.
- Play: setup with the UI-thread DifficultySlider, runner (effect interpreter over the Board
  handle, Countdown, pause, ExitSheet with swipe-back/back, keep-awake, auto-pause in
  background), summary; E2E hooks.
- Board perf (Release, iPhone 17 Pro sim): call → UI slide start 2.4 ms mean (was 20.7);
  board commits per bench run 15 (was 227); autoplay over-33 0.0% in clean windows.
  `animateMove` lateness from the call 15.0 mean / 20.3 p95 ms — the remainder is frame rounding
  (280 ms = 16.8 frames); proposal: measure the gate from the UI slide start (12.5 / 18.2 ms).
- Feel: Board `moveFeel='caller'` → the runner plays the move click only for correct non-final
  moves; winning = `correct` only, wrong = `mistake` only (as on the web).
- Maestro: `00-smoke`, `02-auth`, `02-slice` (3 solved / 1 failed, 20 s backgrounded not
  counted; psql 4 attempts + endedAt), `02-slice-exit` (0-attempt discard deletes the session;
  swipe-back / Android back open the ExitSheet; board renders unchanged across 10 s of ticks).
  Passing on iPhone Air sim and the Android emulator. Screenshots: `docs/mobile/screens/phase2/`.

**Open**
- Snapshot restore can re-send an unconfirmed attempt → duplicate until B6 (idempotent attempts).
- Query cache not persisted yet (`@tanstack/query-persist-client` not installed) — Phase 4.
- Temporary strings live in local `strings.ts` files; move into `@tac/core/i18n` in Phase 4.
- Drag Maestro flows use iPhone 17 Pro coordinates.

**Next**: Phase 3 (backend mobile contract, api/* branches the owner merges) — or the owner's
device check first (OWNER-QUESTIONS #29).

## 2026-10-25 (day) — Phases 3 (backend branches) and 4–9 (all screens)

**Backend (Phase 3)**: seven `api/*` branches pushed and verified, nothing merged — merge order and
owner steps in `docs/mobile/backend-prs/README.md`.

**Mobile (Phases 4–9, current API)**: shell (custom tab bar, account menu, route tree, i18n per area,
toasts, offline banner, persisted query cache), Home, full play parity incl. RankCeremony and resume,
review (drill, mistakes, viewer, history), stats + achievements, social (profile, avatar, friends,
search, leaderboard), settings (gameplay, sound/haptics, local reminder, account, language, about),
onboarding. Typecheck + lint clean, `@tac/core` 204/204. Commit `18c2022`.

**Parity** (PARITY.md): 64 done · 19 partial · 4 todo · 6 deferred · 7 blocked on backend branches
(B6/B7/B8/B9/B13). Todo: welcome pager + LandingBoard, BoardThumbnail in history rows, store icons
and screenshots.

**Decision (owner, 2026-10-25): iOS first.** Android is not a gate for now — no Android runs in
phase exit criteria until the owner says so. The integration audit was stopped during its Android
pass (Maestro's driver kept crashing on the emulator); the iOS suite had passed with reruns.

**Open (iOS)**: two ThemeIcon implementations to merge into one; dedicated FEEL_TABLE events for
borrowed haptics; VoiceOver pass by hand; RankCeremony reduced-motion timing; real-device checks
(Q29) once the owner's phone is set up; Apple Developer enrollment pending (support ticket).

## 2026-10-30 (night) — Design v2: the canvas "Mobile app" page

All 42 artboards of the owner's new mobile page implemented (foundation agent + five area agents in
one checkout, disjoint ownership): tokens (ember #8e4542, tone palette), shared primitives in
`src/ui` (docs/mobile/DESIGN-SYSTEM-V2.md), tab header/bar, nested header; auth + new 4-step animated
onboarding, account menu, streak sheet, avatar disc; Home, Play setup (+ norm explainer `play/norm`),
runner, pause, exit, summary, ceremony (gradient alpha bug fixed), theme picker; Review, drill,
history, session detail, mistakes, viewer; Stats, achievements (+ sheet), Rivals, friends, search,
profile, profile editor; all Settings screens. Modal sheets now measure their own safe area.
Screenshots: `docs/mobile/screens/design-v2/`. Typecheck + lint clean, `@tac/core` 205/205; area
Maestro flows green (02-slice failed only under 5-agent load, green when idle).

App-only states the canvas lacked were drawn into the canvas as a new row "App states not drawn
above" (MobStates{Shell,Play,Review,Social,Settings}). Open design questions: OWNER-QUESTIONS 41–45.
Also: issues #4 (capture overlap, mobile), #5/#6 (web session detail) fixed and closed; CI now dumps
the prod DB before migration deploys; norm snapped to the 25 grid (prod).


## 2026-10-30 (late) — Demotion fix (B8) and recalibration

- **B8 on main (2be9508, deployed).** Demotion and calibration clamped the norm at
  `startPuzzleRating`, which every session overwrites with its picked start, so two weak sessions
  at or above the norm never dropped it (and raised it when the start was higher). Both now clamp
  at a fixed floor of 450. Reproduced locally: norm 1500, two weak sessions from 1600 → 1600
  before, 1475 after. Q11 answered.
- **Recalibration (D23).** `api/recalibrate` pushed (`POST /users/me/recalibrate`), waiting for the
  owner's merge. Mobile: onboarding step 4 for a player with a level shows "Recalibrate my level" /
  "Keep my level". Maestro `09-recalibrate.sh` (seeds a calibrated user, runs the flow, checks
  every style is back to 5 sessions with the norm kept) passes in en and uk; `09-onboarding`
  still passes. Screenshots: `screens/recalibrate/`. Canvas: MobStatesShell section added.

## 2026-10-31 — Calibration places a reachable norm (D24)

- **Owner report:** calibrated to 1450 and can't level up from it.
- **Diagnosis by simulation:** synthetic players of known strength, 4 styles/speeds. The old ladder
  gave level-up odds of 0-9% at the calibrated norm.
- **Fix on main** (0df01d9 + c9afc80): fitted rating + session replay, see D24. Same simulation:
  ~60-65% level-up at the new norm, 75-90% from norm - 50; placement < 70 ms per finish.
  Local API e2e (5 calibration sessions after a recalibrate): a 1300 player with an old 1650
  rating fits 1357 and lands at 1100; a 1800 player fits 1824 and lands at 1575.
- New nullable column `UserStyleProgression.calibrationStartedAt`; finish's `calibration` gains
  `performance`. Core mirror `rules/calibration.ts` + parity test; `@tac/core` 218/218.
- CI on c9afc80 (only an `import type` change) failed at `pnpm -r run build`; logs need GitHub auth.
  0df01d9, whose emitted JS is identical, built and deployed, so prod has the fix.

## 2026-11-01 — Play v2: levels from the rating, Casual, experience (D25)

- **Design.** Owner's "Play — simplified" page (Rated / Casual / Themes, no norm) plus the owner's
  requirement to keep level-ups. Added to the canvas: the level on the rated card, the runner
  bar (progress / in reach / casual), "How your level works", six summary states (level up,
  progress, protected, level down, casual, new experience rank), Experience and the profile card.
- **Backend (main 2343d4e, deployed with 6e98e9d):** Elo step against the puzzle (Q46), `casual`
  mode, `ruleset: 'v2'` sessions with levels and the two-session guard, experience
  (UserExperience + XpEvent, backfilled), GET /users/me/experience. Additive; the web keeps the
  norm. Local API e2e: a 1700 player levels 1450 → 1550; two weak sessions guard then drop.
- **Deploys were blocked since 31.10:** CI's `next build` failed in next/font/google (Google
  started serving font URLs next@14 can't parse). Owner-approved fix 6e98e9d: the same font files
  self-hosted in `apps/frontend/public/fonts` with an @font-face sheet; no visual change.
- **Mobile:** new setup, runner bar, summary, level sheet, Experience screen, Home and profile
  show the level. Maestro `12-play-v2.sh` (levelup, guard, down, casual, early) passes in en,
  and levelup / guard / casual in uk, DB-checked. Screenshots: `screens/play-v2/{en,uk}/`.
- `@tac/core` 225/225. `pnpm -r run typecheck`: backend, core, mobile pass; apps/frontend fails
  only on the mobile branch (React 18 vs 19 types in one workspace), unchanged frontend code.
- Fixed on the way: the runner treated casual as rated and could write the casual difficulty
  into the stored rating.

## 2026-11-01 — Library (D26): Greco's Traps live, The Romantic Era in the pipeline

- **Design.** Owner's canvas page "Library" (shelf, book, solving, chapter complete). Added
  `LibStates` (Play-tab row, download chip states, notes, the shown solution, first-read chapter
  complete); target numbers on the owner's boards follow the −30% rule.
- **Content.** `tools/library` (fetch → mine → assemble → verify, Stockfish 19 at depth 22, owner
  approved the install). Greco's Traps: 40 puzzles in 2 chapters from Greco's manuscript games,
  `verify.mjs` PASS; notes en/uk written by us, facts kept to well-documented ones. The Romantic
  Era (1851–1870, 1025 games fetched) is still being mined; it ships later as a content update
  (book versions refresh downloaded copies, no app update needed).
- **Backend (main ac233f0):** `LibraryAttempt`, `/library/books`, `/books/:id`, `/progress`,
  `/sync` (idempotent; hint/missed → Review; XP from total library time; streak via the offline
  path). Library puzzles live in `Puzzle` under every selection floor.
- **Mobile:** shelf, book page, book-mode runner (`library` practice mode: clock vs the cycle
  target, hint, show solution → step → next, historical card), chapter complete with the cycle
  comparison, downloads and a per-user result queue in MMKV `library`.
- **Maestro `13-library.sh`** (BOOK=greco): `read` (download, airplane mode, wrong move + hint +
  shown solution + the rest, chapter complete, back online → 20 results synced, 3 in Review) and
  `cycle2` (seeded first pass → comparison and target) pass in en and uk, DB-checked.
  Screenshots: `screens/library/{en,uk}/`. `@tac/core` 236/236.
- **Owner answered every open question (D27):** library counts for the streak, −30% cycle
  targets, the web stays live, api/ci merged by the agent (CI green, e9b2c0b), abandoned-session
  sweep (B7) approved as the next backend task.
- Simulators are silent now (owner): `feel/sound.ts` skips sound when `!Device.isDevice`.

## 2026-11-02 — Library filled: nine books, 664 puzzles

- **Owner:** "fill the library with every possible book". The canvas shelf's six books plus three
  more eras (covers drawn on the canvas page "Library — more books").
- **Live on prod** (each `verify.mjs` PASS at depth 22, independently re-run by me before deploy):
  Greco's Traps 40 (v2 notes), The Romantic Era 120 (6 chapters incl. a final examination),
  Masters of Attack 100 (5 incl. exam), The Age of Steinitz 60, Lasker's Endings 50,
  Alekhine's Fire 94 (5 incl. exam), Fundamentals (Capablanca) 80, Rubinstein's Precision 60,
  The Hypermoderns 60. Ids of already-shipped chapters never changed (progress safe).
- My verify rejected 5 Alekhine puzzles on the first pass (non-unique second move, a defence that
  was not the best, a gain that evaporated); they were replaced and the book re-verified.
- Notes fact-checked; one unverifiable claim (Marshall winning St. Louis 1904) was removed.
  Ukrainian names unified (Пільсбері), exam chapters titled «Фінальний іспит».
- **App:** cover palettes for every book, `exam` chapters (no hint/solution, Skip = missed).
  Android prod APK built for the owner (arm64 and universal); iOS prod build reinstalled.
- Mining ran ~10 h on 6 Stockfish processes at most (owner: don't overheat the Mac); no thermal
  or CPU-limit warning was recorded.

## 2026-11-02 — Learn tab: courses + books (D28)

- **Owner request:** themed puzzle courses (Basic / Intermediate / Advanced / Endgames) next to
  the books, in a new Learn tab moved out of Play; designed by the owner on the canvas "Learn" page.
- **Backend (main, f64c52a, deployed; CI + deploy green, `/api/library/courses` answers 401
  unauthenticated on prod):** course catalog + content (645 Lichess puzzles, 35 chapters, four
  30-puzzle exams), `GET /library/courses[/:id]`, `CourseExam` table, exams on sync/progress.
  Local smoke: lists, content, attempt sync into Review, exam dedupe on clientId, pass recomputed.
- **Content:** `tools/courses` (build + check gate; strict quality floor, no relaxations needed).
  35 intros with composed diagrams, en + uk.
- **Mobile:** 5-tab bar (Learn third), Review row on Play, Settings in the avatar menu; Learn tab
  with both segments, course cards and CourseEmblem, title-page covers with portraits (6 books;
  Steinitz, Hypermoderns, Rubinstein provisional), open-book transition; course page, intro,
  solving, exam, chapter complete, exam result, certificate. Core: `courseProgress`,
  `examOutcome`, `suggestedCourse` (tests 243 green); library module split to end a require cycle.
- **Verified:** `pnpm -r typecheck` areas clean; Maestro `14-learn`, `15-courses` (3 cases),
  `13-library`, `04-shell`, `06-review`, `06-history`, `09-settings`, `09-account`,
  `09-onboarding` pass on iOS sims. `10-walkthrough` fails at sign-up (iOS strong-password sheet
  clears the field) and `09-reminder` fails after 23:00 local (asserts a 23:00 reminder today):
  both environmental, not Learn regressions. Screenshots: `screens/learn/`.
- **Phone:** prod-API Release build with Learn installed on the owner's iPhone.
- **Open:** portraits for the three books without one; uk theme names to unify ("Заманювання" vs
  "Завлікання", skewer "Лінійний удар" vs "Рентген"); canvas app-only items (Review row on Play,
  Settings menu row, exam open row, exam result screen, Learn load/error/empty states).

## 2026-11-03 — Puzzle Storm + friend challenges, stage A (D29)

- **Owner request:** build the canvas sections Puzzle Storm and Challenge a friend; owner chose two
  stages (A: solo Storm + async Race; B: live Race + Together) and no chat for now.
- **Backend (main, 57d9b7a, deployed; CI green, `/api/storm/summary` answers 401 unauthenticated
  on prod):** `StormStream` / `StormRun` / `Challenge` tables; streams of 100 rising puzzles from a
  per-bucket pool; validated, idempotent runs (Review, XP, streak); summary with friends this
  week; challenges (friends only, 30/day, 24 h, conditional status moves); presence for
  `GET /friends` `online`. Local API smoke (`scratchpad/smoke/storm.mjs`, 33 checks) green after
  a `/code-review` pass fixed retry races, status races, run-length and replay abuse.
- **Core:** `@tac/core/storm` engine (clock, combo bonuses, lives, ladder, verdict) and a `storm`
  practice mode (reveal the right move after a mistake, then move on). Tests 256 green.
- **Mobile:** `/storm` start, `/storm/run` (wall clock, background/kill safe, run queue),
  `/storm/result` (chart, dare), `/storm/friends`; `/challenge/new`, `/challenge/[id]` (incoming,
  waiting, result, draft, declined/expired); Play rows (Storm, Challenge with count); Rivals
  "Challenges" section; Challenge on a friend's profile.
- **Verified:** `pnpm --filter mobile typecheck`, backend tsc, core tests; Maestro `16-storm`,
  `17-challenge` (en + uk) on iOS sims. Screenshots: `screens/storm/`.
- **Canvas:** `StormAppStates`, `ChallengeAppStates` boards added on "New: modes & social".
- **Open:** OWNER-QUESTIONS 48 (provisional rules); stage B needs a realtime channel (websocket
  or SSE through nginx) and push needs the Apple Developer account.


## 2026-11-04 — Review drill: instant next puzzle

- Owner: drill puzzles loaded slowly one after another. Each advance waited for two prod round
  trips in a row (`POST /review/:id/resolve`, then `GET /review`). The next puzzle now comes
  from the cached list (already prefetched); resolve + list refresh run in the background, and
  puzzles solved in the drill are kept out locally. The drill waits for the server only when the
  cached list runs dry, to confirm the theme is cleared.
- **Verified:** mobile typecheck, lint; Maestro `06-review` on an iOS sim (theme cleared, row gone).

## 2026-11-04 — Review: take back only the wrong move; ‹ › to browse moves (D30)

- Core `practiceReducer`: a `line` of positions per puzzle; a wrong move goes back to its tail
  instead of the start; a `browse` event + `browseOf` selector. Tests 257 green.
- Mobile: `BrowseRow` (practice-back / practice-forward) on the drill and the mistakes runner.
- **Verified:** mobile typecheck, lint; Maestro `06-review` (with a back/forward step) and
  `06-mistakes` on an iOS sim.

## 2026-11-04 — Web catches up with the app: W0 foundation (D31)

- Owner: the web is a full client again, in design v2, on `@tac/core`; Claude merges `web/*` into
  `main`. Plan `docs/web/PLAN.md`, parity `docs/web/PARITY-WEB.md`.
- `mobile` fast-forwarded into `main` (main now carries apps/mobile and packages/core).
- **Fixes on the way:** root `.npmrc` keeps `@types/react` out of pnpm's hidden hoist and the root
  pins the app's `@types/react` (a clean install broke the mobile typecheck); the frontend
  Dockerfile copies `pnpm-lock.yaml` (fresh resolution broke the prod web build).
- **W0 on prod (1d87dfc):** the web depends on `@tac/core` (transpiled; Dockerfile copies it);
  strings from core i18n; `src/v2/tokens.ts` inlines every token as CSS variables and `.tv-*`
  text classes; app assets in `public/v2`; Forum for uk display text; design v2 primitives in
  `src/v2/ui` and a hidden `/dev/kit` (screens in `docs/web/screens/w0/`).
- **Open:** CI `mobile` job red on expo-doctor (15 Expo packages have patch updates).

## 2026-11-04 — Web W1 + W2 on prod; web parity paused; rank eyes in full resolution

- **Web W1** (shell, v2 login/register) and **W2** (v2 board, runners, feel, `/dev/board`) merged
  into `main` (b505f8f) and deployed. The owner then paused web parity: the state, the next
  phase (W3 Play) and how to restart are in `docs/web/RESUME.md`.
- **Rank eyes:** tomoe 1–3, mangekyo and rinnegan were 128 px and blurry in the rank ceremony and
  the summary; regenerated from the canvas's 512 px originals (band icons, onboarding rank path,
  achievement medals and their locked variants).

## 2026-11-04 — League tab, challenge removal, inactive reset, Storm combo levels, confirm sheet

- **Confirm sheet:** every native `Alert.alert` confirm (Storm quit, exam leave, discard session /
  profile edit / challenge, unfriend) is now the design's confirm sheet (`confirm()` in
  `src/ui/ConfirmSheet.tsx`, FullWindowOverlay on iOS so it shows over modal routes).
- **League (D32):** weekly XP board by default, all-time rating behind a switch; swipe a challenge
  row to decline / withdraw / remove. Backend `api/league` on prod (86a6196).
- **Inactive reset (D33):** one-time migration on prod with the same deploy.
- **Storm combo (D34):** combo levels with per-move and per-solve time, a livelier meter, the side
  to move as a king disc. Backend `api/storm-combo` on prod (b353816).
- **Verified:** typechecks, core tests 259, local API smoke (storm.mjs incl. remove + league),
  Maestro `16-storm`, `18-league` (en + uk), `08-friends` on an iOS sim. `05-resume` is stale
  (old Play setup ids) — needs a rewrite.
- **Canvas:** League board, challenge swipe, confirm sheet and the new combo meter still need
  drawing into the canvas (design-parity rule).

## 2026-11-07 — Prod incident (Redis miner) and the friends' bug batch

- **Incident:** prod Redis was published on 0.0.0.0:6380 without auth and got a crypto miner
  (~6 Nov); it moved Redis to another port, the ioredis client queued commands forever and
  POST /sessions hung ("no connection" in the app). With the owner's ssh key: stopped the
  container, fresh Redis volume, Redis + Postgres bound to localhost via a server-only
  `docker-compose.override.yml`, OpenClaw (an old project) stopped. Code fix 558b1b9 on prod:
  compose ports on 127.0.0.1, Redis fail-fast (1 retry, 2 s), puzzle buffer falls back to
  Postgres. The owner still has to rotate the root password and the cleanup command.
- **Bugs from testers:** Play setup slider no longer remounts to 0 on a style switch and the band
  eye no longer moves with the band name; the wrong/right square flash and the shake wait for a
  tap-move to land; Storm's load error has centred, equal buttons; the profile editor clears the
  Android status bar; Storm now loads its stream on the Start / Play again / Accept button (like
  a session) instead of a separate loading screen (`features/storm/launch.ts`).
- **Verified:** mobile typecheck + lint, Maestro `16-storm`, `12-play-v2`, `17-challenge` on an
  iOS sim; slider screenshots right after a style tap. Android status-bar fix not run on a device.
