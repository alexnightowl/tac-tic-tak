# Inventory: stack-research

_External research: the Expo / React Native stack for tac-tic-tak as of 2026-10-25. Versions come from the npm registry dist-tags, Expo SDK 58 bundledNativeModules.json and official docs/changelogs._

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Core runtime: Expo SDK / React Native / React / New Architecture / Hermes  ·  complexity S

**Where:** apps/mobile (new Expo app), app.json / app.config.ts, eas.json

**Behaviour**

Base platform for the whole port. Expo SDK 58 was released 2026-10-15 (https://expo.dev/changelog/sdk-58). npm `expo` latest is 58.0.19 (2026-10-23) and the expo package.json on the sdk-58 branch shows 58.0.17. It ships react-native 0.88.0 (released 2026-10-15; blog https://reactnative.dev/blog/2026/10/19/react-native-0.88) and react 19.3.0 / react-dom 19.3.0 / @types/react ~19.3.0. Compatibility table (https://docs.expo.dev/versions/latest/): SDK 58 needs Node 22.13.x+, iOS 16.4+, Android 7+, Xcode 26.4+ (Xcode 27 for some features). SDK 57 = RN 0.86 / React 19.2.3; SDK 56 = RN 0.85 / React 19.2.3. New Architecture is the only option: SDK 55 dropped the Legacy Architecture and removed `newArchEnabled` (https://expo.dev/changelog/sdk-55). Hermes V1 has been the default engine since SDK 56 (https://expo.dev/changelog/sdk-56). RN 0.88 makes the W3C EventTarget event dispatch the default and adds variable fonts, iOS SceneDelegate and experimental SwiftPM. It is the third release in a row with no user-facing breaking changes. SDK 58 breaking changes: RN 0.87 Strict TypeScript API is the default (deep imports from `react-native/Libraries/*` are type errors; InteractionManager, the Touchable root export, the Modal `animated` prop and the StatusBar backgroundColor/translucent props are removed). Prebuild generates `SceneDelegate.swift`. Android R8 minify is on by default in release builds. NODE_ENV now follows the command. The Fingerprint default preset is `balanced`. Expo Go for SDK 58 is due "within a few weeks", so develop with a dev client (`create-expo-app --template default@sdk-58`). React Compiler is opt-in via `experiments.reactCompiler: true`; Babel is auto-configured since SDK 54 and lint rules ship in eslint-config-expo since SDK 55 (https://docs.expo.dev/guides/react-compiler/).

**State & persistence:** n/a (platform choice)

**Web-only deps:** next@^14.2.15; react@^18.3.1; react-dom@^18.3.1

**Motion & sound:** Hermes V1 plus New Architecture (Fabric) give synchronous layout and concurrent React 19.3, which smooth UI-thread animations work on.

**Mobile mapping:** Start on Expo SDK 58: `pnpm create expo-app --template default@sdk-58 apps/mobile`, with expo ^58.0.19, react-native 0.88.0 and react 19.3.0. Use development builds (expo-dev-client ~58.0.14) from day one, not Expo Go. Every perf-critical library chosen below (MMKV v4/Nitro, Unistyles, Pulsar, Reanimated 4, RNGH 3, Skia) needs native code or the New Architecture, and the SDK 58 Expo Go is not shipped yet. Turn on `experiments.reactCompiler: true` so memoisation is automatic, which matters for 120fps. Set `experiments.typedRoutes: true`. Keep `expo-build-properties` ~58.0.11 for minSdk/Hermes knobs. Raise the root `engines.node` from `>=20` to `>=22.13`.

**Why S:** Scaffolding a template plus config. Most of the effort goes into making sure every third-party lib supports RN 0.88 and the New Architecture.


## Navigation: expo-router (stack, native tabs, sheets, typed routes)  ·  complexity M

**Where:** app/_layout.tsx, app/(tabs)/_layout.tsx, modal/formSheet routes

**Behaviour**

File-based routing replaces the Next.js app router. Expo SDK 58 pins expo-router ~58.0.25 (npm latest 58.0.26, 2026-10-23). In SDK 58 the following are stable (https://expo.dev/changelog/sdk-58): native tabs, toolbars, data loaders, SSR, middleware. Navigation state and route keys are deterministic. `withLayoutContext` is deprecated in favour of `integrateWithRouter`, and screen error boundaries are available via `unstable_settings.screenErrorBoundary`. Since SDK 56 expo-router no longer depends on React Navigation, so `@react-navigation/*` imports may not work (codemod `npx expo-codemod sdk-56-expo-router-react-navigation-replace`). Native tabs (https://docs.expo.dev/router/advanced/native-tabs/): import from `expo-router/native-tabs` in SDK 58+ (`expo-router/unstable-native-tabs` in 54–57). They use the system UITabBar (Liquid Glass on iOS 26+) and Material tabs on Android. Icons: `sf` (SF Symbols), `md` (Material Symbols), `src`, `xcasset`. Badges go through `NativeTabs.Trigger.Badge`. Limits: max 5 tabs on Android, no dynamic add/remove, no nesting, the bar height cannot be measured, no scroll-to-top or minimize-on-scroll with FlatList, no fully custom design. Headers come from a Stack nested inside each tab. Sheets: Stack `presentation: 'formSheet'` with `sheetAllowedDetents` (fractions or 'fitToContents'), `sheetInitialDetentIndex`, `sheetGrabberVisible` (iOS), `sheetCornerRadius` and `sheetLargestUndimmedDetentIndex`. Android allows at most 3 detents, and headers/nested stacks do not render inside sheets (https://docs.expo.dev/router/advanced/modals/). Typed routes are still beta and off by default: set `experiments.typedRoutes: true` and run `npx expo customize tsconfig.json`. Hrefs must be absolute, and query params are typed manually (https://docs.expo.dev/router/reference/typed-routes/).

**State & persistence:** Route state lives in the router. Deep links come through expo-linking ~58.0.14 and the `scheme` in app.json.

**Web-only deps:** next/navigation (useRouter, usePathname, useSearchParams); next/link; Next app router layouts; @radix-ui/react-tabs; @radix-ui/react-dialog

**Motion & sound:** Native stack push/pop and the iOS swipe-back and Android predictive-back gestures come free from react-native-screens ~4.30.0. Native sheets get system spring physics.

**Mobile mapping:** expo-router ~58.0.25 plus react-native-screens ~4.30.0 and react-native-safe-area-context ~5.10.1. Use NativeTabs (`expo-router/native-tabs`) for the top-level sections (5 at most) with SF Symbols / Material Symbols icons, and a nested Stack per tab. Replace Radix Dialog with Stack `presentation: 'formSheet'` or 'modal'. Use `href` objects for typed dynamic routes.

**Why M:** The route tree maps roughly 1:1 from Next app dirs, but tab, stack and modal topology has to be redesigned for mobile, and native tabs come with hard limits.


## Animation: react-native-reanimated v4 + react-native-worklets  ·  complexity M

**Where:** chessboard piece moves, rating counters, toasts, progress bars, screen transitions

**Behaviour**

Expo SDK 58 pins react-native-reanimated 4.7.1 (npm latest 4.7.1, 2026-10-02; nightly 4.8.0) and react-native-worklets 0.13.0 (latest 0.13.0, 2026-09-18). Compatibility (https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/): 4.7.x works with RN 0.86–0.88 and worklets 0.13.x. 4.8.x needs worklets 0.14.x. Reanimated 4 runs only on the New Architecture, and Reanimated 3 is unmaintained. Reanimated 4 adds CSS-style `animationName` keyframes and CSS transitions on Android, iOS and web, including react-native-svg components (https://docs.swmansion.com/react-native-reanimated/docs/css-animations/animation-name/). That lets the web Tailwind/CSS keyframe animations be ported almost declaratively. A known Hermes V1 memory regression with worklets/reanimated existed in SDK 56/57 and was fixed in expo@57.0.9 / 57.0.17 (https://expo.dev/changelog/sdk-57).

**State & persistence:** SharedValues on the UI thread, so animation frames never touch React state.

**Web-only deps:** CSS @keyframes / Tailwind animate-* classes; CSS transitions; requestAnimationFrame

**Motion & sound:** Use withSpring / withTiming on the UI thread and Reanimated CSS transitions for simple state changes. Respect `useReducedMotion` (the specific API page was not fetched; verify).

**Mobile mapping:** Install with `npx expo install react-native-reanimated react-native-worklets` (4.7.1 / 0.13.0). The Babel plugin is auto-configured by babel-preset-expo. Rules: keep piece-drag and board animations entirely in worklets, use `useAnimatedStyle` and transforms (translateX/Y/scale), never animate layout props in lists. Port simple web CSS animations to Reanimated CSS `animationName` / `transitionProperty`.

**Why M:** The library setup is trivial. Re-implementing each web animation with UI-thread worklets and tuning it on 120Hz devices is per-component work.


## Gestures: react-native-gesture-handler v3  ·  complexity M

**Where:** chessboard drag & tap-to-move, swipeable list rows, buttons (Touchable)

**Behaviour**

Expo SDK 58 pins react-native-gesture-handler ~3.3.0 (npm latest 3.4.0, 2026-10-16; `legacy` tag 2.33.1). v3 is rebuilt for the New Architecture and drops legacy support. It has a hook-based API: `usePanGesture`, `useTapGesture`, `useLongPressGesture`, plus `useCompetingGestures` / `useSimultaneousGestures` / `useExclusiveGestures` in place of Gesture.Race/Simultaneous/Exclusive. Callbacks are renamed (onStart→onActivate, onEnd→onDeactivate, onTouchesCancelled→onTouchesCancel). `onChange` is removed (use onUpdate's change* fields). `success` became the inverted `event.canceled`. Relation props are renamed (simultaneousHandlers→simultaneousWith, waitFor→requireToFail, blocksHandlers→block). Gesture relations cannot mix the hook API with the older APIs. A new `Touchable` component replaces RectButton/BorderlessButton/TouchableOpacity/etc., with underlayColor, activeOpacity, animationDuration and androidRipple. `enabled`/`hitSlop` accept SharedValues (https://docs.swmansion.com/react-native-gesture-handler/docs/guides/upgrading-to-3/; blog https://rec-ws.swmansion.com/blog/introducing-gesture-handler-3-0-hook-based-api-deeper-reanimated-integration-more-9185b0c8e305).

**State & persistence:** Gesture state goes into Reanimated SharedValues.

**Web-only deps:** DOM pointer/mouse/touch events; HTML5 drag-and-drop or custom pointer handling on the web board

**Motion & sound:** Gesture callbacks run as worklets, so haptics (Pulsar presets are worklet-compatible) and visual feedback fire on the UI thread with no JS-thread hop.

**Mobile mapping:** react-native-gesture-handler ~3.3.0 with the hook API only (no mixing with the v2 builder API). Wrap the root in GestureHandlerRootView. Use the `Touchable` component for all pressables so press feedback is consistent. For the board, use a single pan gesture on the board container that computes the square from x/y (cheaper than one gesture per piece), plus a tap gesture for tap-to-move, composed with useExclusiveGestures.

**Why M:** The API is new (hooks). Third-party libs written for the v2 API (bottom-sheet, some charts) may lag behind.


## Chessboard rendering: Views+Reanimated vs Skia  ·  complexity XL

**Where:** Board, Piece, Square highlights, Arrows/annotations, Promotion picker, Coordinates

**Behaviour**

Two viable approaches. (A) Views plus Reanimated: 64 squares can be a single background image or 8x8 Views; 32 absolutely positioned piece Views (expo-image or react-native-svg) moved with translate transforms. Highlights are absolutely positioned Views. Arrows go through react-native-svg 15.16.0, which Reanimated can animate. This needs no extra GPU dependency and is easily 120fps for this many nodes. (B) Skia canvas, the approach of enzomanuelmangano/react-native-chessboard 0.2.0 (MIT, 109 stars, last push 2026-07-25; https://github.com/enzomanuelmangano/react-native-chessboard). It is a 'zero-render' board with a sprite-sheet of pieces, Reanimated drives the canvas, and it uses chess.js 1.x. It supports castling, en passant, promotion picker, flipped, highlights and a ref API (move/undo/highlight/resetBoard). It does not support premoves or arrows, and per-piece JSX was removed in v2. The README itself says to use it in production with caution. The Skia packaging is in flux: `@shopify/react-native-skia` stops at 2.14.0, which Expo SDK 58 still pins. The library moved to the unscoped `react-native-skia` package (wcandillon/react-native-skia): v3 latest is 3.8.0 (2026-10-24, Graphite on Metal/Vulkan, multithreaded) and v2 is `release-2.x` 2.15.2. Skia v3 requires Android minSdk 26 and Vulkan 1.1, and the Play Store hides the app from devices without Vulkan. It also needs iOS 15.1+, cannot run in Expo Go, and changed APIs (useCanvasSize, removed makeImageFromView, etc.) (https://wcandillon.github.io/react-native-skia/docs/getting-started/migration). Other references: leomino/rn-chessboard (RNGH+Reanimated+zustand peers, WIP, 4 stars, active 2026-10-24); lichess-org/mobile (Flutter/Dart, GPL-3.0, 2,616 stars, use as a UX reference only, do not copy code).

**State & persistence:** Position as a FEN string plus a chess.js instance in a zustand store. The animated piece positions live in SharedValues keyed by square.

**Web-only deps:** DOM/CSS grid board; CSS transforms/transitions for piece moves; pointer events

**Motion & sound:** Piece move ~150–250ms withTiming (exact web durations come from the board-area inventory). Snap-back spring on an illegal move. Lift scale (~1.1) on pickup with haptic `selection`. Capture/move/check sounds through the audio engine. Promotion sheet.

**Mobile mapping:** Recommendation: build an in-house board with approach (A): Views plus Reanimated 4.7.1 transforms plus RNGH 3 hooks, pieces as pre-rasterised PNG/WebP at @2x/@3x through expo-image ~58.0.16 (or react-native-svg 15.16.0 if the web uses SVG piece sets), and arrows/annotations in react-native-svg. It keeps the 2-D board off the Skia upgrade path and away from Vulkan device exclusion, and gives full control over puzzle-specific UX (hints, solution stepping, wrong-move shake). Study react-native-chessboard's Skia + sprite-sheet + SharedValue architecture for ideas. If Skia is needed later (glow effects, charts), add `react-native-skia@2.15.x` (release-2.x), not v3 and not the frozen @shopify package.

**Why XL:** The board is the core interaction. Drag/tap logic, animations, promotion, flipping, highlights, haptics and sound sync all have to be rebuilt natively and tuned for 120Hz.


## Lists: FlashList v2 vs Legend List  ·  complexity S

**Where:** puzzle history, session attempts list, leaderboards, settings lists

**Behaviour**

Expo SDK 58 pins @shopify/flash-list 2.3.2 (npm latest 2.3.3, 2026-10-01). FlashList v2 (https://shopify.github.io/flash-list/docs/v2-changes/): no estimatedItemSize, a `masonry` prop replaces MasonryFlashList, `maintainVisibleContentPosition` is on by default, `startRenderingFromBottom` suits chat-style lists, and `useRecyclingState` holds per-item state. Avoid padding on `style` and memoise props (onCommitLayoutEffect loops). @legendapp/list latest is 3.6.0 (2026-09-29; 3.0.0 released 2026-05-28). It is 100% JS with no native module, a FlatList/FlashList drop-in, with `recycleItems`, `maintainScrollAtEnd`, `alignItemsAtEnd`, and bidirectional infinite lists.

**State & persistence:** Data comes from react-query infinite queries.

**Web-only deps:** overflow-y scroll divs; window scroll / IntersectionObserver (if used for infinite scroll)

**Motion & sound:** Native scroll physics. Avoid layout animations inside recycled cells.

**Mobile mapping:** Default to @shopify/flash-list 2.3.2 (the SDK-pinned version, so Expo validates it). Use Legend List 3.6.0 only where its bidirectional infinite scroll or end-anchoring is clearly better. Use plain ScrollView for short static lists (settings).

**Why S:** A drop-in list API. The cost is per-screen item component work.


## Styling: Uniwind vs NativeWind v5 vs Unistyles 3 vs StyleSheet  ·  complexity L

**Where:** all UI, theme tokens (colors, radii, spacing, typography), dark mode

**Behaviour**

The web uses tailwindcss ^3.4.13 with class-variance-authority, clsx and tailwind-merge. Options as of 2026-10-25: (1) NativeWind: stable 4.2.7 (2026-09-14) targets Tailwind v3. v5 is still `5.0.0-rc.0` (2026-09-13), requires tailwindcss >4.1.11 and react-native-css 3.1.0-rc.0, and its docs call v5 a pre-release 'not intended for production use' (https://www.nativewind.dev/v5/guides/migrate-from-v4). (2) Uniwind 1.13.0 (2026-10-19): Tailwind v4 bindings, peers tailwindcss >=4 / react >=19 / RN >=0.81 / metro, claimed 2x faster than NativeWind (https://docs.uniwind.dev/). The free version needs manual safe-area insets. Uniwind Pro adds C++-injected insets, gradients kept on theme change (1.8.0+), filters (1.6.0+) and drop-shadow (1.7.0+). Pro pricing and licence were not found. (3) react-native-unistyles 3.6.0 (2026-10-21): a StyleSheet superset on Nitro Modules/JSI with C++ parsing, no hooks/context and no re-renders on theme change. It needs RN 0.81+, React 19, the New Architecture (no opt-out), Expo SDK 54+, Xcode 16.4+, a Babel plugin `react-native-unistyles/plugin` and a dev client (https://www.unistyl.es/v3/start/getting-started). (4) Plain StyleSheet plus a typed tokens module, with zero deps. Related: react-native-ease 0.9.0 (App&Flow / Janic Duplessis) provides declarative platform-API animations with peers uniwind>=1 or nativewind>=4.

**State & persistence:** Theme preference (system/light/dark) persisted in MMKV.

**Web-only deps:** tailwindcss@^3.4.13 + postcss/autoprefixer; class-variance-authority; tailwind-merge; clsx; CSS variables in globals.css; prefers-color-scheme media query

**Motion & sound:** Theme switching without re-render (Unistyles or Uniwind shadow-tree updates) avoids jank.

**Mobile mapping:** Recommendation: Uniwind 1.13.0 with Tailwind v4.3.x (tailwindcss latest 4.3.3), keeping the Tailwind mental model and design tokens from the web's tailwind.config. Move the tokens into a `@theme` block in global.css and set `cssEntryFile` in metro config. cva/clsx/tailwind-merge can keep working on className strings. Fall back to Unistyles 3.6.0 if Uniwind Pro features are needed but not wanted as a paid dependency, or if perf profiling shows className resolution cost. Do not adopt NativeWind v5 until it ships stable. Extract colour, radius and spacing tokens into a shared package either way.

**Why L:** Every component's markup is rewritten (div→View, text in Text). Tokens port mechanically, but web-specific utilities (hover, grid, backdrop-blur, pseudo-elements) need native equivalents.


## Local storage: react-native-mmkv vs expo-sqlite kv-store  ·  complexity S

**Where:** zustand persist, react-query persister, settings (sound/haptics toggles, theme, last play setup)

**Behaviour**

The web keeps state in localStorage, and recent commits mention 'localStorage-seeded state' on /play. react-native-mmkv latest 4.3.2 (2026-06-22) is a Nitro Module from v4: it needs react-native-nitro-modules (latest 0.37.1) and RN 0.76+. API: `createMMKV({id, encryptionKey, encryptionType:'AES-128'|'AES-256', mode:'multi-process', readOnly, compareBeforeSet})`, synchronous `set/getString/getNumber/getBoolean/getBuffer/remove/getAllKeys/clearAll`, plus hooks `useMMKVString/Number/Boolean`. Claimed ~30x faster than AsyncStorage. Chrome remote debugging is not possible because calls are synchronous JSI, and Jest gets an auto mock (https://github.com/mrousavy/react-native-mmkv). expo-sqlite ~58.0.13 ships `expo-sqlite/kv-store` (an AsyncStorage drop-in with extra sync methods getItemSync/setItemSync...) and `expo-sqlite/localStorage/install` (a globalThis.localStorage polyfill) (https://docs.expo.dev/versions/latest/sdk/sqlite/). SDK 58 removed libSQL support from expo-sqlite. @react-native-async-storage/async-storage is pinned at 2.2.0 in SDK 58; npm latest is 3.1.1.

**State & persistence:** Mobile: MMKV instance `app` for prefs and zustand persist, plus a separate MMKV instance for the react-query cache. Web localStorage key names must be inventoried by the frontend-area agents so they can be kept or migrated.

**Web-only deps:** window.localStorage; sessionStorage; SSR hydration guards (typeof window)

**Motion & sound:** Synchronous reads mean the first frame renders with persisted settings (no hydration flash, which removes the web hydration-mismatch bug class).

**Mobile mapping:** react-native-mmkv 4.3.2 plus react-native-nitro-modules 0.37.1 (pin per the MMKV README compat table). Wrap MMKV in a `StateStorage` adapter for zustand `persist(createJSONStorage(() => mmkvStorage))` and in `createSyncStoragePersister` for react-query. Use expo-sqlite ~58.0.13 only if structured offline data (cached puzzle packs, attempt history) is needed. The `expo-sqlite/localStorage/install` polyfill can let shared code that touches `localStorage` run unchanged during the transition.

**Why S:** Thin adapters. Persisted-key inventory and the hydration simplification are the only work.


## Secure token storage: expo-secure-store  ·  complexity M

**Where:** auth/session layer, API client interceptor

**Behaviour**

expo-secure-store ~58.0.2 (latest 58.0.2) uses iOS Keychain and Android Keystore-backed storage. SDK 58 added `requireConfirmation` on Android for authenticated reads/writes (https://expo.dev/changelog/sdk-58). The web presumably uses cookies or localStorage for auth; the auth-area agent must confirm.

**API**

- `(auth endpoints from backend inventory, e.g. login/refresh — not read by this agent)`

**State & persistence:** Access and refresh tokens in SecureStore. Keep only non-secret auth flags (e.g. 'hasSession') in MMKV for synchronous first-render routing.

**Web-only deps:** HTTP-only cookies / document.cookie (if used); Next middleware auth redirects (if used)

**Motion & sound:** n/a

**Mobile mapping:** expo-secure-store ~58.0.2 for tokens. Use expo-local-authentication ~58.0.2 for optional biometric unlock and expo-apple-authentication ~58.0.2 / expo-auth-session ~58.0.14 if social login is added. If the backend uses cookie sessions, move it to bearer access and refresh tokens for mobile, since cookie handling in RN fetch is fragile. SDK 56 made `expo/fetch` the default globalThis.fetch.

**Why M:** Storage is trivial. The backend may need a token-based auth flow if it is currently cookie-based (unknown).


## State & server data: zustand + @tanstack/react-query (persist + offline)  ·  complexity M

**Where:** all data screens, QueryClientProvider root, stores/*

**Behaviour**

The web already uses zustand ^5.0.0 and @tanstack/react-query ^5.59.0. Current versions: zustand 5.0.16 (2026-10-22); @tanstack/react-query, @tanstack/react-query-persist-client and @tanstack/query-sync-storage-persister / query-async-storage-persister are all 5.104.5 (2026-10-19). Official RN guidance (https://tanstack.com/query/latest/docs/framework/react/react-native): wire `onlineManager` to expo-network (reads the initial state correctly) or NetInfo; wire `focusManager.setFocused` to AppState 'active'; refetch stale queries on screen focus with a useFocusEffect hook that skips the first call; pass `subscribed: isFocused` to pause queries on unfocused screens. DevTools: Rozenite plugin, a native macOS app, Flipper or Reactotron.

**API**

- `(all backend REST endpoints — inventoried by other agents)`

**State & persistence:** Persisted react-query cache in MMKV via createSyncStoragePersister with `maxAge` and a `buster` tied to the app version. Mutations with `networkMode: 'offlineFirst'` and resumePausedMutations on reconnect for puzzle-attempt submissions.

**Web-only deps:** window focus/visibilitychange (react-query default focus manager); navigator.onLine

**Motion & sound:** Optimistic updates keep the puzzle flow instant, with no spinner between puzzles.

**Mobile mapping:** zustand 5.0.16 plus @tanstack/react-query 5.104.5, @tanstack/react-query-persist-client 5.104.5 and @tanstack/query-sync-storage-persister 5.104.5 over MMKV. Use expo-network ~58.0.4 for onlineManager and AppState for focusManager. Move query keys, fetchers and zustand store definitions without DOM access into a shared workspace package. Prefetch the next puzzle(s) for zero-latency transitions.

**Why M:** The libraries are the same as on the web, so stores and query hooks port nearly verbatim. Offline/resume semantics and the focus/online wiring are new.


## Haptics: expo-haptics vs react-native-pulsar vs nitro libs  ·  complexity M

**Where:** board interactions, buttons/toggles, puzzle result feedback, sliders (rating slider in Play setup)

**Behaviour**

expo-haptics ~58.0.7 (latest 58.0.7) provides `impactAsync(Light|Medium|Heavy|Rigid|Soft)`, `notificationAsync(Success|Warning|Error)`, `selectionAsync()`, and Android-only `performAndroidHapticsAsync(AndroidHaptics.*)` with 19 types including Clock_Tick, Confirm, Reject, Segment_Tick, Segment_Frequent_Tick, Drag_Start, Gesture_End, Toggle_On/Off, Long_Press. The Android-only call needs no VIBRATE permission and is preferred. There are no custom patterns. iOS haptics are silent in Low Power Mode, with the camera active, or during dictation. The Expo docs themselves point to Pulsar for custom patterns (https://docs.expo.dev/versions/latest/sdk/haptics/). react-native-pulsar 1.7.0 (Software Mansion, MIT, 2026-08-11) offers `Presets` (150+, e.g. `Presets.System.impactMedium()`, `hammer()`, `fanfare()`), `usePatternComposer(pattern)` (play/stop/parse), `useRealtimeComposer()` (set(amplitude, frequency), playDiscrete), `useAdaptiveHaptics`, `Settings.getHapticsSupportLevel()` / `getHapticCapabilities()`, and a Pulsar Studio bundle config plugin. All functions are worklet-compatible, so they can be called from gesture worklets. It requires the New Architecture and react-native-worklets. Android capability varies: composition primitives need API 30+ and envelope/frequency need API 36+, and the app must handle fallbacks (https://docs.swmansion.com/pulsar/sdk/react-native/). react-native-nitro-haptics 0.2.3 (last published 2026-03-15) is small and immature. The similarly named react-native-nitro-haptic says in its README it was primarily ChatGPT-generated, so avoid it. react-native-haptic-feedback 3.0.0 supports AHAP/pattern notation on iOS.

**State & persistence:** A 'haptics enabled' toggle in MMKV-persisted settings, mirrored into Pulsar `Settings` enable/disable.

**Web-only deps:** navigator.vibrate (if used on web)

**Motion & sound:** Sync haptic and sound on piece drop (pattern plus SFX). Expo SDK 56 added Safari web haptics to expo-haptics (irrelevant for native).

**Mobile mapping:** Recommendation: react-native-pulsar 1.7.0 as the main haptics engine, called directly inside RNGH 3 worklets for zero-latency feedback, with custom patterns for puzzle solved, wrong move and streak. Keep expo-haptics ~58.0.7 as a simple fallback for plain UI controls. Centralise behind a `haptics.ts` facade (`haptics.pickup()`, `.drop()`, `.illegal()`, `.solved()`, `.tick()`) that checks the user toggle and the support level.

**Why M:** Integration is easy. Designing and tuning a coherent pattern set per event and per platform, plus Android capability fallbacks, takes iteration on real devices.


## Audio SFX: react-native-audio-api vs expo-audio  ·  complexity M

**Where:** move/capture/check/correct/wrong/session-end sounds, sound settings

**Behaviour**

Commit afec3e5 shows the web plays short clips via Web Audio with leading-silence trimming and loudness levelling. react-native-audio-api 0.13.6 (Software Mansion, MIT, 2026-09-23; nightly 1.0.0) implements the Web Audio API spec on iOS, Android and web: AudioContext, decodeAudioData, buffer sources, gain, analysers; it decodes m4a/mp4/aac/ogg/opus. It has an optional Expo config plugin `react-native-audio-api` (iosBackgroundMode, iosMicrophonePermission, androidPermissions, androidForegroundService, androidFSTypes), needs a dev build, and needs worklets >=0.7.0 only for worklet nodes (https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/getting-started). expo-audio ~58.0.10 (latest 58.0.10) provides `useAudioPlayer` / `createAudioPlayer` (manual `remove()`), `Audio.preload()` for near-instant playback (call at module scope), and `setAudioModeAsync({playsInSilentMode (default true), interruptionMode: 'mixWithOthers' (default; recommended for SFX), shouldPlayInBackground})`. On iOS a preloaded source is consumed after one use. The docs have no latency or concurrency guarantees (https://docs.expo.dev/versions/latest/sdk/audio/). SDK 58 added lock-screen playlists and WAV/PCM recording.

**State & persistence:** Sound on/off and volume in MMKV settings. Decoded AudioBuffers cached in memory at app start.

**Web-only deps:** Web Audio API (AudioContext, decodeAudioData, AudioBufferSourceNode, GainNode); fetch of audio assets from /public; user-gesture unlock of AudioContext

**Motion & sound:** Low latency matters: a sound must coincide with the piece-drop frame and haptic. Pre-decode all clips at startup and play through buffer sources (sub-10ms class latency per the SWM testimonial; not independently verified).

**Mobile mapping:** Recommendation: react-native-audio-api 0.13.6. The existing web Web Audio sound module (trim and level logic) can port almost verbatim, since the API mirrors the web spec. Bundle clips as assets (expo-asset ~58.0.18), decode once into AudioBuffers, and play via createBufferSource with a shared GainNode. Configure the iOS session as ambient/mix-with-others so the app never stops the user's music; verify the AudioManager API names in the docs. Fallback: expo-audio ~58.0.10 with `Audio.preload` and `interruptionMode: 'mixWithOthers'`.

**Why M:** API parity with Web Audio keeps code changes small. Audio-session behaviour (silent switch, mixing, interruptions) and latency tuning need device testing.


## Push notifications: expo-notifications + Expo Push Service (vs FCM/APNs direct, notifee)  ·  complexity L

**Where:** permission prompt / onboarding step, notification settings screen, deep-link handlers, backend notifications module (NestJS)

**Behaviour**

expo-notifications ~58.1.6 (latest 58.1.6). Remote push needs a development build and does not work in Expo Go on Android since SDK 53 (local notifications still do). Android 13+ only shows the permission prompt after a channel exists, so call `setNotificationChannelAsync` before requesting a token. A channel's settings are immutable after creation apart from name and description. Categories/actions go through `setNotificationCategoryAsync` (no ':' or '-' in ids). `setBadgeCountAsync` needs iOS allowBadge. Local triggers: date, timeInterval, daily, monthly (weekly/yearly Android-only; calendar on iOS). Background tasks use expo-task-manager with headless `contentAvailable` pushes. `getDevicePushTokenAsync` returns raw FCM/APNs tokens. Config plugin options: icon (96x96 white PNG), color, sounds (.wav), enableBackgroundRemoteNotifications (https://docs.expo.dev/versions/latest/sdk/notifications/). SDK 58 changes: foreground notifications now show by default unless setNotificationHandler says otherwise (breaking); `threadIdentifier` grouping; Android `delivery: 'alarmClock'`; `largeIcon` plugin property; and iOS forwarding to other UNUserNotificationCenter delegates. Expo Push Service (https://docs.expo.dev/push-notifications/sending-notifications/): POST https://exp.host/--/api/v2/push/send (up to 100 messages per request, 600 notifications/sec per project, 4 KiB payload), and POST https://exp.host/--/api/v2/push/getReceipts (up to 1,000 ids; fetch about 15 min later; receipts kept 24h). Errors: DeviceNotRegistered (stop sending), MessageRateExceeded, MessageTooBig, InvalidCredentials, MismatchSenderId. Optional access token via `Authorization: Bearer`. Message fields: title, body, data, ttl (default 4 weeks), priority, channelId, sound, badge, interruptionLevel, mutableContent, categoryId, collapseId, richContent.image (needs an iOS Notification Service Extension). Setup needs FCM V1 credentials uploaded to EAS, an APNs key via `eas credentials`, and a projectId from `Constants.expoConfig.extra.eas.projectId` (https://docs.expo.dev/push-notifications/push-notifications-setup/). @notifee/react-native last released 9.1.8 (2024-12-20), and its repo was archived 2026-04-07 with a recommendation to migrate to expo-notifications (https://github.com/invertase/notifee). The community fork react-native-notify-kit 10.9.1 (2026-10-24) is a drop-in replacement with Expo CNG support.

**API**

- `(new) POST /notifications/devices — register an Expo push token per user/device (backend to add)`
- `(new) DELETE /notifications/devices/:token`
- `(new) PATCH /notifications/preferences`
- `Expo: POST https://exp.host/--/api/v2/push/send`
- `Expo: POST https://exp.host/--/api/v2/push/getReceipts`

**State & persistence:** The device's Expo push token in SecureStore/MMKV and in the backend DB (new Prisma model: userId, token, platform, createdAt, lastSeenAt, disabledAt). A receipt-polling job in a backend queue (Redis already exists). Notification preferences live server-side.

**Web-only deps:** none (web had no push; Service Worker push not used per owner's complaint about PWA)

**Motion & sound:** Custom notification sound (.wav via the config plugin). Pair a haptic with the in-app foreground banner.

**Mobile mapping:** Recommendation: expo-notifications ~58.1.6 plus the Expo Push Service, with expo-server-sdk 8.0.0 (2026-10-22) in the NestJS backend: send in chunks of 100, use an access token, poll receipts after about 15 min, and prune on DeviceNotRegistered. This avoids running FCM HTTP v1 and APNs HTTP/2 yourself. Move to firebase-admin 14.5.0 / @parse/node-apn 8.1.0 direct only if Expo's limits matter. Use expo-notifications local scheduling for streak or daily reminders. Do not use notifee; use react-native-notify-kit only if rich local notifications (progress, foreground services) are needed. Handle `useLastNotificationResponse` / response listeners to deep-link through expo-router.

**Why L:** The client side is moderate. It also needs new backend tables, endpoints, a sending queue, receipt handling, credentials (FCM V1, APNs key), a permission UX, and deep-link routing.


## Images & avatar upload: expo-image (+ picker/manipulator)  ·  complexity M

**Where:** avatars, piece sprites, profile avatar editor (web uses react-easy-crop)

**Behaviour**

expo-image ~58.0.16 (latest 58.0.17) does disk and memory caching. SDK 57 added `writeToCacheAsync` / `readFromCacheAsync`. SDK 58 added `transition.skipOnCacheHit` and `svgVariables` for SVG var() values. The web uses react-easy-crop ^5.5.7 for avatar cropping.

**API**

- `(avatar upload endpoint — from profile-area inventory)`

**State & persistence:** expo-image cache. The avatar URL comes from the user query.

**Web-only deps:** react-easy-crop; <img>; canvas-based crop export; File/Blob/FormData from <input type=file>

**Motion & sound:** expo-image `transition` fade (skip on cache hit).

**Mobile mapping:** expo-image ~58.0.16 for all images. For avatar crop, use expo-image-picker ~58.0.10 (`allowsEditing: true, aspect: [1,1]` for system crop) plus expo-image-manipulator ~58.0.15 to resize/compress before upload, or react-native-image-crop-picker 0.52.0 for a circular crop UI. Upload via fetch with FormData { uri, name, type }.

**Why M:** The crop UX differs from react-easy-crop. The native system crop is easier, but its UI is different.


## Charts (rating history etc.): victory-native vs custom Skia/SVG  ·  complexity M

**Where:** rating graph, stats screens

**Behaviour**

victory-native 43.0.1 (2026-10-20; 'Victory Native XL', Nearform, active) is built on D3, Skia and Reanimated. Its peers are react >=19, RN >=0.79, `react-native-skia` >=2.15.1 <3.0.0 (the new unscoped package, not @shopify), Reanimated >=4.1.7 <5, worklets >=0.7 and RNGH >=2 <4. It does not support Skia 3, and the README warns against installing both Skia packages (https://github.com/FormidableLabs/victory-native-xl). Expo SDK 58's bundled list still pins `@shopify/react-native-skia` 2.14.0, the final release under that name. Alternative: react-native-gifted-charts 1.4.81 (SVG-based).

**API**

- `(rating history endpoint — from stats-area inventory)`

**State & persistence:** react-query data.

**Web-only deps:** whatever the web uses for charts (no chart lib in frontend package.json, so likely hand-rolled SVG/CSS — confirm)

**Motion & sound:** Press-and-drag tooltip with a haptic `selection` tick per data point (victory useChartPressState or a custom pan).

**Mobile mapping:** If the web charts are hand-rolled SVG (no chart dependency in package.json), port them to react-native-svg 15.16.0 with Reanimated path animation; this is the lowest-risk option. If richer charts are wanted, use victory-native 43.0.1 with `react-native-skia@2.15.2` (release-2.x) and don't install @shopify/react-native-skia. Run expo-doctor to accept the deviation from the SDK-pinned Skia.

**Why M:** Small surface, but the Skia package transition makes the dependency choice delicate.


## Icons: lucide-react-native  ·  complexity S

**Where:** all icons

**Behaviour**

The web uses lucide-react ^0.446.0. lucide-react-native latest is 1.61.0 (2026-10-21), with peer react-native-svg ^12–^15 (SDK 58 pins react-native-svg 15.16.0). @expo/vector-icons is no longer a dependency of `expo` since SDK 56 and is being replaced by `@react-native-vector-icons/*` (https://expo.dev/changelog/sdk-56). Native tab icons should use SF Symbols (expo-symbols ~58.0.4) and Material Symbols rather than lucide.

**State & persistence:** n/a

**Web-only deps:** lucide-react@^0.446.0

**Motion & sound:** Icons can be animated via Reanimated on react-native-svg.

**Mobile mapping:** lucide-react-native 1.61.0 plus react-native-svg 15.16.0, imported per icon (tree-shaken). Use expo-symbols ~58.0.4 (`sf` / `md`) for tab bar and toolbar icons so they get native rendering and weight.

**Why S:** Mechanical import swap. Some icons may have been renamed between lucide 0.446 and 1.x (verify).


## Fonts: expo-font  ·  complexity S

**Where:** root layout, typography tokens

**Behaviour**

expo-font ~58.0.9 embeds fonts at build time with a config plugin. SDK 58 adds variable font support on Android, iOS and web, and RN 0.88 adds variable fonts to Text/TextInput. The web presumably uses next/font (the previous deploy note mentions fonts loading in CI; family names unknown).

**State & persistence:** n/a

**Web-only deps:** next/font (presumed); @font-face CSS

**Motion & sound:** Embedding avoids a FOUT/splash delay.

**Mobile mapping:** expo-font ~58.0.9 config plugin (`plugins: [['expo-font', { fonts: [...] }]]`) to embed TTF/OTF files. Keep expo-splash-screen ~58.0.11 visible until the first data is ready. With Uniwind, map families in global.css.

**Why S:** Copy the font files and configure the plugin.


## Bottom sheets & dialogs: native formSheet vs @gorhom/bottom-sheet  ·  complexity M

**Where:** puzzle settings sheet, promotion picker, confirmations, dropdown menus (web Radix DropdownMenu)

**Behaviour**

The web uses Radix Dialog, DropdownMenu, Switch, Label, Slot and Tabs. @gorhom/bottom-sheet 5.2.14 (2026-05-09; regular 2026 bugfix releases) has peers reanimated '>=3.16.0 || >=4.0.0-' and RNGH '>=2.16.1'. Its v5 docs say it was written for Reanimated 3 and RNGH 2. Reanimated's 3→4 migration guide notes PR #2356 may need patching for older versions. No explicit RNGH 3 support statement was found. Native alternatives: expo-router Stack `presentation: 'formSheet'` (detents, grabber, corner radius; Android max 3 detents), and @expo/ui ~58.0.22, whose SwiftUI and Jetpack Compose components have been stable since SDK 56 (native menus, pickers, switches, context menus).

**State & persistence:** Sheet visibility via routes (formSheet) or local state.

**Web-only deps:** @radix-ui/react-dialog; @radix-ui/react-dropdown-menu; @radix-ui/react-switch; @radix-ui/react-label; @radix-ui/react-slot; @radix-ui/react-tabs

**Motion & sound:** Native sheet springs and interactive dismissal. Haptic on detent snap.

**Mobile mapping:** Recommendation: native `formSheet` routes for most sheets and @expo/ui ~58.0.22 for native Switch, ContextMenu and Picker in place of the Radix primitives. Use RN Switch or expo/ui for toggles and react-native-keyboard-controller 1.22.7 for keyboard-aware forms. Adopt @gorhom/bottom-sheet 5.2.14 only for custom in-screen sheets, after verifying RNGH 3.3 compatibility on a spike.

**Why M:** Every Radix primitive needs a native counterpart. The behaviour differences (focus traps, portals) mostly disappear, but the UX has to be redesigned.


## i18n  ·  complexity S

**Where:** all strings, language switcher

**Behaviour**

The web frontend package.json has no i18n library, so the web presumably uses a custom dictionary/context. Key counts must come from the i18n-area agent. Options: expo-localization ~58.0.5 for device locale (SDK 58: iOS RTL no longer forced by supportsRTL); i18next 26.5.10 plus react-i18next 17.1.8; @lingui/core 6.10.1; i18n-js 4.5.4. Hermes ships Intl (number/date formatting).

**State & persistence:** Chosen locale in MMKV, defaulting to `getLocales()[0].languageCode` from expo-localization.

**Web-only deps:** navigator.language; possibly Next middleware locale detection / cookies

**Motion & sound:** n/a

**Mobile mapping:** Move the existing web dictionaries (JSON/TS objects) verbatim into a shared workspace package and keep the same lookup API, so translations stay single-sourced. Use expo-localization ~58.0.5 for the initial locale. Adopt i18next 26.5.10 / react-i18next 17.1.8 only if pluralisation or interpolation needs outgrow the custom solution.

**Why S:** The dictionaries are pure data and shareable; the hook is a thin re-implementation.


## Builds, OTA & release: EAS Build / Update / Submit / Workflows / Observe  ·  complexity M

**Where:** eas.json, .eas/workflows/*.yml, app.config.ts

**Behaviour**

eas-cli latest 25.3.0 (2026-10-20). EAS Update (https://docs.expo.dev/eas-update/introduction/) uses expo-updates ~58.0.18 and `eas update --channel production`. Runtime-version policies gate native compatibility (fingerprint policy; SDK 58 makes Fingerprint's `balanced` preset the default). It supports percentage rollouts and rollback by republishing. It can ship JS, styles, images and translations; native deps, permissions and SDK bumps need a new binary. MAU billing counts installs that download an update. Hermes bytecode diffing has been on by default since SDK 56, and SDK 58 adds `updates.maxUpdatesToKeep`. EAS Workflows offers build, update and maestro job types. EAS Observe went GA on 2026-08-20, and native crash reporting arrived 2026-10-07 (requires expo 57.0.21+). @sentry/react-native ~8.28.0 is SDK-pinned (latest 8.32.0). The GitHub Actions CI deploys the web today.

**State & persistence:** Channels: development / preview / production. Runtime version = fingerprint.

**Web-only deps:** Next build + current deploy pipeline (deploy/, .github/workflows)

**Motion & sound:** n/a

**Mobile mapping:** Use EAS Build profiles: development (dev client), preview (internal distribution; EAS Workflows can automate iOS device registration), e2e-test (simulator / apk, withoutCredentials), and production. Ship through EAS Submit to TestFlight and the Play internal track, and through EAS Update with the fingerprint runtimeVersion for JS hotfixes. Add EAS Workflows for PR builds plus Maestro, and EAS Observe or Sentry for crashes.

**Why M:** Needs Apple and Google developer accounts, credentials, store listings, privacy manifests and CI wiring. It is one-time but long-tailed.


## Testing: Maestro E2E + jest-expo / RNTL  ·  complexity M

**Where:** .maestro/*.yml flows, __tests__

**Behaviour**

Maestro CLI latest is cli-2.11.0 (2026-09-29). EAS runs Maestro through a workflow `maestro` job that consumes a build_id from an `e2e-test` profile (ios.simulator: true, android.buildType 'apk') with flows in `.maestro/` (https://docs.expo.dev/build-reference/e2e-tests/). Expo added Maestro insights, clearer results and faster retries (changelog, 2026-06-24). jest-expo ~58.0.12. @testing-library/react-native 14.1.0 (2026-10-08) has peers jest >=29, react >=19, RN >=0.78 and `test-renderer` ^1.0.0 (react-test-renderer replacement). MMKV auto-mocks in Jest. For Skia, update the Jest config to the new package name.

**State & persistence:** n/a

**Web-only deps:** (no web test stack found in frontend package.json)

**Motion & sound:** n/a

**Mobile mapping:** Unit-test the shared pure logic (chess/puzzle/rating) with plain Jest or Vitest in packages/shared. Use jest-expo ~58.0.12 plus RNTL 14.1.0 for components, and Maestro 2.11 flows for the critical path (login → start session → solve puzzle → see rating change) in EAS Workflows on PRs. Add testIDs on board squares so Maestro can tap moves.

**Why M:** Greenfield test setup. Gesture-driven board moves in Maestro need testID-addressable squares and tap-to-move support.


## Monorepo: pnpm + Expo pitfalls  ·  complexity M

**Where:** pnpm-workspace.yaml, apps/mobile/metro.config.js, packages/shared (new)

**Behaviour**

Repo facts: the root declares `packageManager: pnpm@9.12.0`, `engines.node >=20`, devDeps typescript ^5.5.4 and prettier ^3.3.3. pnpm-workspace.yaml lists `apps/*` and `packages/*`, but no `packages/` directory exists yet. There is no root .npmrc, so pnpm runs with default isolated node-linker. The apps are backend and frontend. Current pnpm is 12.15.0 (latest-10 10.34.8, latest-9 9.15.9). TypeScript latest is 7.0.2, while Expo SDK 56 notes TypeScript 6.0.3. Expo monorepo guide (https://docs.expo.dev/guides/monorepos/): SDK 52+ auto-configures Metro via expo/metro-config (remove manual watchFolders/nodeModulesPaths/extraNodeModules/disableHierarchicalLookup). SDK 54+ supports isolated installs; if a library breaks, fall back to `nodeLinker: hoisted` in pnpm-workspace.yaml. SDK 55+ auto-enables `experiments.autolinkingModuleResolution` in monorepos. Duplicate React Native versions are unsupported, and duplicate React in one app causes runtime errors; detect with `pnpm why --depth=10 react-native` and force with root `resolutions`/`overrides`. Use `"workspace:*"` for shared packages. Hardcoded `../../node_modules/react-native/...` paths in third-party native code break and need patch-package. SDK 56 mentions pnpm global virtual store dedupe (~300 MB saved per duplicate Expo install) and fixed tsconfig `paths` bugs. SDK 58: `EXPO_PUBLIC_*` values are part of the Metro transform cache key, and the Rust transformer 'Noxcturnal' is experimental.

**State & persistence:** n/a

**Web-only deps:** apps/frontend pins react@^18.3.1 / next@^14.2.15, which conflicts with Expo's react 19.3.0 if both live side by side

**Motion & sound:** n/a

**Mobile mapping:** Add `apps/mobile` (Expo SDK 58) and `packages/shared` (pure TS: chess/puzzle logic, API types/DTOs, query keys, i18n dictionaries, design tokens) referenced as `"shared": "workspace:*"`. Keep pnpm isolated mode and test the first dev build early; if native build or resolution errors appear, set `nodeLinker: hoisted`. Because the web is being retired, either delete apps/frontend once parity is reached, or leave it frozen. While it remains, make sure the shared package does not import React, or declare react as a peerDependency, to avoid React 18/19 duplication. Bump the root engines to node >=22.13. Pin TypeScript to the version Expo SDK 58 expects (check `expo-doctor`) rather than TS 7 at first. Run `npx expo-doctor@latest` in CI.

**Why M:** Metro auto-config makes the basic setup easy, but isolated pnpm installs and React 18/19 coexistence are the classic sources of hard-to-debug native and runtime errors.


## Chess logic on RN: chess.js  ·  complexity S

**Where:** puzzle engine, move validation, SAN/UCI conversion, board state

**Behaviour**

chess.js latest 1.4.0 (2025-06-14; BSD-2-Clause) has no dependencies and ships TypeScript sources with both CJS (dist/cjs/chess.js) and ESM (dist/esm/chess.js) builds. It is pure JS and runs on Hermes. The lockfile resolves chess.js 1.4.0 for two importers (frontend and, presumably, backend), so the same rules engine already runs on both server and web. react-native-chessboard and rn-chessboard use chess.js as well.

**State & persistence:** A chess.js instance in memory; FEN and move list in a zustand store.

**Motion & sound:** Move results (capture/check/mate flags) drive sound and haptic selection.

**Mobile mapping:** Use chess.js 1.4.0 unchanged. Move all puzzle and move-handling helpers that only depend on chess.js into packages/shared so web, backend and mobile share one implementation. In 1.x, illegal `move()` calls throw, so wrap them in try/catch for snap-back (behaviour from memory, not verified in this research).

**Why S:** Pure TS with no platform dependencies.


## Native polish extras (keyboard, safe areas, splash, system UI, Expo UI, crash reporting)  ·  complexity S

**Where:** forms (login/register), root layout, status/navigation bars

**Behaviour**

SDK 58 pins: react-native-keyboard-controller 1.22.7, expo-splash-screen ~58.0.11, expo-system-ui ~58.0.6, expo-status-bar ~58.0.4, expo-navigation-bar ~58.0.4, expo-glass-effect ~58.0.4 (iOS Liquid Glass), @expo/ui ~58.0.22 (SwiftUI/Compose components stable since SDK 56), expo-blur ~58.0.5, expo-linear-gradient ~58.0.3, lottie-react-native ~7.5.0, expo-store-review ~58.0.2, expo-sharing ~58.0.20, expo-clipboard ~58.0.4, expo-keep-awake ~58.0.3, expo-screen-orientation ~58.0.3 (SDK 58 known issue: lockAsync may not work on resizable iOS 27 apps). Android edge-to-edge is automatic since SDK 54 (react-native-edge-to-edge is deprecated per the Unistyles docs).

**State & persistence:** n/a

**Web-only deps:** CSS backdrop-filter; CSS gradients; viewport meta / safe-area env()

**Motion & sound:** Keyboard-synchronised animations via keyboard-controller. Lottie for celebration effects (e.g. streak or puzzle solved).

**Mobile mapping:** Use all SDK-pinned versions above via `npx expo install`. expo-keep-awake during timed puzzle sessions. expo-store-review after positive moments. expo-sharing for sharing a puzzle or result image (react-native-view-shot 6.1.1 is SDK-pinned).

**Why S:** Mostly drop-in Expo modules.


## Shared-logic candidates

- `chess.js@1.4.0 (npm dependency, resolved for frontend and a second importer in pnpm-lock.yaml)` — Chess class: move generation/validation, FEN/PGN, SAN — blockers: None. Zero dependencies, CJS+ESM, Hermes-compatible.
- `packages/shared (to be created; pnpm-workspace.yaml already globs packages/*)` — Puzzle/session/rating pure logic, API DTO types, query-key factories and fetchers (fetch-based), zustand store definitions without persistence adapters, i18n dictionaries, design tokens (colors/radii/spacing from tailwind config) — blockers: Whether each frontend lib file is DOM-free needs confirmation by the frontend-area agents (this agent only read package.json). React 18 (web) vs React 19.3 (mobile): shared code must not bundle its own React, so declare react as a peerDependency or keep the package React-free.
- `Web sound module (Web Audio clip trimming / loudness levelling, commit afec3e5)` — Clip decode/trim/level/play helpers — blockers: Uses the browser AudioContext. Ports almost verbatim to react-native-audio-api 0.13.6 (Web Audio-compatible API), but asset loading and AudioContext construction differ, so inject the context.

## Haptics opportunities

- Piece pickup: Pulsar `Presets.System.selection` / expo-haptics selectionAsync, fired inside the RNGH 3 pan `onActivate` worklet.
- Piece drop on a legal square: light impact. Capture: medium/rigid impact. Check: a short double-tap custom pattern via usePatternComposer.
- Illegal move / wrong puzzle move: notification Error (Android `AndroidHaptics.Reject`) synced with the snap-back spring and a shake.
- Puzzle solved: notification Success, or a custom 'fanfare'-style Pulsar pattern. Session complete / rating up: a richer celebratory pattern.
- Rating slider in Play setup: `Segment_Tick` / selection tick per rating step, and a heavier tick when crossing the suggested comfort zone.
- Board flip, hint reveal, solution step-through (next/prev move): light ticks.
- Toggle switches and segmented controls: `Toggle_On/Toggle_Off` on Android, selection on iOS.
- Pull-to-refresh threshold reached and formSheet detent snaps: soft impact.
- Chart scrubbing (rating history): a selection tick per data point.
- Timer warnings in timed sessions (if they exist): escalating pulses via useRealtimeComposer.

## Push opportunities

- Daily puzzle / training reminder at the user's chosen local time (local scheduled notification via expo-notifications daily trigger; no server needed).
- Streak at risk ('you haven't trained today'): server-side via the Expo Push Service using the Redis/BullMQ-style queue the backend already has Redis for, or a local notification rescheduled on each session.
- Rating milestone reached / new personal best (server push after a session is processed).
- Weekly progress summary (server push, categoryId with 'View stats' action).
- Re-engagement after N days of inactivity (server push with collapseId so pushes don't stack).
- Product updates / new puzzle themes (broadcast; respect a marketing opt-out preference).
- If multiplayer/challenges are ever added: 'your opponent moved' as time-sensitive interruptionLevel pushes.

## Risks

- Skia package split: @shopify/react-native-skia is frozen at 2.14.0, which Expo SDK 58 still pins, while the ecosystem (victory-native 43.x) now needs the unscoped `react-native-skia` >=2.15.1 <3. Installing both breaks (same native module). Skia v3 (3.8.0) requires Android minSdk 26 and Vulkan 1.1, and the Play Store hides the app from devices without Vulkan. Avoid Skia for the board, or pin react-native-skia@2.15.x deliberately.
- NativeWind v5 is still 5.0.0-rc.0 and documented as not for production. Uniwind Pro features (auto safe-area insets, gradients on theme change, filters) are paid or licensed differently; pricing was not verified.
- @gorhom/bottom-sheet 5.2.14 has no documented support for Gesture Handler 3 (SDK 58 pins RNGH ~3.3.0). RNGH 3 forbids gesture relations between the hook API and v2 APIs, so mixing libraries may break simultaneous gestures.
- Notifee is archived (2026-04-07). Any tutorial suggesting it is outdated; use expo-notifications or the react-native-notify-kit fork.
- Expo Go for SDK 58 is not released yet, and Android Expo Go has had no remote push since SDK 53. The team must use dev clients and EAS Build from day one (needs Apple Developer and Google Play accounts plus an FCM V1 service account).
- SDK 58 breaking changes: foreground notifications show by default, Android R8 minify on in release (can strip reflection-based libs), Strict TS API (deep RN imports fail), and a SceneDelegate-based iOS lifecycle (custom AppDelegate code must migrate).
- Monorepo: apps/frontend uses React 18.3.1 / Next 14 while Expo needs React 19.3.0. Shared packages that import React can cause duplicate-React runtime errors. pnpm isolated installs are supported since SDK 54, but some RN libs still fail; fallback is `nodeLinker: hoisted`, which would also change the backend and frontend install layout.
- Tooling version drift: the repo pins pnpm@9.12.0 (current 12.15.0) and node >=20 (SDK 58 needs >=22.13; odd Node versions unsupported). TypeScript 7.0.2 is the latest, but Expo's expected TS version for SDK 58 is unverified; pin what expo-doctor accepts.
- Hermes V1 had a memory regression with reanimated/worklets in SDK 56/57 (fixed in expo 57.0.9+ / 57.0.17). Watch memory on long puzzle sessions and test release builds on low-end Android.
- Pulsar advanced haptics depend on Android API level (primitives API 30+, envelopes API 36+), so many Android devices get degraded patterns and the app must implement fallbacks. iOS haptics are silent in Low Power Mode.
- react-native-audio-api is pre-1.0 (0.13.6; 1.0 nightlies exist), so API churn is possible. iOS audio-session configuration must not interrupt user music (use ambient/mixWithOthers).
- Expo Push Service limits: 600 notifications/sec per project, 100 per request, 4 KiB payload; receipts expire after 24h. The backend must poll receipts and prune DeviceNotRegistered tokens or deliverability degrades.
- react-native-chessboard (the main RN reference board) has 109 stars, and its README says to use it in production with caution; it lacks premoves and arrows. lichess mobile is Flutter and GPL-3.0, so use it only as a UX reference and never copy its code.
- Typed routes in expo-router are still beta (experiments.typedRoutes). Native tabs cap at 5 on Android and cannot be fully custom-styled.
- Version numbers came from npm dist-tags and Expo's sdk-58 bundledNativeModules.json on 2026-10-25. Several summaries came from a WebFetch summariser, so verify exact API names (e.g. expo-audio `remove()` vs `release()`, the react-native-audio-api AudioManager session API) when implementing.

## Open questions

- Does the backend use cookie sessions or bearer tokens? This decides whether mobile auth needs backend changes (expo-secure-store plus a refresh flow).
- Does the app use any realtime transport (SSE/WebSocket/socket.io) today? react-native-sse is stale (last release 2024-03-05); socket.io-client 4.8.4 works on RN.
- Which web chart or graph implementation exists (no chart lib in frontend package.json)? This decides react-native-svg vs victory-native plus react-native-skia.
- Piece set and board assets: are the web pieces SVG or PNG, and under what licence? This determines expo-image sprites vs react-native-svg.
- Exact web animation durations/easings and localStorage keys: to come from the frontend-area agents' inventories.
- Is Uniwind Pro needed (auto insets, gradients), and is its licence or pricing acceptable? Pricing not found in the docs.
- Which TypeScript version does Expo SDK 58 officially support (SDK 56 referenced 6.0.3; npm latest is 7.0.2)? Check with expo-doctor.
- Should apps/frontend be deleted at parity or kept frozen? This affects React 18/19 coexistence and pnpm hoisting decisions.
- Does @gorhom/bottom-sheet 5.2.14 work with react-native-gesture-handler 3.3? Needs a spike before adoption.
- Will Expo publish an SDK 58 patch moving from @shopify/react-native-skia 2.14.0 to react-native-skia? Watch the expo changelog before adding any Skia dependency.
- App identity: bundle identifier/package name, Apple Team, Google Play account and Firebase project for FCM V1 all need owner input before the first EAS build.
- Is i18n custom on the web (no i18n lib in package.json)? How many locales and keys? Lets the dictionaries move verbatim to packages/shared.
