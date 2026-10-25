# apps/mobile: rules for coding agents

Read `AGENTS.md` in this folder first. It is Expo's own guidance and it applies in full: Expo
changes every SDK, so **fetch the versioned docs** (`https://docs.expo.dev/versions/v58.0.0/`, or
`https://docs.expo.dev/llms.txt`) before touching any Expo / EAS / RN API, and **add packages only
with `npx expo install <pkg>`** (never `pnpm add`). If `expo-doctor` disagrees with a version, it
wins. Root rules (branches, do-not-touch, definition of done) are in `/CLAUDE.md`.

## Stack (pinned; see PLAN.md §3)

Expo SDK 58, react-native 0.88.0, react 19.3.0, New Architecture, Hermes V1, React Compiler on,
typed routes, CNG (`ios/` and `android/` are generated and gitignored: never edit them, configure
through app config and plugins). expo-router ~58 (routes in `src/app`), Reanimated 4.7.1 +
worklets 0.13.0, RNGH ~3.3.0, MMKV 4.3.2, react-query 5, zustand 5, react-native-audio-api 0.13.6,
expo-haptics, FlashList 2, react-native-svg 15, expo-image. `@tac/core` is consumed as TS source
(`@tac/core/<module>`). Node >= 22.13 for this package only. There is deliberately **no `dev` and
no `build` script** here (root `pnpm dev` and CI `pnpm -r run build` must not pick mobile up).

These library versions postdate most training data. **Read the official docs and upgrade guides
before writing gesture, worklet or animation code.** Spikes live in `src/dev`; the SDK-pinned
option wins ties.

## Hard rules

1. **Every haptic and every sound goes through `feel.emit(event)`** (`src/feel`). Never call
   expo-haptics or the audio engine directly from a screen. Values come from `FEEL_TABLE` in
   `@tac/core/feel`; tuning history is in `docs/mobile/FEEL.md`.
2. **No React state on gesture or tick paths.** Drags, hovers, selection, timers and scrubbers
   drive SharedValues and worklets. A drag must cause zero Board/Square React commits (checked by
   `board-render-count`). `<Countdown>` re-renders only itself at 1 Hz.
3. **No `setTimeout` in `src/board`.** Timing goes through Reanimated (`withTiming`, callbacks) and
   the imperative handle's promises. `grep -r setTimeout src/board` must be empty.
4. **Colours only from `@tac/core/tokens`.** No raw hex in screens. A new colour (or any
   `color-mix`) is baked through `tools/assets/bake-fade.py` first (until it moves there it lives
   at `apps/frontend/scripts/bake-fade.py`; run it, do not edit it). Dark-only app.
5. **Every animation takes its durations and easings from `src/feel/motion.ts`**, which also owns
   the reduced-motion policy (sparks/shake off, pulses static, move slides kept at 120 ms).
6. **Every user-visible string goes through `t()` / `tn()`** with keys in `@tac/core/i18n`, en and
   uk both. No JSX text literals.
7. **Every interactive element has a `testID` and an `accessibilityLabel`** (and a role). Hit slop
   >= 44 pt.
8. **RNGH 3 hook API only** (`usePanGesture`, `useTapGesture`, `useExclusiveGestures`, …). Never
   mix in the v2 `Gesture.*` builder API.
9. **Perf is measured in Release builds only** (`npx expo run:ios --configuration Release`,
   `npx expo run:android --variant release`) with FrameStats. Debug numbers are meaningless.
10. If the React Compiler fights a SharedValue/ref pattern, add `'use no memo'` to that file and
    record it in DECISIONS.md.

## API base URL per target

Set `EXPO_PUBLIC_API_URL` (local backend: `pnpm --filter backend dev`):

| Target | URL |
|---|---|
| iOS simulator | `http://localhost:4000/api` |
| Android emulator | `http://10.0.2.2:4000/api` |
| Physical phone | `http://<Mac LAN IP>:4000/api` (`ipconfig getifaddr en0`) |

Cleartext `http://` works in debug builds only (the generated debug manifest allows it); a
Release build pointed at the local backend needs a dev-only cleartext exception via config, never
in the store profile. Switch to the `/api/v1` paths once B2 is on `main`. Never build against the prod API unless the
owner explicitly asks for that variant; the agent never uses it.

## Rebuild rule

JS changes hot-reload through Metro (keep `pnpm --filter mobile start` running in the background).
Rebuild the dev client **only when `npx expo-fingerprint` changes** (a native dependency, app
config, or a config plugin changed). When it does: `npx expo prebuild --clean`, then
`pnpm --filter mobile ios` / `android`. After adding any native dependency re-check
`pnpm why -r react` / `pnpm why -r react-native` (one React per app, one react-native).

## Dev routes (`src/dev`, behind `__DEV__` or `EXPO_PUBLIC_DEV_MENU=1`)

`/dev/bench` (FrameStats, render counters, JS-jam button), `/dev/board-lab?fen=&orientation=`,
`/dev/feel-lab` (one button per feel event, latency log, intensity sliders, JSON export),
`/dev/kitchen-sink` (every primitive in every state, en and uk; the only pixel baselines),
`/dev/typography` (Cinzel vs the Cyrillic candidates, en and uk), `/dev/diagnostics` (token
expiry, MMKV keys, cache size, scheduled notifications), `/dev/tuning`. Route names other than
those in PLAN.md are provisional until the routes exist.

## testID conventions

kebab-case, `<area>-<thing>[-<id>]`. Board: `sq-e4`, `piece-e4-wN`, `check-e1`, `lab-fen`,
`board-last-move`, `board-render-count` (dev only). Runner: `runner-timer`, `puzzle-id`,
`e2e-solve`, `e2e-wrong` (only in `EXPO_PUBLIC_E2E=1` builds; must be absent from the release
bundle). Viewer: `viewer-fen`. Profile: `avatar-image`. Maestro flows live in `.maestro/`
(`00-smoke.yaml`, `02-slice.yaml`, …); seeded users' passwords are in the git-ignored
`.maestro/.env.e2e`.

## Verify

`pnpm --filter mobile typecheck`, `npx expo lint`, `npx expo-doctor`, the phase's Maestro flows,
and a screenshot you have actually looked at (`xcrun simctl io booted screenshot <path>`).
