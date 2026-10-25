# Decisions

One entry per decision. Status is **FINAL** (owner-approved or verified) or **PROVISIONAL**
(the plan's default, adopted so work continues; asked in OWNER-QUESTIONS.md under the same `Q#`).
When the owner answers, flip the status, add the date and the answer, and never delete history.
Spike results append measured numbers to the relevant entry (question, options, numbers, decision,
fallback).

---

## Taken decisions

### D1. Native rebuild in Expo, web frozen: FINAL (owner, 2026-10-25)
The Next 14 web app was a proof of concept. All features are rebuilt in `apps/mobile` for iOS and
Android from day one. The web gets fixes only until parity, then becomes a landing page plus
privacy, account deletion, admin, `/.well-known` and link fallbacks (Phase 12).
Why: push, haptics, UI-thread gestures and animation at 60/120 fps; nobody installed the PWA.

### D2. Stack: FINAL (plan, 2026-10-25)
Summary of PLAN.md §3; `expo-doctor` wins any version disagreement; install with `npx expo install`.

| Topic | Choice |
|---|---|
| Runtime | Expo SDK 58, RN 0.88.0, React 19.3.0, Hermes V1, New Architecture, React Compiler on, typed routes |
| Builds | expo-dev-client, `expo run:ios/android`, CNG (no committed native dirs); EAS from Phase 10 |
| Navigation | expo-router ~58, NativeTabs (5), `Stack.Protected`, formSheet, fullScreenModal |
| Animation / gestures | Reanimated 4.7.1 + worklets 0.13.0; RNGH ~3.3 hook API only |
| Storage | react-native-mmkv 4.3.2 (instances `app`, `query`, `session`); expo-secure-store for the refresh token |
| Server / client state | @tanstack/react-query 5 (persisted to MMKV), zustand 5 |
| Lists, charts, icons | FlashList 2; react-native-svg (hand-ported charts); lucide-react-native; expo-symbols for tabs |
| Images | expo-image, expo-image-picker (system 1:1 crop), expo-image-manipulator |
| Push | expo-notifications + Expo Push Service (backend expo-server-sdk) |
| Testing | vitest (core), jest-expo + RNTL (mobile units), Maestro 2.11 (e2e), jest + supertest (backend, B0) |
| Observability | Sentry (see Q23) |

Rejected: Skia, NativeWind/Uniwind, @gorhom/bottom-sheet, notifee, react-native-chessboard,
OpenAPI codegen (reasons in PLAN.md §3).

### D3. One shared package `@tac/core` with subpath exports: FINAL (plan)
Pure TS, only runtime dep chess.js ^1.4.0, no React (not even a peer), no RN/DOM/Node imports.
Consumed as TS source via `"./*": "./src/*/index.ts"`. Scripts `typecheck` and `test` only (no
`dev`/`build`, so root `pnpm dev` and CI `build` ignore it). The web never imports it; the backend
may import it only after Phase 12 (Dockerfile change). Rule files are verbatim copies guarded by a
parity test.

### D4. Board approach: in-house Views + Reanimated + RNGH 3, no Skia: FINAL pending Phase 1 numbers
One pre-baked board image, at most 32 `Animated.View` pieces (expo-image WebP 256 px) keyed by
stable piece ids, SharedValue-driven highlights, react-native-svg arrows, drag overlay in
OverlayHost. Why: full puzzle-UX control, no Skia package split or v3 Vulkan / minSdk 26 store
exclusion. Gate (Phase 1): Release UI-thread p95 <= 17 ms, < 1% frames over 33 ms, zero
Board/Square commits during drags. Numbers to be appended here.

### D5. Styling: plain StyleSheet + tokens + `src/ui` primitives: FINAL (plan)
No NativeWind/Uniwind, no runtime theming: dark-only (`userInterfaceStyle: dark`, system UI
`#1d1b20`, light status bar). Every `color-mix` pre-baked as rgba in `@tac/core/tokens`; screens
never use raw hex. Opaque 92% fills instead of blur, except the pause overlay (expo-blur on iOS).

### D6. Audio: react-native-audio-api 0.13.6, expo-audio as fallback: FINAL pending Phase 1 spike
One AudioContext, every clip pre-decoded at splash, fresh BufferSource per play into a master gain.
Facade keeps the web API (`sfx`, `stopLongClip`, `moveSoundEvent`). Offline clip pipeline (trim at
-40 dBFS + 3 ms pre-roll, level to -29 dBFS RMS, synth clips pre-rendered). Fallback: an expo-audio
player pool behind the same facade, built only if the spike fails (gesture-end to `start()` p95
< 5 ms, 20 overlapping triggers/s, first sound after cold start). Session policy: see Q5.

### D7. Haptics: expo-haptics facade, Pulsar only after a device win: PROVISIONAL (Q4)
`performAndroidHapticsAsync` on Android. react-native-pulsar 1.7 replaces the engine behind the
facade (ceremony, gate, castle patterns) only if the Phase 1 device spike shows a clear win.
Haptics have their own toggle, independent of sound, and stay on under reduced motion.

### D8. Single feel choke point `feel.emit` + FEEL_TABLE: FINAL (plan)
Sound and haptic fire in the same frame from one table in `@tac/core/feel`. Deliberate fixes over
the web: winning-move click suppressed; mistake = thud + Error only (no click+thud overlap); check
and castle sounds also on review replies; opponent feel at landing. Values and tuning: FEEL.md.

### D9. Linker: pnpm default isolated linker, no `.npmrc`: FINAL (verified 2026-10-25)
Verified: `apps/frontend/node_modules/react` is 18.3.1 and `apps/mobile/node_modules/react` is
19.3.0. Fallback only if Metro/native resolution fails: `node-linker=hoisted` in a root `.npmrc`
(pnpm 9.12 reads it; Docker images do not copy it), then re-verify the frontend build and both
Docker builds. Never put linker settings in `pnpm-workspace.yaml` (pnpm 10+ only, and it is copied
into Docker). Re-check `pnpm why -r react` / `react-native` after each native dependency.

### D10. Node versions: FINAL (plan, verified hazard)
Root `engines` stays untouched (Docker runs node 20; pnpm fails on a project's own engines
mismatch). `apps/mobile/package.json` declares `"node": ">=22.13"`. CI moves to node 22 in B1.

### D11. Backend contract: additive, `/api/v1` via URI versioning, mobile keyed on `client:'mobile'`: FINAL (plan)
Same handler on `/api` and `/api/v1`. Refresh tokens issued only for `client:'mobile'`; the web
keeps its 7-day token. Every backend PR passes the web-contract golden test and legacy smoke and is
merged by the owner.

### D12. Branching under bypass-permissions mode: FINAL (owner, 2026-10-25)
The owner runs Claude Code with bypass permissions for autonomy (PLAN.md §9.5 had suggested
acceptEdits + allowlist). Consequence: the branch rules are the safety net. Mobile work stays on
`mobile`; backend work on `api/*` branches from `main`, merged by the owner; never commit or push
to `main` (every push deploys prod), never force-push, never touch prod.

### D13. Android emulator: AVD `taktic_pixel` (Pixel 8, API 36): FINAL (2026-10-25)
PLAN.md §5/§9.2 mention `pixel_api35` (API 35); the installed AVD is `taktic_pixel` on
`android-36` google_apis arm64. Use it for all emulator checks.

### D14. Input blocked while the opponent moves: PROVISIONAL (part of Q6)
Deliberate improvement over the web, unified across all runner modes.

### D15. Avatar via the existing base64 endpoint: PROVISIONAL (Q18)
Client resizes to 512 px JPEG q0.8 (about 100 KB base64, under the 6 MB JSON limit) and posts
`POST /users/me/avatar {dataUrl}` unchanged. Multipart + sharp is in IDEAS.md.

---

## Provisional defaults (PLAN.md §8)

Each is adopted now and asked in OWNER-QUESTIONS.md under the same number.

| Q# | Decision | Provisional default | Needed by | Status |
|---|---|---|---|---|
| 1 | App identity | Name tac·tic·tak, bundle id / package `online.tactictak.app`, scheme `tactictak`, link domain `tactictak.online` | Phase 0 (before first store upload) | PROVISIONAL |
| 2 | Cyrillic display font | Shortlist Forum / Cormorant SC / Prata; agent picks the best-rendering one | 1 | PROVISIONAL |
| 3 | Tab structure and style | Home · Play · Review · Stats(+Achievements) · Social(Leaderboard+Friends); Settings and profile behind the header avatar; system NativeTabs with ember tint | 1 | PROVISIONAL |
| 4 | Haptics engine | expo-haptics; Pulsar only if the device spike wins | 1 | PROVISIONAL |
| 5 | Audio session | iOS `ambient` + mixWithOthers; respects the silent switch, never stops the user's music | 1 | PROVISIONAL |
| 6 | Board behaviour | Animate every move; block selection while the opponent moves; opponent feel at landing; mistake = thud + Error only; user-drawn arrows deferred; knightArrow hidden | 1–2 | PROVISIONAL |
| 7 | Highlight blue | `rgb(47,95,158)` (as rendered) | 1 | PROVISIONAL |
| 8 | Owner phone backend in Phases 2–9 | LAN backend on the Mac with a seeded account; prod-API variant only on explicit request, never used by the agent | 2 | PROVISIONAL |
| 9 | Background mid-session | Auto-pause; backgrounded time does not count | 2 | PROVISIONAL |
| 10 | Abandoned-session sweeper | Idle > 12 h on last activity: 0 attempts → delete; else save as early exit, no progression change, no streak tick | 3 | PROVISIONAL |
| 11 | `startPuzzleRating` semantics | Keep it as the entry floor; add `lastStartRating` for the slider | 3 | PROVISIONAL |
| 12 | Auth scope v1 | Nickname + password only (no Sign in with Apple obligation); email recovery post-launch | 3 | PROVISIONAL |
| 13 | fixedColor semantics | Applies to every runner mode consistently | 5 | PROVISIONAL |
| 14 | Mistakes-review solves / session delete | Mistakes-review solves resolve the global queue: yes. Session delete also deletes its ReviewItems: no | 6 | PROVISIONAL |
| 15 | Session delete UX | Undo toast | 6 | PROVISIONAL |
| 16 | star-repo achievement | Hidden in the mobile app (store review risk); kept on the web | 7 | PROVISIONAL |
| 17 | Creator crown | Keep `creators.ts` in core; server flag later | 8 | PROVISIONAL |
| 18 | Avatar storage | VPS volume, existing base64 endpoint, client resize | 8 | PROVISIONAL |
| 19 | Legacy settings fields (accentColor, boardTheme, soundPack, reviewAutoAdvance) | Hidden in mobile, kept in the DB until Phase 12 | 9 | PROVISIONAL |
| 20 | Sound and haptics prefs scope | Per device | 9 | PROVISIONAL |
| 21 | Reminder default and push caps | 20:00 local; 1 streak push and 3 total per day; at launch: streak_at_risk, friend_request_received, friend_request_accepted | 9–10 | PROVISIONAL |
| 22 | Device scope | Phones only, portrait, no iPad | 0 | PROVISIONAL |
| 23 | Crash reporting | Sentry (`@sentry/react-native` + `@sentry/nestjs`) | 10 | PROVISIONAL |
| 24 | Account purchase timing | Apple enrolment during Phase 5; Play and Firebase before Phase 10 | 5 | PROVISIONAL |
| 25 | Admin after retirement | Trimmed web `/admin` | 12 | PROVISIONAL |
| 26 | Web retirement trigger | 4 weeks after store launch, plus a 14-day zero-traffic window before B18 | 12 | PROVISIONAL |
