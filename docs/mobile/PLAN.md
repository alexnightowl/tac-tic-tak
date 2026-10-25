# tac·tic·tak native app: final architecture and delivery plan

*Synthesised from three independent proposals (risk-first, experience-first, delivery-first). Every claim below was checked against `docs/mobile/inventory/*.md` and the repo source as of 2026-10-25. Audience: the engineers building it and Claude Code working overnight. Where a proposal was wrong about this codebase, the correction is marked **[verified]**.*

---

## 0. Proposal scorecard and synthesis rationale

| Criterion (1–10) | P1 Risk-first | P2 Experience-first | P3 Delivery-first |
|---|---|---|---|
| Correctness vs this codebase | 8 | 7 | 8 |
| Risk handling | 9 | 6 | 8 |
| UX quality | 8 | 9 | 7 |
| Delivery speed | 5 | 7 | 8 |
| Autonomy-friendliness | 9 | 6 | 9 |
| **Total** | **39** | **35** | **40** |

**P1 (risk-first).** It has the most rigorous engineering: a board with zero React commits during a drag, a FrameStats logger, Release-only measurement, a fault-injection API client, a parity test against the backend rule files, and a numeric exit criterion for each spike. Its weakness is order. The owner touches nothing real on his phone until about night 15, and the whole backend contract lands before a single product screen exists. Errors: it raises root `engines.node` (this breaks Docker, see below), it adds `session:{sid}:current` (redundant), and its sweeper is keyed on `startedAt`.

**P2 (experience-first).** It has the best UX thinking: one `feel.emit` choke point, a per-event FEEL_TABLE, per-screen interaction specs, and a vertical slice on the owner's phone that uses only the existing API. Weaknesses:
- Pulsar is the primary haptics engine before anyone has measured it.
- Refresh tokens arrive in Phase 5, so the app runs on 7-day tokens for most of the build and then needs a token migration.
- It suggests pointing builds at the prod API early.
- Its pixelmatch baselines on every screen would be brittle overnight.
- Its feel acceptance mostly depends on the owner.

**P3 (delivery-first).** It has the best sequencing and contract mechanics:
- Refresh tokens are issued only when the client sends `client:'mobile'`. This is the correct mechanism when `defaultVersion: [VERSION_NEUTRAL,'1']` serves one handler on both `/api` and `/api/v1`.
- A web-contract golden test.
- One runner reducer reused by four screens.
- `+native-intent` maps web paths to app routes.
- The avatar reuses the existing base64 endpoint.
- Phase 0 exits with a `git diff main` emptiness check.
- Store gotchas are covered (the Play personal-account rule of 12 testers for 14 days, privacy pages served by nginx).

Its weakness is that the board arrives at Phase 3, and only after a large backend release.

**Synthesis.** P3's dependency ordering and contract mechanics are the skeleton. P1's board, runner, measurement and robustness engineering go inside it, along with its spike discipline. P2 contributes the feel layer and an early vertical slice on the owner's phone (moved before the backend contract, so the contract is shaped by a working app). One rule applies throughout: *no product breadth before the board and the feel pass their measured gate*.

### Corrections that apply to all proposals [verified]

1. **Do not raise root `engines.node`.** Both Dockerfiles copy the root `package.json` and run `pnpm install` on `node:20-alpine`. pnpm always fails when a *project's own* `engines` does not match, whatever `engine-strict` is set to. Declare `"engines": {"node": ">=22.13"}` in `apps/mobile/package.json` only, and move CI to node 22.
2. **The linker fallback goes in `.npmrc` (`node-linker=hoisted`), not in `pnpm-workspace.yaml`.** pnpm 9.12 reads `.npmrc`; workspace-yaml settings are pnpm 10+. Also, `pnpm-workspace.yaml` *is* copied into both Docker images, whereas `.npmrc` is not.
3. **`packages/core` must have neither a `dev` nor a `build` script.** Root `pnpm dev` runs `pnpm -r --parallel run dev`, and CI runs `pnpm -r run build`. Use `test` and `typecheck` only.
4. **The server knows nothing about pauses.** The early-exit check uses wall-clock time (`play.md` › Pause). A Resume therefore needs the local MMKV snapshot, because the server cannot compute the remaining time. With only server state (`/sessions/active`, no snapshot), the app can offer Finish or Discard but not Resume.
5. **The sweeper must key on last activity, not `startedAt + durationSec`.** Otherwise a session that is paused in the background gets swept while the user still plans to resume it.
6. **Same handler on `/api` and `/api/v1`.** With `defaultVersion: [VERSION_NEUTRAL, '1']`, "v1 login returns a refresh token" cannot be keyed on the path without duplicating controllers. Key it on `client:'mobile'` in the DTO instead. `ValidationPipe({whitelist:true})` without `forbidNonWhitelisted` silently drops unknown fields, so this is safe for the web.
7. **The web logs out on *any* 401 sent with a token** (`apps/frontend/src/lib/api.ts`), and `changePassword` throws `UnauthorizedException('current password is incorrect')`. So a mistyped password logs a web user out today. Changing that one response to 403 is a pure web bug fix: the web then surfaces `body.message`.
8. **The `startPuzzleRating` conflict is real.** `sessions.service.ts:69` sets it to the picked start on every rated session. `unlock.ts:162` (and the demote path) still clamps to it as the entry floor, which neutralises demotion and calibration step-downs.
9. **Local dev ports:** Postgres is on **5433** (`docker-compose.override.yml`) and Redis on **6380**. Prod compose publishes Postgres on `5432:5432` on the host.
10. **The rule files `sessions/{unlock,rating,streak}.ts` have zero imports**, so `packages/core` vitest can import them directly for parity tests.
11. **The backend has no test runner today** (no jest in `apps/backend/package.json`).
12. **The web has 6 nav items** (dashboard, play, review, leaderboard, analytics, settings), and the profile opens via the avatar. Android NativeTabs allow at most 5.
13. **`AttemptDto.responseMs` is capped at `10*60*1000`.** Relaxing it to 3 600 000 is additive.
14. **The JSON body limit is 6 MB.** A 512 px JPEG avatar at about 100 KB as base64 fits, so the existing `POST /users/me/avatar {dataUrl}` is usable unchanged.

---

## 1. Context

- **Product.** A chess-tactics trainer: timed rated sessions in three styles (bullet, blitz, rapid) with adaptive difficulty, calibration, unlock and demote progression, daily streaks with freezes, theme drills, a review queue, stats, achievements, friends, a leaderboard and en/uk i18n.
- **Decision (owner, final).** The Next 14 / React 18 web app was a proof of concept. All of its functionality is rebuilt as a native **Expo + React Native app in `apps/mobile`**, for **iOS and Android from day one**. Development continues on mobile only. The web stays live for fixes only until parity. It is then retired to a landing page: store links, privacy, account deletion, admin, `/.well-known`, and universal-link fallbacks.
- **Why native.** Push notifications, haptics, and UI-thread gestures and animations at 60/120 fps. Users never installed the PWA.
- **Design.** Keep the "Ember on stone" look and tokens, but use native patterns (tab bar, sheets, gestures, haptics), not 1:1 web screens.
- **Constraints.**
  - Prod deploys from `main` on every push (GitHub Actions, then ssh, then `docker compose --profile app build/up`). Migrations run on container start.
  - CI runs `pnpm -r run typecheck` and `pnpm -r run build` on node 20.
  - The Dockerfiles copy only `apps/<app>` plus the root `package.json` and `pnpm-workspace.yaml`: no lockfile and no `packages/*`.
  - Root `pnpm dev` runs every package's `dev` script in parallel.
- **Environment.** Xcode 26.6 with iPhone 17 simulators, CocoaPods, Java 17, watchman, node 24 locally. No Android SDK yet; the agent installs it via Homebrew in Phase 0. No Apple or Google accounts yet; until they exist the agent uses local `expo run` builds, and the owner's phone uses a free personal team with 7-day provisioning.
- **Executor.** Claude Code works autonomously overnight on the `mobile` branch. It can build and run on the simulator, take screenshots and drive Maestro. Backend changes go to `main` through owner-merged PRs and must stay backwards-compatible with the live web.

---

## 2. Target architecture

### 2.1 Monorepo layout

```
apps/
  backend/      NestJS 10 + Prisma 5 + Redis. Dockerfile/deploy unchanged. Gains: versioning, app-config,
                auth refresh, session lifecycle, sweeper, notifications, throttler, jest+supertest e2e.
  frontend/     Next 14 / React 18. FROZEN (fixes only). Never imports workspace packages.
                Phase 12: trimmed to landing + /privacy + /delete-account + /admin + link fallbacks.
  mobile/       Expo SDK 58 / RN 0.88 / React 19.3, New Arch, Hermes V1, React Compiler, typed routes. CNG
                (ios/ and android/ generated, gitignored).
    src/app/           expo-router routes
    src/ui/            primitive kit (AppText, PlateButton, Card, Segmented, Toggle, Input, Sheet, Toast…)
    src/board/         Board, layers, gestures, imperative handle
    src/runner/        usePuzzleRunner (effect interpreter for @tac/core/runner), Countdown
    src/feel/          feel.emit, haptics facade, sound engine, motion (reduced-motion policy)
    src/features/      auth, home, play, review, sessions, puzzles, stats, achievements, social,
                       profile, settings, onboarding, notifications
    src/platform/      api instance, secure store, mmkv instances, appState, network, linking
    src/stores/        zustand stores
    src/dev/           bench, board-lab, feel-lab, kitchen-sink, diagnostics, tuning (dev menu only)
    assets/            pieces/{ember,classic}, board, plates, textures, icons, themes, sfx, fonts
    .maestro/          flows per phase + regression suite + fixtures (apns payloads, images)
packages/
  core/         @tac/core. Pure TS, NO React/DOM/Node/RN imports. Only runtime dep: chess.js ^1.4.0.
                Consumed as TS source via package.json "exports" subpaths. Scripts: typecheck, test.
tools/
  audio/        process-sfx.mjs (trim/level/resample), render-synth.mjs (OfflineAudioContext pre-render)
  assets/       piece/plate/icon export, SVGO for theme glyphs; bake-fade.py + bake-board.py moved here
  contract/     legacy-smoke.ts (web route status/key diff), zod contract smoke
docs/mobile/    PLAN.md (this), PROGRESS.md, DECISIONS.md, OWNER-QUESTIONS.md, PARITY.md, IDEAS.md,
                FEEL.md, screens/<phase>/
```

**Conflict resolved: one package or two.** Use a single `@tac/core` with subpath exports (`@tac/core/tokens`, `@tac/core/runner`, …), not separate core and tokens packages. Fewer packages means fewer resolution edges.

**`@tac/core` modules**

| Subpath | Contents |
|---|---|
| `rules` | Verbatim copies of backend `unlock.ts`, `rating.ts`, `streak.ts`, plus web `levels.ts` (bands, STYLE_FORMULAS, solvedTarget, computeUnlockProgress). `DEMOTE_PEAK_BAND` replaces the literal 50s. |
| `puzzle` | initPuzzle, uciFromMove, parseUci, buildSolutionFens, SOLVED_PAUSE_MS |
| `runner` | Pure reducer `(state, event) → {state, effects[]}` and session-outcome selectors (summary branch, rankChange, warnThreshold, eligibility) |
| `board` | `'worklet'` geometry: squareToXY/xyToSquare (orientation, mirror), arrowGeometry incl. bent knight, promotion placement, sparks generator, numeric EMBER_FIT/CLASSIC_FIT `{scale,dx,dy}` |
| `feel` | Sound catalogue with asset keys, DEFAULT_SOUND_PICKS, moveSoundEvent, FEEL_TABLE (event → {sound, haptic, motion}) |
| `format` | fmtDuration, fmtResponseTime, formatLocalDate, streakState, groupSessionsByDay |
| `charts` | Heatmap buildGrid/levelFor, smoothPath, niceStep, radar geometry/wrapLabel |
| `i18n` | en/uk dicts moved verbatim from `lib/i18n.ts` and `landingI18n.tsx`; t/tn/interpolate; pluralizeUk fallback |
| `themes` | themeLabel, META_THEME_SLUGS, KNOWN_THEME_SLUGS, resolveThemeIconKey |
| `catalogs` | Achievements metadata (slug, category, icon name), creators |
| `validation` | Nickname and password regexes, kept the same as the DTO rules |
| `api` | `createApiClient`, error normalisation (`message: string[]`), query-key factory, hand-written response types, zod schemas (dev and contract smoke only) |
| `tokens` | Baked colours (every `color-mix` precomputed as rgba), graphite 50–950 ramp, board/feedback/rank colours, radii (control 6, card 10, sheet 16), spacing, type scale with px letter-spacing, motion (ANIMATION_MS 0/160/280/460, 220/360 next delays, 500 feedback, 520 reset, 1000 solved, CountTo 350/900, bezier tuples) |

**Rule drift guard.** `packages/core/test/parity.test.ts` imports `apps/backend/src/sessions/{unlock,rating,streak}.ts` directly and compares them with the core copies on more than 10k seeded random inputs. CI fails on drift. The backend imports core only optionally, after launch (Phase 12), which needs Dockerfile changes.

### 2.2 React 18 / 19 strategy

- `@tac/core` declares **no** React dependency, not even a peer. Hooks such as `useT` and the query hooks live in `apps/mobile`. A duplicate React through shared code is therefore structurally impossible.
- `apps/frontend` never imports workspace packages. React 18.3.1 resolves only under `apps/frontend` and 19.3.0 only under `apps/mobile`. This works with pnpm's default isolated linker, which Expo supports since SDK 54.
- Phase 0 gate: `pnpm why -r react` and `pnpm why -r react-native` show one version per app and a single react-native.
- Fallback, only if native resolution fails: `node-linker=hoisted` in a root `.npmrc`. The Docker images don't copy it. Re-verify `pnpm --filter frontend build` and both Docker builds afterwards.
- `apps/mobile` scripts: `start`, `ios`, `ios:device`, `android`, `typecheck`, `lint`, `test`, `e2e`. There is **no `dev`** and **no `build`**. Native builds happen through `expo run` or EAS.
- TypeScript in apps/mobile is pinned to whatever `expo-doctor` accepts, not TS 7.

### 2.3 Navigation tree (expo-router, `src/app`, typed routes)

Route paths deliberately mirror the web paths, so universal links and push URLs map 1:1.

| Web route | Mobile route | Presentation |
|---|---|---|
| `/` (landing) | `(auth)/welcome` (pager built from the landing copy: Paces, Ranks gate, Motifs) | auth stack |
| `/login`, `/register` | `(auth)/login`, `(auth)/register` | auth stack |
| `/dashboard` | `(app)/(tabs)/home/index` | tab 1 |
| `/play` | `(app)/(tabs)/play/index` (setup) | tab 2 |
| `/review` | `(app)/(tabs)/review/index` (theme cards) | tab 3 |
| `/analytics` | `(app)/(tabs)/stats/index` (Stats \| Achievements segmented) | tab 4 |
| `/leaderboard`, `/friends` | `(app)/(tabs)/social/index` (Leaderboard \| Friends segmented) | tab 5 |
| `/settings` | `(app)/settings/{index,profile,gameplay,sound,notifications,account,about}` | push, from the header avatar menu |
| `/profile/:nickname` | `(app)/profile/[nickname]` (own profile also opens from the header avatar) | push |
| `/play/:id` | `(app)/play/[id]` runner, then summary phase in the same screen; leave via `router.replace` | fullScreenModal, gestureEnabled false |
| `/review/:puzzleId?theme=` | `(app)/review/[puzzleId]` drill; next puzzle swaps in place | fullScreenModal |
| `/sessions/:id/review` | `(app)/sessions/[id]/review` | fullScreenModal |
| `/sessions/:id` | `(app)/sessions/[id]` | push |
| `/puzzles/:puzzleId` | `(app)/puzzles/[puzzleId]` viewer and stepper | push |
| (none; history lives in SessionList) | `(app)/sessions/index`, paginated history (new) | push |
| `/admin` | **stays on the web** | n/a |
| (none) | formSheets: `play/theme-picker`, `friends/search`, `avatar-source`, `achievement/[slug]`, `streak` | formSheet |
| (none) | `onboarding` (fullScreenModal), `update-required`, `+not-found`, per-route error boundaries | n/a |

- **Root layout.** Providers: GestureHandlerRootView, SafeArea, KeyboardProvider, PersistQueryClientProvider, ToastHost, OverlayHost (drag piece, sparks, RankCeremony), OfflineBanner. A splash gate covers fonts, synchronous MMKV hydration, the secure-store refresh token, `/users/me`, app-config, and asset preload (pieces, board, sfx decode).
- **Guard.** `Stack.Protected` on `isSignedIn`. A `hasSession` flag in MMKV makes the first route decision synchronous.
- **Tabs.** NativeTabs (`expo-router/native-tabs`) with ember tint, SF Symbols / Material Symbols via expo-symbols, and a Social badge for incoming friend requests. A custom JS tab bar is the contained fallback, decided from Phase 1 screenshots.
- **In-screen sheets that must keep the runner mounted** (ExitSheet, PromotionPicker) use an in-house Reanimated + RNGH 3 `<Sheet>`. `@gorhom/bottom-sheet` is not used, because its RNGH 3 support is unproven.
- **Runner chrome.** `useKeepAwake`, hidden status bar, immersive Android navigation bar (replaces focusMode fullscreen). `usePreventRemove` and `BackHandler` send the iOS swipe and Android back into the exit flow.
- **Deep links.** Scheme `tactictak://` now. Universal links and app links on `tactictak.online` for `/profile/*`, `/sessions/*`, `/review*`, `/puzzles/*`, `/play` in Phase 10. `+native-intent.tsx` maps `/dashboard`, `/analytics`, `/leaderboard`, `/friends`, `/settings` to tab routes. Push payloads carry a path from this table.

### 2.4 Data and auth layer

**Server state.** `@tanstack/react-query` 5 with the query-key factory from core, mirroring the web keys (`['me']`, `['overview']`, `['analytics', f]`, `['review-themes']` …).
- The cache is persisted to the MMKV instance `query` (buster = app version + fingerprint, maxAge 7 d) for read screens only.
- `focusManager` is wired to AppState and `onlineManager` to expo-network.
- Each screen gets a `RefreshControl` and refetch-on-focus, replacing the web's global pull-to-refresh.

**Client state.** zustand stores:

| Store | Contents |
|---|---|
| `authStore` | Access token in memory, user, status booting / anon / authed |
| `appStore` | settings, progressions, streak; persisted in MMKV `app` under the web key names `taktic.settings`, `taktic.lang` |
| `devicePrefs` | `taktic.soundPrefs`, hapticsEnabled, `taktic.lastStyle`, `taktic.lastDurations`, seenAchievements, lastSeenRatings, leaderboard style and scope |
| `toastStore` | Ported verbatim |
| `activeSession` | Runner snapshot in MMKV `session` |
| `outbox` | Persisted queue in MMKV `session` |

Synchronous MMKV reads mean the first frame already has the language, settings and last setup. That removes the web's hydration-mismatch bug class (`b25dbd3`).

**Settings.** `PATCH /users/me/settings` is optimistic with rollback, and surfaces `achievementsUnlocked` as toasts.

**`resetAll()`** runs on logout, on a failed refresh and on account deletion:
- `queryClient.clear()`, every store reset, user-scoped MMKV keys removed, runner snapshot cleared;
- push device unregistered, then `POST /auth/logout`;
- `router.replace('/(auth)/login')`.

RN has no hard reload, so everything must be cleared explicitly.

**Auth.** Phase 3 lands this before the shell is built.
- Login and register send `client:'mobile', deviceId`. The response adds `{refreshToken, expiresIn}` and the `token` becomes a 30-min access token with a `tv` claim. Web requests without `client` get exactly today's 7-day token.
- The refresh token is opaque and 256-bit, stored SHA-256-hashed, with a 90-day sliding lifetime. It rotates, and reuse of a revoked token revokes the whole family.
- On the device: the refresh token lives in `expo-secure-store` (AFTER_FIRST_UNLOCK) and the access token only in memory.
- `createApiClient`:
  - single-flight refresh mutex, plus a pre-emptive refresh when `exp` is less than 60 s away;
  - queued requests are retried once after the refresh;
  - 401 on the auth-form routes is shown as a form error;
  - a 403 from change-password is a form error, never treated as expiry;
  - only a *failed refresh* calls `resetAll()`;
  - AbortController timeout of 10 s;
  - 429 respects `Retry-After` (toast and warning haptic, no retry storm);
  - every request sends `X-App-Version`, `X-App-Build`, `X-Platform`, `X-Device-Id`;
  - a fault-injection hook: `EXPO_PUBLIC_FAULTS=offline|slow-3g|drop-attempt-30`.
- Boot when offline with a cached user: Home renders from the cache in read-only mode with the offline banner.
- Phase 2 slice only: the app temporarily uses the legacy 7-day token in secure-store. Phase 4 replaces it, with a one-time migration that re-logs in through refresh, otherwise prompts login.

### 2.5 Styling and design tokens

- **Approach.** Plain `StyleSheet` plus `@tac/core/tokens` plus `src/ui` primitives. No NativeWind or Uniwind, and no runtime theming: the app is dark-only (`userInterfaceStyle: dark`, system UI `#1d1b20`, light status bar). Screens never use raw hex. Any new colour goes through `tools/assets/bake-fade.py` first.
- **Primitives:**
  - `AppText` variants: display, title, sectionTitle, plateLabel, eyebrow, label, value (tabular-nums), body, caption. One font family per weight, em letter-spacing converted to px, `maxFontSizeMultiplier` on display, plates, timers and board labels.
  - `PlateButton` sm/md/lg: 3-slice ember and slate caps at @2x/@3x from `design-src`. Press: Reanimated 100 ms `translateY(1)` plus a dark overlay (0.2 ember / 0.14 slate), with a haptic on pressIn.
  - `Card` / `HeroCard`: slate texture via `resizeMode="repeat"` plus a gradient veil.
  - `Well`: New-Architecture inset `boxShadow`.
  - `Segmented` with a sliding plate indicator, `Toggle` (carved well), `Input` and `PasswordInput` with `textContentType`/`autoComplete` for keychain autofill, `Sheet`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`.
  - `Avatar` (baked slate disc PNG plus initials, creator crown, verified badge), `StreakBadge`, `StyleIcon`/`BandIcon` (expo-image tintColor), `ThemeIcon` (43 glyphs, C2PA-stripped and SVGO'd, through react-native-svg).
- **Background.** One static vignette plus top-glow PNG behind the root navigator. Surfaces use opaque 92% fills instead of blur, except the pause overlay, which uses expo-blur on iOS and 92% ink on Android.
- **Fonts.** Embedded with the expo-font config plugin: Manrope 400–800, Cinzel for Latin display, and a **Cyrillic-capable display serif for uk** (candidates Forum, Cormorant SC, Prata; the owner picks from the Phase 1 sheet). Oswald is not shipped. A `fontFamily(lang, role)` helper switches the face.
- **Highlight blue.** Use the single authoritative value `rgb(47,95,158)` as rendered, unless the owner says otherwise.
- **Dev route** `/dev/kitchen-sink` renders every primitive in every state in en and uk. It is the only screen with pixel baselines; everything else gets archived screenshots that the agent reviews itself.

### 2.6 Board (`src/board`, in-house, no Skia)

Built from Views, Reanimated 4.7 and the RNGH 3.3 hook API. Skia is excluded because of the `@shopify/react-native-skia` 2.14 freeze versus the v3 Vulkan/minSdk 26 store exclusion.

**Layers, bottom to top:**
1. **Board.** One pre-baked 8×8 image (bake-board.py output at 2048 px; colours are invariant under a 180° flip), plus a coordinates `Text` layer scaled to `sq*0.2`. Size = `floor(min(w,h)/8/px)*8*px` via onLayout, inside a fixed top slot, so the board sits at the same y on every board screen.
2. **Highlights.** Last move, selection, check radial (pre-rendered PNG), legal dots and capture rings, hint pulse ring, drop ring. All are driven by SharedValues (`selectedSq`, `hoverSq`, a legal-target bitmask as two int32 halves), so selecting a piece never renders React.
3. **Pieces.** At most 32 `Animated.View`s with expo-image WebP at 256 px, preloaded at splash. Keys are **stable piece ids** from a FEN-to-FEN diff, so every move slides: setup, opponent reply, tap-move settle, castling rook, captures fading and scaling out. The fit tables apply 94% origin compensation, including to moving pieces, which fixes the web "pop".
4. **Feedback.** Square flash (500 ms), 14 spark views on one progress value in **OverlayHost** (so they can leave the board, scaled by sq/50), 340 ms piece shake, solved pop.
5. **Arrows.** react-native-svg for hint and solution arrows. User-drawn long-press arrows are deferred behind a flag, and `knightArrow` stays hidden.
6. **PromotionPicker** column, with the queen nearest the target, using the web placement rules.
7. **DragOverlay** in OverlayHost. The piece is lifted about 0.6 sq above the finger (tunable), with a spring scale of about 1.08–1.12 and a 180 ms spring snap-back.

**Input.** One `usePanGesture({minDistance:0})` plus one `useTapGesture` on the container, combined with `useExclusiveGestures`. The code never mixes v2 builder APIs.
- Hit-testing is a worklet (`xyToSquare` with the flip and mirror).
- A move of 4 px or more enters drag mode.
- A hover change onto a legal square gives a throttled tick.
- Illegal drop: snap-back and a soft rigid haptic.
- Legal moves for the side to move are precomputed with chess.js on JS at every FEN change and pushed into SVs, so first-touch latency is zero.
- Commit: `scheduleOnRN(onMove)`, then a chess.js validation on JS.
- Input is blocked while the opponent is moving. This is a deliberate improvement over the web; the default is recorded in Decisions.

**Imperative handle.** `setPosition(fen, lastMove)`, `animateMove(from,to,ms) → Promise` (withTiming, `Easing.bezier(0.4,0,0.2,1)`), `flash(sq, ok)`, `shake(sq)`, `sparks(sq)`, `setHint(level, from, to)`, `setInteractive(bool)`, `reset(fen, orientation)`. The runner awaits these promises. `grep setTimeout src/board` must return nothing.

**Accessibility and testing.** Each square has `accessibilityLabel` ("e4, white knight") and works with VoiceOver tap-to-move. Test IDs: `sq-e4`, `piece-e4-wN`, `check-e1`, `lab-fen`, `board-last-move`. A dev-only `board-render-count` is read by Maestro. `useReducedMotion`: sparks and shake off, infinite pulses become static rings, slides kept at 120 ms because the motion conveys the move.

### 2.7 Puzzle runner

- **Pure reducer** in `@tac/core/runner`:
  - Phases: `booting → setupAnimating → playerTurn → opponentReplying → resolving → loadingNext → finishing → summary`. `paused` is an orthogonal flag that cancels and defers pending effects, which fixes the web timeouts that kept landing under the pause overlay.
  - Effects are data: `animate`, `feel`, `api(attempt|next|finish)`, `schedule(ms)`, `persistSnapshot`.
  - **Modes** `session | drill | mistakes | viewer`, one runner for four screens. This deliberately unifies the opponentBusy guard, the fixedColor policy and the reset behaviour.
  - Fixes ported in: the style is taken from the response, never from previous state (the stale-closure bug that wrote other styles' ratings into blitz); theme sessions never patch progressions; state is immutable FEN strings, never a mutated `Chess` instance.
- **`usePuzzleRunner`** interprets the effects with cancellable timers and the board promises.
- **`<Countdown>`** holds `endsAt` in a ref and re-renders only itself at 1 Hz. The warning pulse is a Reanimated ring. Last-5-s ticks are haptic.

### 2.8 Sound and haptics: the feel layer (`src/feel`)

- **`feel.emit(event)`** is the single choke point. It looks up `FEEL_TABLE` from core and fires sound and haptic in the same frame. It respects `soundEnabled`, the volume and the independent `hapticsEnabled`. Web inconsistencies fixed here:
  - the winning-move click is suppressed;
  - a mistake plays the thud plus an Error haptic only, not the web's click+thud overlap;
  - check and castle sounds also play on review replies;
  - opponent sound and haptic fire **at landing**.
- **Sound** uses react-native-audio-api 0.13.6:
  - One AudioContext. Every clip is decoded into an AudioBuffer at splash. Each play uses a fresh `BufferSource` into a master Gain (`volume*0.9`).
  - Long clips fade with `linearRampToValueAtTime` and stop on background and on interruptions. The context suspends on background and resumes on active.
  - The iOS session is `ambient` + `mixWithOthers`: it respects the silent switch and never stops the user's music.
  - Facade API kept from the web: `sfx`, `stopLongClip`, `moveSoundEvent`. Fallback: an expo-audio player pool behind the same interface, built only if the Phase 1 spike fails.
- **Asset pipeline** (`tools/audio`, offline):
  - leading-silence trim at −40 dBFS with a 3 ms pre-roll;
  - board clips levelled to −29 dBFS RMS;
  - 48 kHz mono 16-bit WAV for short clips, AAC m4a for rank and long clips;
  - `mistake_thud` and `gate_gongswell` pre-rendered from `engine.ts` through an OfflineAudioContext (headless browser);
  - the orphan `correct.mp3` and `fail.mp3` are dropped;
  - ceremony clip hit points are measured offline, to align the haptic timelines.
- **Haptics.** A facade over **expo-haptics** (`performAndroidHapticsAsync` on Android) is the baseline. **react-native-pulsar 1.7** is adopted only if the Phase 1 device spike shows a clear win for worklet-fired patterns. Even then it only replaces the engine behind the facade, for the ceremony, gate and castle patterns. Haptics stay on under reduced motion.
- **FEEL_TABLE defaults.** These are tunable, with a history kept in `docs/mobile/FEEL.md`.

| Event | Haptic | Sound |
|---|---|---|
| Pickup | selection | none |
| Hover onto a legal square | light tick | none |
| Drop | Light | move click |
| Capture | Medium | capture |
| Check | Rigid | check |
| Castle | Light ×2, 80 ms apart | castle |
| Promote | Medium, then Light | promote |
| Illegal | soft Rigid | none |
| Opponent landing | Soft at 60% | on landing |
| Correct | Success | correct sting; winning click suppressed |
| Mistake | Error | thud only |
| Streak up (≥2) | Light; Medium at 5, Heavy at 10 | none |
| Streak broken | Warning | none |
| Timer threshold | Warning once, then a Rigid tick per second for the last 5 s | none |
| Pause / resume | Light | none |
| Exit sheet / Discard | Warning / Heavy | none |
| Norm gate up | Soft at 0, Medium at 550 ms | gate clip |
| Norm rise / drop | Success at 360 ms / Warning at 270 ms | per clip |
| RankCeremony up | Soft, a light-tick crescendo over 950 ms, then Heavy + Success at the flash | ceremony clip |
| RankCeremony down | Warning at 0, Soft at 750 ms | rankDown variant |
| Segmented / tab change | selection | none |
| Toggle | Light | none |
| Slider | tick per 25 pts; Medium at a magnet detent; Warning + rubber-band at the locked cap | none |
| Sheet detent | Soft | none |
| Refresh trigger | Light | none |
| Achievement toast | Success (throttled) | none |
| Form error | Error + shake | none |

### 2.9 Notifications

- **Local first (Phase 9, no accounts needed).** A daily streak-at-risk reminder at a local hour (default 20:00), cancelled and rescheduled after each finish using core `streakState` and `applyStreakOnPlay`, plus a freeze-regenerated reminder at `freezeRegenAt`. A soft pre-prompt asks for permission after the first finished session.
- **Remote (Phase 10, needs accounts).**
  - expo-notifications ~58.1.6 and the Expo Push Service through expo-server-sdk 8.0.0.
  - Android channels streak, social and achievements are created before the token request.
  - iOS category for friend requests with Accept and Decline actions.
  - Foreground pushes become an in-app toast plus haptic instead of a banner.
  - The response listener and `getLastNotificationResponseAsync` route through expo-router.
  - The device is registered on login, on token change and on foreground, and unregistered on logout before the tokens are dropped.
  - Server: chunks of 100, receipts polled about 15 min later, DeviceNotRegistered pruned, en/uk copy on the server, caps (1 streak push and 3 total per user per day), quiet hours, SETNX dedupe `push:streak:{uid}:{localDate}`.

### 2.10 Offline and session robustness

- **Background.** `AppState` background or inactive auto-pauses the runner and cancels pending effects. Time spent backgrounded does not count, which matches the existing pause semantics.
- **Snapshot.** After every transition the runner writes `{sessionId, style, mode, remainingMs, paused, puzzle (full object), ply, counters, streak, pendingAttempt}` to MMKV `session`.
- **Cold start:**
  - With a snapshot: Home shows a resume card (Resume / Finish / Discard). Resume restores the **same puzzle** and the remaining time.
  - With only `GET /api/v1/sessions/active` (no snapshot, e.g. after a reinstall): **Finish (save) / Discard only**, because the server cannot know the remaining active time [verified].
  - If the server already swept the session: show its summary via `GET /sessions/:id`.
- **Idempotency.** Every attempt carries a `clientAttemptId` (UUID). The server keeps a unique column plus a 24 h Redis cache of the response, so a replay returns a byte-identical body and steps the rating once. `/next` accepts an optional `requestId`, which replays the same puzzle for 5 min, so a retry never loses a puzzle. With the optional `includeNext:true`, `/attempt` returns `next` in the same round-trip. The rating changes after each attempt, so `/next` must otherwise wait for the attempt.
- **Network loss.** Exponential retry. After about 3 s the runner auto-pauses behind a reconnect overlay, so no time is burnt. The outbox flushes **in order** on reconnect, because rating-window ordering uses the server's `createdAt`. `finish` carries `localDate` plus the IANA `tz`.
- **Server hygiene.**
  - `EXPIRE` on `session:{sid}:queue` and `:seen` (durationSec + 24 h).
  - `DELETE /sessions/:id` also clears the buffer.
  - The **sweeper** runs on `@nestjs/schedule` every 10 min under a Redis lock. It finalises sessions with `endedAt` null whose **last activity** (latest attempt or `startedAt`) is more than 12 h old. Default policy: 0 attempts means delete; otherwise save as early exit (stats recorded, no unlock, demote or calibration change, no streak tick).
- **Finish response.** Gains an additive `progression`. The client patches the store from it and also invalidates `['me']`.

### 2.11 Testing

| Layer | Tooling | What it proves |
|---|---|---|
| `@tac/core` | vitest | Rules parity with the backend (>10k inputs); runner transition table (pause during the opponent reply, background during the setup slide, attempt failure and retry, double finish, discard with 0 attempts, timer end during a reply, /next retry then finish); outcome selectors on 10 recorded finish payloads; geometry for all 64 squares × 2 orientations; chart math; en/uk key parity and uk plural forms |
| `apps/mobile` units | jest-expo ~58.0.12 + RNTL 14.1 | Primitives, hooks, the 64 square a11y labels, a reduced-motion snapshot |
| `apps/mobile` e2e | Maestro 2.11 in `.maestro/` | Acceptance flows per phase on the iOS sim and Android emulator, asserted through testIDs plus psql/curl against the local backend |
| E2E hooks | `EXPO_PUBLIC_E2E=1` builds | Hidden `e2e-solve` / `e2e-wrong` buttons dispatch through the real `handleMove` path; `board-last-move`, `board-render-count`, `runner-timer`, `puzzle-id`, a dev store dump; compiled out of release (grep the release bundle) |
| Perf | FrameStats (useFrameCallback deltas: p50, p95, % over 16.7 / 33 ms) + render counters, Release builds only | Board, runner, lists, charts |
| Faults | `EXPO_PUBLIC_FAULTS`, `docker pause taktic_backend`, `xcrun simctl terminate`, backgrounding to `com.apple.Preferences` | Robustness |
| Backend | jest + supertest e2e (local docker Postgres 5433, Redis 6380) | Every new endpoint |
| Contract | **web-contract golden test** + `tools/contract/legacy-smoke.ts` | Every request shape the web sends, replayed against main and the branch, with status codes and response keys diffed; `/api/x` and `/api/v1/x` both 200 |
| Data | Parameterised `seed-test-sessions.ts` + `seed:e2e` | Users `e2e_fresh`, `e2e_calibrating`, `e2e_stable_at_peak`, `e2e_weak_streak`, `e2e_social`, `e2e_friend`, with known passwords in the git-ignored `apps/mobile/.maestro/.env.e2e`, seeded into the local DB only |

**CI.** The build job moves to node 22, with a strict `--frozen-lockfile` (no `|| pnpm install`). Add `pnpm -r --if-present run test`. A `mobile` job runs `expo-doctor`, the mobile typecheck, jest and core vitest. A `dorny/paths-filter` gate skips the deploy job unless `apps/backend/**`, `apps/frontend/**`, `deploy/**` or `docker-compose*.yml` changed. EAS Workflows Maestro runs arrive in Phase 10.

---

## 3. Stack

Always install with `npx expo install`; if `expo-doctor` disagrees with a version here, `expo-doctor` wins. The versions are from `stack-research.md`, checked 2026-10-25.

| Topic | Choice and version | Why |
|---|---|---|
| Runtime | Expo SDK 58 (`expo ^58.0.19`), react-native 0.88.0, react 19.3.0, Hermes V1, New Architecture (the only option), React Compiler on (`'use no memo'` escape hatch), typedRoutes | Current SDK. Every perf library needs the New Architecture. The compiler gives automatic memoisation. |
| Dev builds | `expo-dev-client ~58.0.14`; `npx expo run:ios / run:android`; CNG with no committed native dirs | SDK 58 Expo Go is not shipped. Local builds need no accounts. |
| Package manager | pnpm 9.12, isolated linker; `.npmrc node-linker=hoisted` only as a fallback | Isolation keeps React 18 and 19 apart. `.npmrc` never reaches Docker. |
| Navigation | `expo-router ~58.0.25`, NativeTabs (5), `Stack.Protected`, formSheet, fullScreenModal | File routes mirror the Next tree. Native tab bar, sheets and predictive back come free. |
| Animation | `react-native-reanimated 4.7.1` + `react-native-worklets 0.13.0` | UI-thread animation at 120 Hz. Web keyframes port with the same beziers. |
| Gestures | `react-native-gesture-handler ~3.3.0`, hook API only | Worklet callbacks fire frame-exact feedback. Mixing API generations is forbidden. |
| Chess logic | `chess.js ^1.4.0` (in core) | Already used by web and backend. Pure JS. |
| Board | In-house Views + Reanimated + expo-image WebP + react-native-svg arrows | Full puzzle UX control, without Skia's package split or the Vulkan exclusion. |
| Storage | `react-native-mmkv 4.3.2` + `react-native-nitro-modules 0.37.1` (per the MMKV compat table); instances `app`, `query`, `session` | Synchronous first frame, snapshot that survives a kill. |
| Secrets | `expo-secure-store ~58.0.2` (AFTER_FIRST_UNLOCK) | Keychain/Keystore. |
| Server state | `@tanstack/react-query 5.104.5` + persist-client + sync-storage persister; `expo-network ~58.0.4` | Same library and keys as the web. |
| Client state | `zustand 5.0.16` | Same as the web. Toast store ports verbatim. |
| Audio | `react-native-audio-api 0.13.6`; fallback `expo-audio ~58.0.10` | Web Audio semantics port the existing engine. Sample-accurate overlapping playback. |
| Haptics | `expo-haptics ~58.0.7` baseline; `react-native-pulsar 1.7.0` only after the device spike | Low risk first; richer patterns as a measured upgrade. |
| Lists | `@shopify/flash-list 2.3.2` | SDK-validated. |
| Charts / icons | `react-native-svg 15.16.0` (charts hand-ported; heatmap as 5 batched paths); `lucide-react-native 1.61.0`; `expo-symbols` for tabs | The web charts are hand-rolled SVG already. Same icon names. |
| Images | `expo-image ~58.0.16`; `expo-image-picker` (allowsEditing 1:1) + `expo-image-manipulator` | Caching and tint. The system crop replaces react-easy-crop. |
| Forms | `react-native-keyboard-controller 1.22.7` | Keyboard avoidance and autofill-friendly inputs. |
| Misc Expo | expo-font, expo-splash-screen, expo-keep-awake, expo-navigation-bar, expo-status-bar, expo-blur, expo-linear-gradient, expo-localization, expo-web-browser, expo-build-properties | SDK-pinned. |
| Push | `expo-notifications ~58.1.6`; backend `expo-server-sdk 8.0.0`, `@nestjs/schedule` | One token type for APNs and FCM. Local reminders work before accounts exist. |
| Backend additions | Nest URI versioning, `@nestjs/throttler` (Redis storage), helmet, jest + supertest | Stable contract for installed binaries. Security hardening. |
| Testing | vitest; `jest-expo ~58.0.12`; `@testing-library/react-native 14.1.0`; Maestro 2.11 | Everything runs locally and unattended. |
| Release | EAS Build / Submit / Update (fingerprint runtimeVersion), EAS Workflows | Starts once accounts exist (Phase 10). |
| Observability | `@sentry/react-native ~8.28` + `@sentry/nestjs` (or EAS Observe, owner choice) | Needed before TestFlight. |

**Rejected:** Skia (package split, Vulkan), NativeWind/Uniwind (no gain for one dark theme, extra plugin risk), `@gorhom/bottom-sheet` (RNGH 3 unproven), notifee (archived), react-native-chessboard (immature, no arrows), OpenAPI codegen (too much change in prod code for v1).

---

## 4. Backend changes

All of these are backwards-compatible with the live web. Each lands as its own small PR from a short-lived `api/<topic>` branch cut from `main`, merged by the owner. Before the first migration deploy: `pg_dump`.

**Rules for every PR:**
- additive migrations only (nullable or defaulted columns, new tables);
- optional DTO fields only;
- new response fields only;
- new routes;
- the web-contract golden test and the legacy smoke are green;
- the PR body contains a "web impact" statement and a prod verification checklist.

| # | Change | Web impact | Needed by phase |
|---|---|---|---|
| B0 | **Test harness**: jest + supertest e2e (docker 5433/6380), golden tests for rating, unlock and streak, web-contract golden test, `tools/contract/legacy-smoke.ts`. Parameterised `seed-test-sessions.ts` + `seed:e2e`. | None (dev only) | 0 (seed), 3 (harness) |
| B1 | **CI PR**: node 22, strict frozen lockfile, `--if-present test`, mobile job, deploy paths-filter. Root engines untouched. | None | 0 |
| B2 | **Bootstrap hardening**: `enableVersioning({type: URI, defaultVersion: [VERSION_NEUTRAL,'1']})`, `trust proxy 1`, `enableShutdownHooks`, helmet, `GET /api/health`, JWT_SECRET fail-fast (remove the `dev-secret` fallback; **confirm the VPS env has it first**), global Prisma P2025→404 filter. | `/api/*` unchanged. P2025 becomes a 404 where it was a 500. | 3 |
| B3 | **App config**: `GET /api/v1/app-config {minSupportedBuild{ios,android}, latestBuild, storeUrls, featureFlags, maintenance}` from env, plus a 426 middleware **only when `X-App-Build` is present**. | None | 3 (client gate in 4) |
| B4 | **Auth refresh**: `RefreshToken` model (tokenHash unique, familyId, deviceId, expiresAt, revokedAt, replacedById) and `User.tokenVersion Int @default(0)`. Optional `client`, `deviceId` on Login/RegisterDto; refresh issued only for `client:'mobile'`. `POST /auth/refresh` (rotation + family reuse revoke), `/auth/logout`, `/auth/logout-all`. JwtStrategy checks `tv` via a 60 s Redis cache (missing `tv` = 0). | Web keeps its 7 d token. No `tv` bump on the web path while the web is alive. | 3 (used from 4) |
| B5 | **change-password**: wrong current password returns **403** (all clients); success revokes other refresh families. | **Web bug fix**: a typo no longer logs the user out. | 3 |
| B6 | **Session lifecycle**: `TrainingAttempt.clientAttemptId String? @unique` + optional `clientAttemptId` + 24 h response cache; optional `includeNext`; `/next` optional `requestId` (5 min replay); `responseMs` max 3 600 000; `serverNow` on create/next; `GET /sessions/active`; `finish` accepts optional `tz` (→ new nullable `User.timezone`) and returns additive `progression`; Redis EXPIRE on queue/seen; DELETE clears the buffer; `ZREMRANGEBYSCORE user:{uid}:recent` beyond 30 d. | Web sends none of the new fields, so behaviour is identical (rating transcript test before and after). | 3 (used in 5) |
| B7 | **Sweeper** (`session-sweeper.service.ts`): every 10 min, Redis SETNX lock, idle > 12 h on last activity, owner policy (default above). | Orphans become finished early-exit rows (they show up in lists). Owner approves. | 3 (enabled after the owner's policy answer) |
| B8 | **Rules fix (gated on the owner)**: separate the entry floor from "last picked start" (e.g. keep `startPuzzleRating` as the floor and add `lastStartRating`). Before/after fixtures. | Changes demote and calibration outcomes for web users too, so it is a deliberate rules change. | 3 or 5 |
| B9 | **Lists**: `GET /api/v1/sessions?cursor=&limit=&style=` (finished, `startedAt` desc); `/review/themes` adds `firstPuzzleId`; `/review/:puzzleId/resolve` idempotent (updateMany). | Additive | 3 (used in 6) |
| B10 | **Account deletion**: `DELETE /api/v1/users/me {password}` → cascade, unlink `uploads/avatars/{id}.*`, revoke refresh tokens and push devices, 204. | New route | 3 (UI in 9) |
| B11 | **Throttling**: `@nestjs/throttler` with Redis storage. Login 5/min/IP + 10/h/nickname, register 3/h/IP, refresh 30/min, search 30/min, avatar 10/h, friends/request 30/h, global 120/min per user (per IP when anonymous). Lands **after** B2's `trust proxy` is verified in prod logs. | Abusive bursts get 429. The web shows the message. | 3 (last PR) |
| B12 | **nginx**: gzip for `application/json`. | Faster | 3 |
| B13 | **Analytics**: structured `{weakness, failureRate, avgResponseMs}` next to the English `reason`. Leaderboard `me: {rank, rating}` when the viewer is outside the top N. Case-insensitive `by-nickname`. | Additive | 7 / 8 |
| B14 | **Friend accept**: persist the requester's unlocked achievements with `UserAchievement.notifiedAt` (nullable), so the requester is toasted on next open (today they are discarded). | Additive | 8 |
| B15 | **Notifications module**: `PushDevice` (unique token, reassigned on account switch), `NotificationPreference` (or UserSetting columns), `NotificationLog`; `POST/PATCH/DELETE /api/v1/devices`; `GET/PATCH /api/v1/users/me/notifications`; push.service + receipts job; scheduler (streak_at_risk by timezone, freeze_regenerated, optional weekly review_backlog); event hooks in `sendRequest` and `accept`; off-device achievement fan-out; `POST /api/v1/admin/push/test`. | Additive | 10 |
| B16 | **nginx `/.well-known`**: `apple-app-site-association` and `assetlinks.json` as `application/json`, no redirect, from `deploy/well-known/`. Static `/privacy` and `/delete-account` pages from `deploy/static/`. | Additive | 10 / 11 |
| B17 | **Ops**: bind Postgres to `127.0.0.1:5432` in `docker-compose.yml`; `@sentry/nestjs`; `X-App-Version` request logging. | None | 10–11 |
| B18 | **Post-retirement**: after 14 days with no unversioned app traffic (except admin), move admin to v1, drop `VERSION_NEUTRAL`, stop issuing 7 d tokens, bump `tv` on change-password, drop deprecated settings columns, optionally import `@tac/core` in the backend (Dockerfile copies `packages/core`). | Web gone | 12 |

The avatar uses the **existing** `POST /users/me/avatar {dataUrl}` with a client-side resize to a 512 px JPEG at q0.8, and the client composes absolute URLs with `assetUrl`. Multipart upload with sharp re-encoding is in IDEAS.md for after launch.

---

## 5. Phased roadmap

Sizes are in agent nights. Every phase exits with checks that pass on the **iPhone 17 simulator** and, from Phase 0 on, on the **Android emulator** unless stated otherwise. Screenshots go to `docs/mobile/screens/<phase>/`.

### Phase 0: Foundation (2–3 nights)

**Goal.** A branded empty app builds and runs on iOS and Android. The shared core is extracted with tests. The agent toolchain works. Nothing outside `apps/mobile`, `packages/core`, `tools`, `docs` and the CI PR changes.

**Mobile work**
- Scaffold with `pnpm create expo-app --template default@sdk-58`, strip the template, router root `src/app`.
- `app.config.ts`:
  - name tac·tic·tak, scheme `tactictak`, placeholder `online.tactictak.app`;
  - portrait, `supportsTablet:false`, dark, `#1d1b20`;
  - `CADisableMinimumFrameDurationOnPhone: true`;
  - typedRoutes, reactCompiler;
  - entitlements gated by `APPLE_TEAM_KIND=personal|paid`.
- `.easignore` excluding `/.env`, `/.claude-test-account`, `apps/backend/data`, `docs`. Gitignore `ios/` and `android/`.
- Install the SDK-pinned base set. `expo-doctor` clean. Confirm Metro resolves `@tac/core` under the isolated linker.
- Create `packages/core` with all modules from §2.1: rules copies plus the parity test, i18n moved verbatim (en 376 / uk 377 keys plus 83 landing keys each) with the key-parity test, tokens, geometry, feel catalogue.
- Asset pipeline v0 (`tools/assets`, `tools/audio`):
  - pieces to WebP @256;
  - the baked board image;
  - 3-slice plates at @2x/@3x from design-src;
  - slate texture, mode/band/nav icons, knight logo, avatar disc, vignette/glow PNG;
  - SVGO'd theme glyphs;
  - processed sfx plus the 2 synth renders;
  - `public/brand` (9.6 MB) excluded.
- Root layout with fonts and splash gate. A hello screen renders `initPuzzle` on a fixed FEN.
- Android: Homebrew `android-commandlinetools`, `sdkmanager` (platform-tools, emulator, API 35 arm64 google_apis image), AVD `pixel_api35`.
- Maestro, and `.maestro/00-smoke.yaml`.
- Docs: root, `apps/mobile` and `apps/backend` CLAUDE.md files; `docs/mobile/{PROGRESS, DECISIONS, OWNER-QUESTIONS, PARITY, IDEAS, FEEL}.md`. PARITY.md is generated from the §6 checklist.

**Backend work**
- B1 (CI PR to main).
- B0 seed parameterisation, on the mobile branch for now.
- Local stack: `pnpm db:up`, migrate, `puzzles:import` from `apps/backend/data/lichess_db_puzzle.csv.zst`.
- LAN runbook. API URLs: `http://localhost:4000/api` from the iOS sim, `10.0.2.2` from the Android emulator, the Mac's LAN IP from the phone.

**Exit criteria**
- `pnpm install --frozen-lockfile && pnpm -r run typecheck && pnpm -r run build` pass on node 22, and also on node 20, because the Docker images and CI before B1 still use it.
- `pnpm why -r react` shows 18.3.1 only under frontend and 19.3.0 only under mobile. There is a single react-native.
- `pnpm --filter @tac/core test` is green: parity on 10k inputs for computeRatingStep, evaluateUnlock, evaluateCalibration, evaluateDemote and applyStreakOnPlay; i18n key parity.
- `docker build -f apps/backend/Dockerfile .` and `-f apps/frontend/Dockerfile .` succeed unchanged. Root `pnpm dev` starts only backend and frontend.
- `pnpm --filter mobile ios` and `pnpm --filter mobile android` boot. `maestro test .maestro/00-smoke.yaml` passes on both. Editing a core string hot-reloads (before/after screenshots).
- `git diff main --stat -- apps/frontend apps/backend/src apps/backend/Dockerfile deploy` is empty.
- After the B1 merge: CI is green on a PR from `mobile`, and the deploy job reports "skipped" for a docs-only push.

**Owner provides.** Confirm the app name, bundle id / package (hard to change after the first upload) and scheme. Review and merge the CI PR. Optionally create a free Expo account.

### Phase 1: Board and feel lab, a measured gate (4–5 nights)

**Goal.** Retire the experience risks with numbers before any product screen exists.

**Mobile work**
- `src/dev` route group behind `__DEV__` or `EXPO_PUBLIC_DEV_MENU=1`: bench, board-lab (`?fen=&orientation=`), feel-lab (one button per event, plus scheduling-latency log and per-event intensity sliders written to MMKV, with a JSON export), typography sheet, kitchen-sink, tuning panel.
- Board v1, complete per §2.6.
- FrameStats logger, render counters, and a "JS jam" button that busy-loops the JS thread for 500 ms.
- Sound engine per §2.8, plus a metronome screen (flash plus click every 500 ms).
- Haptics facade, plus a Pulsar trial screen that calls patterns from inside the pan worklet (trial only).
- Brand primitives v1: PlateButton in all states, Card, Well, Segmented, Toggle, Input.
- Typography sheet in en and uk with Cinzel against 2–3 Cyrillic candidates.
- Mock screens for NativeTabs and for a custom tab bar.
- Release builds: `expo run:ios --configuration Release`, `expo run:android --variant release`.

**Backend work.** None. Read-only latency probe of `/next` (warm vs cold queue) recorded in DECISIONS.md; it decides how much `includeNext` matters.

**Exit criteria**
- **Perf (Release, iPhone 17 sim).** A Maestro flow of 60 drags and 60 tap-moves gives UI-thread frame p95 ≤ 17 ms and fewer than 1% of frames over 33 ms. Board and Square React commits during drags = 0. The p95 still holds while "JS jam" runs. Android emulator Release: p95 ≤ 17 ms.
- **Correctness.** vitest geometry for all 64 squares × 2 orientations. Maestro board-lab flows assert `lab-fen` for each case:
  - tap e2→e4;
  - drag g1→f3;
  - illegal drop snaps back with the FEN unchanged;
  - promotion to knight gives `piece-a8-wN`;
  - castling moves 2 piece views;
  - en passant;
  - flipped board;
  - check overlay `check-e1`.
- `grep -r setTimeout apps/mobile/src/board` is empty. Over 50 runs, `animateMove` resolves within ±1 frame of the requested duration.
- **Audio.** 20 overlapping triggers in 1 s play without errors. The first sound after a cold start plays. Background, foreground, play works. Gesture-end to `source.start()` p95 < 5 ms. Every processed clip's onset is ≤ 3 ms. All 13 clips play on Android.
- Screenshots of the typography sheet (en/uk), plates in every state and both tab-bar options.
- DECISIONS.md has an entry with numbers for: board approach, audio engine, haptics engine, tab bar, display font, linker.

**Owner provides**
- Install a dev build on the iPhone with a free Apple ID: `pnpm --filter mobile ios:device`, Release configuration.
- Judge drag feel at 120 Hz and the haptics.
- Film the metronome screen in 240 fps slow motion; the target is under 30 ms between flash and click.
- Check that Spotify keeps playing and how the silent switch behaves.
- Pick the Cyrillic font and the tab-bar style.
- Optionally export tuning JSON.

### Phase 2: Vertical slice on the existing API (3–4 nights)

**Goal.** The owner logs in on his phone, plays a full timed blitz session on the native board with synced feel, and sees a basic summary. There are **zero backend changes**, so the backend contract (Phase 3) can be shaped by a working app.

**Mobile work**
- Minimal login: legacy 7 d token in secure-store, temporary.
- Bootstrap from `/users/me`.
- `@tac/core/runner` with the `session` mode, plus `usePuzzleRunner` and `<Countdown>`.
- Minimal setup: style Segmented, DifficultySlider v1 (UI-thread pan, 25-pt ticks, magnet detents, locked-cap rubber-band), duration presets. Start calls `POST /sessions` and stashes the first puzzle.
- Runner: top slot (exit, timer, pause), TurnCard plus streak chip, stat pills, pause overlay, ExitSheet with back blocked, keep-awake, immersive chrome, AppState auto-pause.
- Basic summary (stats grid, Home and Play again), then invalidate `['me']`.
- FEEL_TABLE wired for every board event.
- E2E hooks.

**Backend work.** None (`/sessions`, `/next`, `/attempt`, `/finish`, `/users/me` as they exist).

**Exit criteria**
- `maestro test .maestro/02-slice.yaml` (user `e2e_stable_at_peak`, local backend) passes on iOS and Android:
  - log in, blitz with a custom 1 min, Start;
  - 3× `e2e-solve` and 1× `e2e-wrong`;
  - background to Preferences for 20 s, relaunch, paused overlay with a frozen time (±1 s), Resume;
  - time-up gives a summary of Solved 3 / Failed 1;
  - psql: 4 TrainingAttempt rows and `endedAt` set.
- Exit with 0 attempts goes straight Home and the session row is gone. With ≥1 attempt, the iOS edge swipe and Android back open the ExitSheet.
- `board-render-count` is unchanged across 10 s of timer ticks.
- vitest runner scenarios: correct, wrong, alternative mate accepted, opponent reply, pause during a pending reply (the effect is deferred), timer end during a reply, /next retry then finish.

**Owner provides.** A phone session against the Mac's LAN backend with a seeded account (default; see Decisions for using prod). Feel notes in OWNER-QUESTIONS.md using the `[feel]` / `[look]` / `[bug]` / `[decision]` tags.

### Phase 3: Backend mobile contract v1 (3–4 nights plus owner review)

**Goal.** Everything mobile needs up to TestFlight, except push and universal links, is on `main` and deployed, with tests proving the web is unaffected.

**Mobile work**
- `createApiClient` against v1 per §2.4.
- Response types plus zod schemas for every route mobile uses.
- vitest: 10 parallel 401s cause exactly 1 refresh, and all 10 requests are retried.

**Backend work.** B0 harness, then B2, B3, B4, B5, B6, B9, B10, B12, then B11 last, then B7 and B8 once the owner has answered. Six or seven PRs.

**Exit criteria**
- `pnpm --filter backend test:e2e` covers:
  - `/api/x` and `/api/v1/x` both 200;
  - web login keys and 7 d `exp` unchanged (golden);
  - mobile login returns `refreshToken`;
  - refresh rotates, and reusing an old token revokes the family;
  - a `tv` bump invalidates access tokens;
  - the same `clientAttemptId` posted ×5 gives exactly 1 row (psql), one rating step and byte-identical bodies, including `next`;
  - `/next` with the same `requestId` returns the same puzzle;
  - `/sessions/active`;
  - the sweeper on a seeded idle session follows the policy, and every `session:*` key has TTL > 0;
  - DELETE `/users/me` removes the row, the cascade and the avatar file;
  - the 6th login in a minute gets 429 with Retry-After;
  - `X-App-Build` below the minimum gets 426, and no header gets 200;
  - a wrong current password on change-password gets 403.
- Rating transcript of a scripted session is identical before and after (excluding the opt-in B8).
- Local web smoke against the new backend passes: `pnpm --filter frontend dev`, then a scripted browser run of login, a 1-min session, finish and a settings save, with no console errors.
- After each merge and deploy: `curl https://tactictak.online/api/health` and `/api/v1/health` return 200, and `/api/v1/app-config` returns JSON. The scripted prod smoke uses a throwaway account, never `.claude-test-account`, and only GET routes unless the owner approves.

**Owner provides**
- `pg_dump` before the first migration deploy, then review and merge each PR.
- VPS env: `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `MIN_SUPPORTED_BUILD_IOS/ANDROID`, a confirmed `JWT_SECRET`, plus the compose passthrough.
- Decisions on the sweeper policy and on `startPuzzleRating`.
- A spot-check of the web after deploy.

### Phase 4: Shell, auth, data layer, i18n, onboarding (3 nights)

**Goal.** A navigable branded app with long-lived secure sessions, offline-tolerant data, en/uk, and the full primitive kit. Later phases only add screens.

**Mobile work**
- Full route tree with stubs, NativeTabs (or the custom bar chosen in Phase 1), header avatar menu, `+not-found`, error boundaries, `+native-intent`.
- Splash gate including app-config and the `update-required` screen.
- Refresh auth and the legacy-token migration.
- Stores and `resetAll`. MMKV query persister. Focus and online managers.
- `useT` / `useTn` (Intl.PluralRules `uk` checked on Hermes, `pluralizeUk` fallback). Initial language from expo-localization (`uk`/`ru` map to uk).
- Welcome pager. Login (shake plus Error haptic). Register with the live rule checklist (Light tick per satisfied rule).
- 5-slide onboarding modal gated by `onboardingCompleted`.
- ToastHost (drops from the top, swipe up to dismiss), OfflineBanner, Skeleton.
- Dev diagnostics screen (token expiry, MMKV keys, cache size, scheduled notifications).

**Backend work.** Integration fixes only. Local env profile `ACCESS_TOKEN_TTL=60s`.

**Exit criteria**
- `04-auth.yaml`, both platforms:
  - register, onboarding, Home;
  - `stopApp` + `launchApp` lands on Home with no login screen;
  - logout, login;
  - a wrong password shows a localised inline error.
- With a 60 s TTL: 3 minutes of navigation never shows login, and the backend log shows ≥3 rotations.
- `curl /api/v1/auth/logout-all`: the next app request routes to login, and diagnostics shows an empty cache and no user-scoped MMKV keys.
- `MIN_SUPPORTED_BUILD_IOS` above the dev build shows `update-required` on relaunch.
- An offline cold start with a cached user renders Home from the cache, with the banner.
- uk screenshots show Cyrillic headings and plates in the chosen face, on the iOS sim and the Android emulator (Hermes Intl check).
- Release-sim splash to Home in under 1.5 s (logged). RNTL tests pass for every primitive.

**Owner provides.** Design sign-off on the shell, auth and primitives from screenshots, on the phone if possible.

### Phase 5: Core training loop parity, robustness, Home (6–8 nights)

**Goal.** Setup, runner, summary, RankCeremony, streak and the Home dashboard at full parity, robust to backgrounding, kills and flaky networks, and proven by scripts.

**Mobile work**
- **Full setup:**
  - calibration pill `?done/5` and provisional hiding of the slider in mixed mode;
  - off-form card that suggests, never forces, a rating;
  - comfort notice, unlocked/cap legend, NextUnlockPreview, CalibrationPreview;
  - theme mode with the ThemePicker formSheet (weakest/popular/all tabs, search, FlashList);
  - custom minutes on a number pad;
  - startRating clamped on a theme-to-mixed switch (fixes the web's raw 400);
  - `initialStartRating` and `resolveDurationFor` from core;
  - DifficultySlider final: band-eye row, "you are here" marker, level-up zone colours, anchor labels, `accessibilityRole="adjustable"`.
- **Runner parity:** CalibrationProgressBar, UnlockProgressBar with CriterionTick chips (live computeUnlockProgress), RatingPill, timer warning ring, haptic countdown, mirrorView, fixedColor, animationSpeed.
- **Robustness per §2.10:** snapshot, resume card, `clientAttemptId`, outbox, `includeNext`, `requestId`, reconnect overlay.
- **Summary:**
  - EarlyExitNote, LevelUpExplainer, ComfortSessionNote, UnlockOutcome (norm-rise), CriterionRow list, DemoteOutcome (norm-drop plus shake);
  - CountTo on the UI thread;
  - ReviewThisSession card;
  - streak outcome micro-celebrations (continued, frozen with an explanation toast, reset);
  - Play again with the same settings;
  - gate and rankDown sounds with `stopLongClip` on unmount;
  - patch from `finish.progression`.
- **RankCeremony** in OverlayHost (spin, pop, flash, pre-rendered glow, desaturated down variant), with the haptic timeline aligned to the measured clip hit points.
- **i18n:** all `play.*`, `unlock.*`, `calibration.*`, `demote.*`, `rank.*` strings, including the hardcoded ExitDialog and "Home".
- **Home:**
  - greeting, nickname in Cinzel, verified badge;
  - StreakBadge using `streakState`, with an at_risk pulse and the streak sheet;
  - hero Start CTA with the last setup;
  - three StyleRatingCards with count-up deltas from lastSeenRatings;
  - tiles using `lifetime.sessions` (fixes the 20-cap bug);
  - recent sessions and the resume card.

**Backend work.** BC fixes found during integration only.

**Exit criteria**
- `05-outcomes.yaml` with seeded users asserts by testID:
  - LevelUpExplainer (last calibration session);
  - UnlockOutcome with a reward count-up to 50;
  - DemoteOutcome;
  - ComfortSessionNote;
  - EarlyExitNote via Save;
  - band crossing: the ceremony, then Continue, then the summary.
- Kill test: `xcrun simctl terminate` mid-puzzle, relaunch, resume card, Resume shows the same `puzzle-id` and the remaining time within ±2 s. The server attempt count is unchanged.
- Flaky test with `EXPO_PUBLIC_FAULTS=drop-attempt-30` over a 2-min session: the server attempt count equals the client count, and the final rating equals a no-fault replay computed with core `computeRatingStep`.
- `docker pause taktic_backend` for 10 s mid-session: the reconnect overlay shows, then the outbox flushes with no duplicate `clientAttemptId` (psql).
- Discard: GET returns 404, and the style rating equals its pre-session value.
- A theme session leaves `progressions[style].currentPuzzleRating` unchanged (dev store dump).
- After finish, Home shows the new `unlockedStartRating` without a refresh. The Home "Sessions" tile shows more than 20 for a seeded user with 25 sessions.
- Reduced Motion on: the ceremony completes in under 400 ms and no spark views mount.
- Release FrameStats over a full session: p95 ≤ 17 ms. The runner makes at most 1 React render per second while idle. Inter-puzzle gap p50 ≤ RTT + 250 ms.
- Everything passes on Android, with en and uk screenshots of every screen and card.

**Owner provides.** A device feel pass (sound and haptic pairing, slider detents, the ceremony). Confirm the background auto-pause policy.

### Phase 6: Review, history, viewer (3–4 nights)

**Goal.** Every flow from `review.md`, built on the shared runner.

**Mobile work**
- **Review tab:** theme cards via `firstPuzzleId`, skeletons, empty and error states, RefreshControl.
- **Drill (mode `drill`):**
  - hint levels 1 and 2 with a pulse;
  - a wrong move rewinds with a slide after 520 ms;
  - solved pop plus a 1000 ms pause;
  - the next puzzle cross-fades in place with no route push;
  - counter frozen per theme, done screen, `POST /review/:id/resolve`.
- **Session detail:** localised date, stat grid, attempts rendered with `fmtResponseTime` (fixes the fmtDuration-on-ms bug), Review mistakes CTA.
- **Mistakes runner (mode `mistakes`):** local FIFO, Missed/Slow reason chip, progress bar. `moves` normalised by the client.
- **Viewer (mode `viewer`):**
  - re-solve, or a solution stepper with a scrubber strip;
  - horizontal swipe (activeOffsetX, fails on vertical);
  - long-press auto-repeat on prev/next, with a tick per ply;
  - forward steps slide, jumps snap;
  - "Open on Lichess" through expo-web-browser.
- **History** (`sessions/index`):
  - FlashList infinite query with sticky day headers;
  - ReanimatedSwipeable delete on own lists only (fixes the profile no-op bug);
  - Medium haptic at 44 px, optimistic removal with LinearTransition, an undo toast, then DELETE.

**Exit criteria**
- `06-review.yaml`:
  - Fork drill: `e2e-wrong` rewinds, hint 1 and hint 2 testIDs appear, `e2e-solve` to done;
  - the stack depth is unchanged;
  - the Fork card is gone;
  - psql shows `resolvedAt` set.
- `06-history.yaml` with 60 seeded sessions:
  - 3 pages load;
  - Today and Yesterday groups;
  - swipe-delete and undo restores the row;
  - letting the toast expire deletes it, and GET returns 404.
- `06-viewer.yaml`: 4 swipes forward and 2 back produce the expected `viewer-fen` sequence. Attempt times match `^\d+\.\d+s$`.
- Release fling on history: p95 ≤ 17 ms. Android passes.

**Owner provides.** Should mistakes-review solves resolve the global queue (default yes)? Delete UX: undo toast (default).

### Phase 7: Stats and achievements (2–3 nights)

**Mobile work**
- **Stats | Achievements** header and a style filter.
- **Heatmap:** a single Svg with 5 batched level paths in a horizontal ScrollView, `scrollToEnd`, press-and-drag scrub with a tooltip and a tick per cell, uk plurals.
- **RatingHistoryChart:** draw-in, crosshair scrub, stable keys.
- **RadarChart** with a vertex morph.
- **Lifetime grid** with count-ups.
- **Recommendation** localised from the structured fields (B13); hidden until B13 ships.
- **ThemesList** (weakest/strongest/all, tap starts a drill).
- **Achievements grid:** detail formSheet, an unseen-unlock shimmer, global toasts for `achievementsUnlocked`. star-repo per the owner's decision.

**Backend work.** B13 (structured recommendations).

**Exit criteria**
- `07-stats.yaml`: a filter switch renders the chart, heatmap and radar testIDs, and a scrub updates the tooltip date.
- Side-by-side screenshots against the local web `/analytics` for the same user: same active-day count and same peak label.
- The achievement count equals the API count. A settings change that unlocks an achievement shows the toast.
- With 365 seeded days, Release scroll and scrub p95 ≤ 17 ms.

**Owner provides.** Keep star-repo in the app?

### Phase 8: Social, profiles, avatar (3–4 nights)

**Mobile work**
- **Public profile:**
  - collapsing header;
  - Avatar with crown and verified badge;
  - streak computed with `streakState` (fixes the stale count);
  - charts reused;
  - read-only sessions;
  - FriendActionButton with toasts;
  - share sheet with an https link;
  - prefetch on row pressIn.
- **Profile editor sheet:** 40/280 counters, explicit Save (no commit on blur), country.
- **Avatar:** an action sheet (camera / library / remove), the system 1:1 crop, a 512 px JPEG at q0.8, then the base64 endpoint, with an optimistic preview.
- **Social tab:**
  - Leaderboard: style Segmented, global/friends scope, top-3 podium, FlashList, sticky self row via `me`;
  - Friends: incoming and outgoing requests with swipe right to accept (Success), left to decline, and unfriend with a confirm;
  - tab badge.
- **Search sheet:** 250 ms debounce, AbortSignal, correct state after accept (fixes the "Requested" bug).

**Backend work.** B13 (leaderboard `me`, case-insensitive nickname lookup), B14.

**Exit criteria**
- `08-friends.yaml`: A searches for B, Add, logout, B sees the badge and the incoming request, swipe Accept, both lists update, A gets the achievement toast on next open, and the friends scope of the leaderboard lists both.
- `08-avatar.yaml`: `xcrun simctl addmedia` a fixture, pick, crop, save. `avatar-image` loads. `curl -I` on the URL returns 200 and the size is under 150 KB.
- `xcrun simctl openurl booted tactictak://profile/e2e_friend` opens the profile.
- Seeded rank 150 shows a sticky #150 row.
- Profile scroll and leaderboard fling: p95 ≤ 17 ms.

**Owner provides.** Avatar storage stays on the VPS for v1 (default)? Should the creator crown move to a server flag?

### Phase 9: Settings, account, local reminders, a11y, parity audit (3 nights)

**Mobile work**
- **Gameplay:** piece set with a live mini board, focus mode as immersive chrome, animation speed, play side, mirror view, show streak, fixedColor. Legacy fields hidden.
- **Sound:** toggle; volume slider with 10% ticks and a preview on release; per-event variant list with ▶ previews that also play the paired haptic; rankDown variant sheet.
- **Haptics:** toggle (strength only if Pulsar is adopted).
- **Notifications:** local reminder toggle and time, permission state.
- **App:** language, replay onboarding, reset progress (destructive sheet, Heavy haptic).
- **Account:** change password (inline 403 error), logout, logout-all, delete account (typed nickname plus password, then `resetAll`).
- **About:** version and build; licences (CC BY 3.0 game-icons, Lichess puzzle DB); privacy link.
- **Local notifications** per §2.9.
- **Accessibility:** labels on every icon button, hit slop ≥ 44 pt, Dynamic Type limits, a reduced-motion audit of every catalogue animation.
- **i18n completeness:** UserSearch, AvatarCropper leftovers, toast eyebrows, heatmap legend, chart empty text, "fail". An i18n lint rule flags JSX text outside `t()`.
- **PARITY.md audit.**

**Exit criteria**
- `09-account.yaml`:
  - register, onboarding;
  - a wrong current password shows an inline error and **no logout**;
  - a correct change succeeds and the session stays valid;
  - logout, then login as another user shows none of the previous data;
  - delete, then login fails, and psql shows no User row.
- `09-reminder.yaml`: enable for hour H, and diagnostics lists one notification today at H. Finish a session, and it moves to tomorrow.
- Settings round-trip: mirror, piece set and uk. After relaunch, the first frame after the splash already has uk and the piece set.
- RNTL: all 64 squares expose a label and role. The Accessibility Inspector audit has no missing labels on Home, setup, runner and settings.
- The i18n lint and key parity pass.
- **PARITY.md has 0 `todo` rows**; each deferred row cites a decision.
- The full suite `maestro test .maestro/` passes on both platforms in one run.

**Owner provides.** Legacy fields to drop. Per-device or synced sound and haptics prefs. The default reminder hour. Sign-off on the parity checklist.

### Phase 10: Accounts, EAS, push, universal links, Sentry, first TestFlight / Play internal (3–4 nights plus account lead time)

**Mobile work**
- `eas init`. Profiles: development, preview, e2e-test (simulator / apk, withoutCredentials), production. Fingerprint runtimeVersion. expo-updates channels.
- Real bundle ids. Gated entitlements on: aps-environment, `applinks:` and `webcredentials:tactictak.online`, Android intentFilters with autoVerify.
- Remote push client per §2.9. Notification preferences screen.
- Share sheets (profile, session result card).
- Sentry with source maps.
- EAS Workflows: e2e-test build plus Maestro on PRs into `mobile`; OTA to the preview channel on merges into `mobile`.

**Backend work.** B15, B16 (`.well-known`), B17 (Sentry, Postgres bind).

**Exit criteria**
- `xcrun simctl push booted <bundle> .maestro/fixtures/friend.apns` opens `/friends` from the killed, backgrounded and foreground states (in the foreground, a toast instead of the banner).
- `xcrun simctl openurl booted https://tactictak.online/profile/e2e_friend` and the `adb shell am start -d` equivalent open the profile.
- AASA: `curl -sI` returns 200 `application/json`, and the Apple CDN validator returns the file. assetlinks passes the Google statement tester.
- Backend e2e:
  - `sendRequest` creates a push job to B with the url `tactictak://friends`;
  - a DeviceNotRegistered receipt prunes the device;
  - the streak cron with a frozen clock across Europe/Kyiv, America/New_York and Asia/Tokyo sends exactly once per user per local day.
- Device: the admin test push arrives within 10 s with an "ok" receipt, and the friend-request Accept action creates the friendship.
- The TestFlight build on the owner's iPhone and the Play internal build on an Android device both log in to prod and finish a session.
- A preview OTA changes a visible label after two restarts. A Sentry test crash appears symbolicated.

**Owner provides**
- Apple Developer ($99/yr; individual or organisation decides the seller name) and Google Play ($25).
- Firebase project, FCM v1 service account, APNs key, Team ID for AASA.
- `eas login` / `eas credentials` (interactive), `EXPO_ACCESS_TOKEN` on the VPS.
- Push catalogue and caps.
- Merging the PRs.
- **Start Apple enrolment during Phase 5**, because it can take days.

### Phase 11: Hardening, performance, store readiness, beta (3–4 nights plus beta period)

**Mobile work**
- Android release pass: fonts, shadows, ripple, back handling, cleartext, R8.
- Low-end emulator profile.
- 60-min memory soak through `e2e-solve`.
- Cold-start and bundle-size work.
- Offline and error UX audit on every screen.
- Store assets: 1024 opaque icon, adaptive and monochrome icons, splash, Maestro-generated screenshots for 6.9" and 6.5" iPhones and a Pixel in en and uk.
- Privacy manifest. Data-safety and App-privacy drafts in `docs/mobile/store/`.
- `expo-store-review` after an unlock or a 7-day streak.
- Optionally, Pulsar ceremony patterns.

**Backend work.** B16 static `/privacy` and `/delete-account` from nginx (the web app stays untouched). Final min-build values. k6 sanity on `/attempt` with `includeNext`.

**Exit criteria**
- The full Maestro suite passes on **release** builds on both platforms. `e2e-solve` is absent from the release bundle.
- Heap growth under 15% from minute 5 to minute 60, with no crash.
- Cold start to interactive Home under 2.0 s on the Release sim.
- No LogBox warnings during a full suite run.
- `/privacy` and `/delete-account` return 200.
- The throttling flow shows a localised toast with no retry storm.
- Beta crash-free sessions ≥ 99.5% over 7 days.

**Owner provides**
- Beta testers. With a personal Play account: **12+ testers for 14 days of closed testing before production**, so start it at the beginning of Phase 10.
- Privacy policy, terms and support text.
- Listing copy.
- Final feel sign-off.

### Phase 12: Store launch and web retirement (2 nights plus review time)

**Work**
- **Launch:** production builds, EAS Submit, reviewer notes (demo account, push, deletion), iOS phased release and a staged Play rollout, raise `minSupportedBuild` after launch, OTA hotfix playbook in CLAUDE.md.
- **Merge `mobile` into `main`.** The paths filter keeps the deploy skipped for mobile-only changes.
- **Web retirement**, after the agreed window: trim `apps/frontend` to the landing page (store badges, Smart App Banner, SSR-rendered for SEO), `/privacy`, `/terms`, `/support`, `/delete-account`, `/admin` plus admin login, and fallback pages for `/profile/:nickname`, `/sessions/:id` and `/review/*` ("Open in app" with store badges). Old app routes 301 to `/`. Then B18.

**Exit criteria**
- Both stores are live, and a fresh install logs in and completes a session.
- The first mobile-only commit on `main` does not trigger the deploy, but does run typecheck.
- `curl -sI /dashboard` returns 301 to `/`. Store links are in the server HTML. Admin works.
- A universal link opens the app when it is installed and the fallback page when it is not.
- 14 days with 0 unversioned app-route requests, then B18.

**Owner provides.** The submit button, launch date and rollout percentage, the retirement date, and confirmation that admin stays on the web.

---

## 6. Feature parity checklist

These are the seed rows for `docs/mobile/PARITY.md`, one per inventory feature. "Fix" means a known web bug that is fixed, not ported.

**Auth, shell, cross-cutting**
| Feature (inventory) | Phase |
|---|---|
| Login screen (stats-settings-shell) | 2 (minimal), 4 |
| Register with live rule checklist | 4 |
| Auth/session plumbing and bootstrap (api client, Providers, store) | 4 (refresh, `resetAll`) |
| App shell: nav (6 → 5 tabs + avatar), focus routes, pull-to-refresh, fonts | 4 |
| Rotate lock | drop (portrait-only config) |
| PWA install card (Settings › App) | drop |
| Toast notifications | 4 |
| i18n en/uk, useT, useTn, plural rules, locale dates (gaps) | 0 (dicts), 4, 9 (completeness) |
| Onboarding welcome modal (5 slides) | 4 |
| Landing page and landing i18n → welcome pager; web landing kept | 4 / 12 |
| Error, empty, offline, session-expiry states (gaps) | 4, 11 (audit) |
| Interrupted session lifecycle (gaps) | 2 (auto-pause), 5 |
| Focus mode (gaps) → immersive runner chrome | 2, 9 (setting) |
| Keyboard shortcuts (gaps) | drop; the viewer copy loses "← → to step" |
| Reduced motion and CountTo (gaps) | 1, 5, 9 (audit) |
| Route / deep-link map (gaps) | 4 (scheme, native-intent), 10 (universal links) |
| Outbound external links (Lichess, GitHub) via expo-web-browser | 6, 7 |
| Accessibility baseline (gaps) | 1 (board), 9 |
| Text-input behaviours: autofill, keyboard types (gaps) | 4 |
| Server-side timezone (gaps) | 3 (`tz` on finish), 10 |
| Dev and QA tooling: seed, LAN, test account (gaps) | 0 |
| App icons, store screenshots (gaps) | 11 |
| Share and invite (gaps, new) | 8, 10 |
| Admin dashboard | stays on the web (12) |

**Board**
| Feature | Phase |
|---|---|
| Board grid rendering (squares, textures, coordinates, frame) | 1 |
| Piece rendering and per-set fit (Ember/Classic), fixing the scale-origin "pop" | 1 |
| Tap-to-move, selection, legal indicators | 1 |
| Drag-and-drop | 1 |
| Promotion picker | 1 |
| Arrows: hint and solution arrows | 1 |
| Arrows: user-drawn arrows and highlights, knightArrow | deferred (flag) |
| Last-move highlight, check indicator | 1 |
| animateMove slide, extended to all moves | 1 |
| Hint squares and arrow | 1 (API), 6 (drill) |
| Feedback: flash, sparks, shake | 1 |
| Orientation and mirror view | 1, 5 (setting) |
| Board sizing and layout | 1 |
| BoardThumbnail | 6 |
| LandingBoard (hero) → welcome pager decoration | 4 |
| TurnCard | 2 |
| Puzzle theme icons | 0 (assets), 6 |

**Play loop**
| Feature | Phase |
|---|---|
| Play setup (styles, durations, modes, previews, off-form, comfort) | 2 (minimal), 5 |
| DifficultySlider (bands, magnets) | 2, 5 |
| ThemePicker | 5 |
| Session runner state machine (stale-style fix, pause cancels timeouts) | 2, 5 |
| TurnCard and in-session streak chip | 2 |
| Pause / resume, plus auto-pause on background | 2 |
| Exit flow: save vs discard (i18n-ised) | 2, 5 |
| Finish and summary outcome cards | 2 (basic), 5 |
| RankCeremony | 5 |
| Backend session rules (in core, parity-tested; startPuzzleRating fix) | 0, 3 |
| StyleIcon and style catalogue | 2 |
| First-puzzle hand-off | 2 |
| creators.ts badge | 5 / 8 |

**Sound and haptics**
| Feature | Phase |
|---|---|
| Sound catalogue, variants, defaults | 1 |
| Sound prefs store (volume, per-event pick) | 1, 9 |
| Playback API (sfx, moveSoundEvent, stopLongClip) | 1 |
| Short-clip pipeline (trim, level, preload), done offline | 0, 1 |
| Synth engine, pre-rendered | 0 |
| Long clips with fade | 1, 5 |
| Sound settings panel | 9 |
| Board sound call sites (with the consistency fixes) | 2 |
| Progression sounds: norm gate, RankCeremony | 5 |
| Haptics pairing (new) | 1, 2, 5 |

**Review and sessions**
| Feature | Phase |
|---|---|
| Review landing theme cards (firstPuzzleId, no N+1) | 6 |
| Theme drill runner | 6 |
| Session detail (fmtResponseTime fix) | 6 |
| Session mistakes runner | 6 |
| Read-only puzzle viewer and stepper | 6 |
| Session history with day grouping and swipe-delete (own lists only; fix) | 6 |
| Pull-to-refresh → per-screen RefreshControl | 4 onward |
| Theme labels and meta-theme filtering | 6 |

**Home, social, achievements**
| Feature | Phase |
|---|---|
| Home dashboard (lifetime.sessions fix; resume card) | 5 |
| Daily streak badge, state, freezes, streak sheet | 5 |
| Public profile (streakState fix; no delete on others' profiles) | 8 |
| Profile editor (explicit Save) | 8 |
| Avatar picker, crop, upload | 8 |
| Avatar display, crown, verified badge | 4 (primitive), 8 |
| Friends screen | 8 |
| User search (state-after-accept fix) | 8 |
| Friend action button | 8 |
| Leaderboard (+ sticky self row) | 8 |
| Achievements grid, evaluation, star-repo (owner decision) | 7 |
| Achievement unlock toasts (cross-cutting) | 4 (host), 5–9 |
| Push for social, streak, achievements | 9 (local streak), 10 (remote) |

**Stats and settings**
| Feature | Phase |
|---|---|
| Stats shell (Stats \| Achievements, style filter) | 7 |
| ActivityHeatmap | 7 |
| RatingHistoryChart | 7 |
| RadarChart | 7 |
| Themes list | 7 |
| Settings › Profile (edit, avatar, change password with the 403 fix, logout) | 8, 9 |
| Settings › Gameplay (every UserSettings field; legacy ones hidden) | 5 (runner effects), 9 (UI) |
| Settings › App (language, replay onboarding, reset progress) | 9 |
| Account deletion (new, store-mandated) | 3 (API), 9 (UI) |
| Notification preferences (new) | 9 (local), 10 |
| About and licences (new) | 9 |

**Design system**
| Feature | Phase |
|---|---|
| Colour tokens; baked fade pipeline | 0 |
| Typography, plus the Cyrillic display face | 1 |
| Surfaces (glass → opaque, tx-slate, eos-well, avatar disc, glow) | 0, 1 |
| Plate buttons and Button | 1 |
| Card, Input/PasswordInput, Segmented, Toggle | 1, 4 |
| Select, Slider, ColorPicker (unused on web) | drop |
| Brand mark (logo) | 0 |
| Motion catalogue | 1, 5 |
| App shell / PWA chrome → native splash and icons | 0, 11 |
| Visual asset packaging | 0 |

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Backend change breaks the live web or prod deploy (deploy on every push; migrations on container start) | Additive-only rules. Refresh tokens only for `client:'mobile'`. Web-contract golden test, legacy smoke and rating transcript test. Small owner-merged PRs. `pg_dump` before migrations. Prod smoke after each deploy. |
| Root `engines` bump or `.npmrc` / `pnpm-workspace.yaml` edits break the Docker images [verified hazard] | Engines only in `apps/mobile`. Linker fallback only in `.npmrc`. Phase 0 exit builds both Docker images. |
| pnpm + Metro + SDK 58 misresolution, or duplicate React / RN | React-free core, web isolated, `pnpm why` gate, expo-doctor in CI. Re-verify after every native dependency is added. |
| Board misses 120 Hz or feels worse than the web | SharedValues only on the gesture path, render-counter exit criteria, Release-only FrameStats with a JS-jam test, owner device check in Phase 1 before any screen exists. |
| The simulator cannot judge haptics, ProMotion or real audio latency | Agent-verifiable numbers (frames, scheduling, onset), plus explicit owner checks (slow-mo metronome, tuning JSON). |
| react-native-audio-api is pre-1.0 (session bugs, interruptions) | The facade keeps the web API. expo-audio fallback. Pre-processed assets. Interruption and background tests in the spike. |
| Bleeding-edge APIs (RNGH 3 hooks, worklets 0.13, Reanimated 4.7) postdate training data, causing stalls and wrong APIs | CLAUDE.md requires reading the official docs and upgrade guides before gesture or worklet code. Spikes stay in `/dev`. The SDK-pinned option wins ties. |
| React Compiler interacts badly with SharedValue or ref patterns | Enabled from day 0. `'use no memo'` per file in board and gesture code if the counters regress, recorded in DECISIONS. |
| Session corruption from background, kill or flaky networks | §2.10 (snapshot, idempotency, requestId, outbox, auto-pause, sweeper keyed on activity), proven by kill, background, docker-pause and fault-injection flows. |
| A rules change (sweeper, startPuzzleRating fix) changes outcomes for real web users | Golden tests first. Owner-decided policies. B8 as a separate commit with before/after fixtures. |
| An overnight agent deploys to prod or reads secrets | Deny rules and hooks (§9). The owner merges every PR to main. `.easignore`. Local-only seeded e2e users. |
| Accounts arrive late (push, links, TestFlight, Play's 12-tester × 14-day clock) | Phases 0–9 need no accounts. Local reminders first. `simctl push` payloads. Apple enrolment starts in Phase 5, Play closed testing at the start of Phase 10. |
| Store rejection (deletion, star-repo incentive, privacy manifest, deletion URL, review crash) | B10 plus the Phase 9 UI, the static `/delete-account` page, privacy manifest and data safety in Phase 11, owner decision on star-repo, Sentry before TestFlight, a demo account. |
| Ukrainian brand breaks (Cinzel has no Cyrillic); Hermes Intl gaps | Font picked in Phase 1 with a screenshot exit criterion. `pluralizeUk` fallback. Hermes checks in Phases 4 and 11. |
| NativeTabs cannot carry the brand | Both mocked in Phase 1. A custom bar is a contained swap. |
| Universal links misconfigured (redirect, content type, Team ID) | nginx serves the files directly. Apple CDN and Google validators are exit criteria. Web fallback pages. |
| Parity drift and scope creep | PARITY.md is the contract and is updated when web fixes land. "Fix, don't port" rows. Ideas go to IDEAS.md, not into the build. |
| Throttling misfires behind nginx or carrier NAT | `trust proxy` verified first. Per-user and per-nickname keys for authenticated routes. Lands last, in its own PR. |
| CI node 20 → 22 with a strict lockfile fails on first run | A single reviewed Phase 0 PR. The Docker images stay on node 20 until a deliberate bump. |

---

## 8. Decisions deferred to the owner, with defaults

The agent adopts each default as **provisional** (logged in DECISIONS.md and asked in OWNER-QUESTIONS.md) and keeps working. Answers make it final.

| # | Decision | Default | Needed by |
|---|---|---|---|
| 1 | App identity: name, bundle id / package, scheme, link domain | tac·tic·tak, `online.tactictak.app`, `tactictak`, `tactictak.online` | 0 (before the first store upload) |
| 2 | Cyrillic display font | Agent shortlist (Forum / Cormorant SC / Prata); the agent picks the best-rendering one provisionally | 1 |
| 3 | Tab structure and style | Home · Play · Review · Stats(+Achievements) · Social(Leaderboard+Friends); Settings and profile behind the avatar; system NativeTabs with ember tint | 1 |
| 4 | Haptics engine | expo-haptics; Pulsar only if the device spike wins | 1 |
| 5 | Audio session | Ambient + mixWithOthers, respecting the silent switch | 1 |
| 6 | Board behaviour | Animate every move; block selection while the opponent moves; opponent feel at landing; mistake = thud + Error only; user-drawn arrows deferred, knightArrow hidden | 1–2 |
| 7 | Highlight blue | `rgb(47,95,158)` (as rendered) | 1 |
| 8 | Owner phone backend in Phases 2–9 | LAN backend on the Mac with a seeded account; a prod-API variant only on explicit request, never used by the agent | 2 |
| 9 | Background mid-session | Auto-pause; backgrounded time does not count | 2 |
| 10 | Abandoned-session sweeper | Idle > 12 h: 0 attempts → delete; else save as early exit, no progression change, no streak tick | 3 |
| 11 | `startPuzzleRating` semantics | Keep it as the entry floor; add `lastStartRating` for the slider | 3 |
| 12 | Auth scope v1 | Nickname + password only (no Sign in with Apple obligation); email recovery post-launch | 3 |
| 13 | fixedColor semantics | Applies to every runner mode consistently | 5 |
| 14 | Mistakes-review solves resolve the global queue; session delete also deletes its ReviewItems | Yes / no | 6 |
| 15 | Session delete UX | Undo toast | 6 |
| 16 | star-repo achievement | Hidden in the mobile app (review risk); kept on the web | 7 |
| 17 | Creator crown | Keep `creators.ts` in core; server flag later | 8 |
| 18 | Avatar storage | VPS volume, base64 endpoint, client resize | 8 |
| 19 | Legacy settings fields (accentColor, boardTheme, soundPack, reviewAutoAdvance) | Hidden in mobile, kept in the DB until Phase 12 | 9 |
| 20 | Sound and haptics prefs scope | Per device | 9 |
| 21 | Reminder default and push caps | 20:00 local; 1 streak push and 3 total per day; at launch: streak_at_risk, friend_request_received, friend_request_accepted | 9–10 |
| 22 | Device scope | Phones, portrait, no iPad | 0 |
| 23 | Crash reporting | Sentry | 10 |
| 24 | Account purchase timing | Apple enrolment in Phase 5; Play and Firebase before Phase 10 | 5 |
| 25 | Admin after retirement | Trimmed web `/admin` | 12 |
| 26 | Web retirement trigger | 4 weeks after store launch, plus a 14-day zero-traffic window before B18 | 12 |

---

## 9. Working agreement for Claude Code

### 9.1 Branching and commits
- **Integration branch `mobile`.** Feature work goes on `mobile/<phase>-<topic>` branches as PRs into `mobile`, which run CI. Use git worktrees (one per feature branch, one per `api/*` branch), so the integration build and the local backend stay usable.
- **Backend work** goes on `api/<topic>` branches **cut from `main`**, as PRs into `main`. Only the owner merges. After a merge, merge `main` into `mobile`.
- **Never** commit on `main`, push to `main`, or force-push. `mobile` merges into `main` only at Phase 12.
- **Commits:** conventional style (`feat(mobile): …`, `fix(core): …`, `feat(backend): …`), one coherent unit each, ending with the harness attribution trailer.
- **PR body = the morning report:** what changed, screenshots and video paths, Maestro results, perf numbers, provisional decisions taken, open questions. Backend PRs add a "web impact" statement and a prod verification checklist.
- Run `/code-review` on the diff before opening a PR.

### 9.2 Verification loop (each task)
1. Read the inventory section for the feature, only that section. List its behaviours, edge cases and the known web bugs to fix.
2. Extract pure logic into `@tac/core` with vitest first.
3. Build from primitives with i18n keys, testIDs, `accessibilityLabel`, and empty, error and offline states.
4. Keep Metro running in the background. Rebuild the dev client only when `npx expo-fingerprint` changes.
5. After each UI change, take a screenshot (`xcrun simctl io booted screenshot`), read it, and self-check against tokens and the web reference.
6. Run the feature's Maestro flow, then psql or curl assertions against the local backend.
7. At the end of a phase: Android emulator (headless `emulator -avd pixel_api35 -no-window`), Release FrameStats for perf-sensitive screens, then the full regression suite before the PR.
8. Use `xcrun simctl io booted recordVideo` for new interactions. Toggle Reduce Motion and content size with `xcrun simctl ui`.
9. Update PARITY.md, PROGRESS.md and FEEL.md.

**Definition of done:** `pnpm -r run typecheck`, core and backend tests, the phase flows on iOS (and Android at phase end), screenshots in en and uk, the PARITY row ticked, and a PROGRESS entry.

### 9.3 When to ask the owner
- **Never stop the night for a decision listed in §8.** Adopt the default as provisional, log it in DECISIONS.md and OWNER-QUESTIONS.md, and continue.
- **Stop and report** (in PROGRESS.md and the PR) on any of these:
  - a backend change that cannot be made additive;
  - anything that touches prod, the VPS env, secrets or credentials;
  - an account requirement;
  - a needed edit to `apps/frontend` beyond a requested fix;
  - a spike that misses its numeric gate twice;
  - deviating from an SDK-pinned library.
- Every session starts by reading OWNER-QUESTIONS.md (answers and feedback inbox), the last PROGRESS.md entry, DECISIONS.md and the current phase's exit criteria.

### 9.4 CLAUDE.md suggestions
- **Root (under about 150 lines):**
  - mission and the frozen-web rule;
  - branch rules (§9.1);
  - do-not-touch list: `apps/frontend` except requested fixes, the deploy job, `deploy/` outside B12/B16/B17 PRs, the Dockerfiles, root `engines`, `.env`, `.claude-test-account`;
  - backend contract rules: additive only, mobile calls `/api/v1`, golden test required;
  - where the truth lives: inventory files by topic (board.md for the board, play.md for the runner, and so on; read only the relevant section), and the docs/mobile files;
  - commands: `pnpm db:up`, `pnpm --filter backend dev`, `pnpm --filter mobile ios|android`, `maestro test apps/mobile/.maestro/<flow>.yaml`, `pnpm --filter @tac/core test`, `pnpm --filter backend test:e2e`;
  - local ports 5433 / 6380;
  - the definition of done.
- **`apps/mobile/CLAUDE.md`:**
  - stack pins, and `npx expo install` only;
  - RNGH 3 hook API only (read the docs first);
  - hard rules:
    - every haptic and sound goes through `feel.emit`;
    - no React state on gesture or tick paths;
    - no `setTimeout` in `src/board`;
    - colours only from tokens, new colours via bake-fade.py;
    - every animation through `motion.ts`;
    - every string through `t()`;
    - every interactive element gets a testID and an a11y label;
  - perf is measured in Release only;
  - the dev-route map;
  - testID conventions;
  - the rebuild rule (fingerprint, then `expo prebuild --clean`);
  - API URLs per target.
- **`apps/backend/CLAUDE.md`:**
  - migrations are additive and applied migrations are never edited;
  - the legacy smoke and golden test are required;
  - auth changes need e2e;
  - the rule files are mirrored in core, so a change there updates both copies and the parity test stays green.

### 9.5 Permissions, hooks and skills

**Permissions.** The owner commits `.claude/settings.json` (or applies it via `/update-config`). The agent must not edit its own permission settings. Use acceptEdits plus an allowlist, not bypass mode.

- **Allow:**
  - `pnpm *`, `npx expo *`, `npx expo-doctor*`, `npx expo-fingerprint*`;
  - `xcrun simctl *`, `xcodebuild *`, `maestro *`, `adb *`, `emulator *`, `sdkmanager *`, `avdmanager *`;
  - `docker compose up -d postgres redis`, `docker compose ps|logs *`, `docker compose exec postgres psql *`, `docker pause|unpause taktic_backend`;
  - `git status|diff|log|add|commit|switch|checkout -b|branch|merge|worktree|stash *`, `git push origin mobile*`, `git push origin api/*`;
  - `gh pr create|view|list *`, `curl http://localhost:4000/*`.
- **Ask:** `brew install *` (the Android toolchain is pre-approved in Phase 0 by the owner), global npm installs, `eas *`.
- **Deny:**
  - `git push origin main*`, `git push --force*`, `git push -f*`;
  - `ssh *`, `docker compose --profile app*`;
  - `eas submit*`, `eas update --channel production*`;
  - `Read(./.env)`, `Read(./.claude-test-account)`, `Read(**/*.p8)`, `Read(**/google-services*.json)`, `Read(**/GoogleService-Info.plist)`.

**Hooks**
- **PreToolUse (Bash):** block any `git commit` or `git push` while the current branch is `main`, any push targeting `main`, `--force`/`-f`, `ssh `, and `curl` to `tactictak.online` with `-X POST|PATCH|PUT|DELETE` or `--data`.
- **PostToolUse (Edit/Write):** refuse edits inside existing `apps/backend/prisma/migrations/*` folders. Run a quick `tsc --noEmit -p` on the touched package.
- **Stop:** `pnpm --filter @tac/core test --run && pnpm --filter mobile typecheck`. Report failures before ending the turn.
- **Optional Notification hook:** ping the owner when a stop-and-report condition is hit.

**Project skills (`.claude/skills`)**

| Skill | What it does |
|---|---|
| `sim` | Boot the iPhone 17 sim, start the backend if it is down, rebuild only on a fingerprint change, launch, screenshot to `docs/mobile/screens/<phase>/<name>-<lang>.png` |
| `android-emu` | The same for the emulator (headless) |
| `maestro` | Seed, run the named flows on both platforms, summarise |
| `perf-bench` | Release build, FrameStats flow, print p50, p95 and drop % |
| `seed` | Reset and seed deterministic local data |
| `port-feature` | Inventory section, then behaviour and bug list, core extraction with tests, screen from primitives, i18n, testIDs, Maestro flow, screenshot next to the web, PARITY tick |
| `backend-pr` | Branch from `main`, additive migration, e2e plus golden tests, PR with the web-impact statement and prod checklist |
| `spike-report` | DECISIONS.md entry: question, options, measured numbers, decision, fallback |
| `feel-tune` | Apply the owner's tuning JSON or feedback to FEEL_TABLE, with before/after values recorded in FEEL.md |

### 9.6 Cadence and owner feedback
- **One phase, or half of an XL phase, per night**, with its exit criteria pasted into the prompt. Plan big phases in plan mode first.
- Use the highest effort and strongest model for the board, the runner reducer, auth refresh and the ceremony. Routine screen ports can run at lower effort. Use subagents for read-only inventory lookups and parity audits, to keep the main context lean. Start a fresh session per sub-goal and rely on PROGRESS.md for continuity.
- **Owner each morning:** review the PR gallery and leave numbered comments. Answer OWNER-QUESTIONS.md inline. For feel, install the latest build on the phone and tune in `/dev/feel-lab` or `/dev/tuning`, then paste the exported JSON. Give concrete targets ("lift 1.08, snap-back 150 ms") rather than adjectives.
- **On-device check-ins:** after Phases 1, 2, 5 and 8.
