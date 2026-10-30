# Progress log

Newest entry first. One entry per working session: what was done, what is verified (and how), what
is next, blockers. Link screenshots under `docs/mobile/screens/<phase>/`.

---

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
