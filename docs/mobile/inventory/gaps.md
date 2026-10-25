# Inventory: gaps

_gaps_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Interrupted session lifecycle: background, app kill, reload, back-swipe (MISSING from all inventories)  ·  complexity L

**Where:** apps/frontend/src/app/(app)/play/[id]/page.tsx (timer + boot effect lines 180-247), apps/frontend/src/lib/pending-puzzle.ts, apps/backend/src/sessions/sessions.service.ts (next/attempt/finish endedAt guards lines 130, 177, 263)

**Behaviour**

What the web does today when a running session is interrupted, which the port must decide on deliberately. (1) Timer: endsAt is a wall-clock timestamp. A setInterval of 250 ms calls setNow(Date.now()), and finish() fires when now >= endsAt. Pause/resume shifts endsAt and attemptStart. There is NO visibilitychange or pagehide listener, so a hidden tab keeps counting down. On mobile, backgrounding the app for longer than the remaining time means finish() fires on the first tick after returning. (2) Reload / reopening the runner URL: takeFirstPuzzle(sessionId) reads an in-memory Map (pending-puzzle.ts), which is empty after a reload. The runner then falls back to POST /sessions/:id/next, and applyNextResponse sets endsAt = Date.now() + durationSec*1000. The timer RESTARTS at the full duration, and the puzzle that was on screen is replaced by a new one. If /next returns 400 ('session ended'), it falls back to GET /sessions/:id for the summary, then to an all-zero summary. (3) Back navigation: there is no popstate/beforeunload guard. Browser back or closing the tab leaves the session with endedAt = null. (4) Orphans: the backend never closes sessions with endedAt null (no cron, @Interval or TTL found in apps/backend/src). Lists, analytics and the public profile filter `endedAt: { not: null }` (users.service.ts:95,106; analytics.service.ts:31,190), so orphans are invisible but their attempts still exist. (5) No in-progress session is surfaced anywhere: there is no 'resume' card on the dashboard or /play.

**API**

- `POST /api/sessions/:id/next`
- `GET /api/sessions/:id`
- `POST /api/sessions/:id/finish (body: save?, localDate?)`

**State & persistence:** Only in-memory state: the pending-puzzle Map, plus runner useState for endsAt, pausedRemainingMs, attemptStart and pauseStartedAt refs. Nothing about the active session is persisted on the client.

**Web-only deps:** setInterval 250 ms wall-clock tick re-rendering the whole 1272-line runner page; absence of visibilitychange handling (implicit behaviour); Next router back/forward with no guard

**Motion & sound:** None specific. Note that finish() on resume plays the summary/RankCeremony sounds immediately on foreground.

**Mobile mapping:** AppState listener (react-native AppState 'change'): auto-pause on 'background'/'inactive' and require an explicit resume, since the web pause() already exists. Persist {sessionId, endsAt or remainingMs, current puzzle id, ply} in MMKV so a cold start can offer 'Resume session / Finish / Discard'. Block the iOS swipe-back and the Android hardware back on the runner (expo-router Stack screen gestureEnabled:false + usePreventRemove / BackHandler) and route them into the existing Exit flow (save vs discard). Backend: add a sweeper (BullMQ/@nestjs/schedule) that finalises or discards stale sessions with endedAt = null after durationSec plus a grace period. Add GET /sessions/active (or include it in /users/me) so the app can resume. Keep the countdown in a Reanimated shared value or a ref plus a one-second text update, not a 250 ms React state tick.

**Why L:** This needs client persistence and new backend semantics (an active-session endpoint plus an orphan sweeper). It also changes how the rating rules apply to an abandoned session, and touches the most complex screen.


## Focus mode: fullscreen, scroll lock and immersive chrome  ·  complexity S

**Where:** apps/frontend/src/app/(app)/play/[id]/page.tsx lines 155-178, apps/frontend/src/app/(app)/layout.tsx (focusMode route detection), globals.css .play-locked / body.focus-mode

**Behaviour**

While the runner is mounted, the 'play-locked' class is always added to html and body. This hides overflow and works around iOS PWA reporting a 100dvh taller than the visible area. When the gameplay setting focusMode is on, the page also adds body.focus-mode and calls document.documentElement.requestFullscreen() (errors are swallowed), then exits fullscreen on unmount. The (app) layout separately treats /play/:id, /review/:puzzleId and /sessions/:id/review as 'focus routes': it renders no Nav and no PullToRefresh and lifts the max-w-5xl clamp. The screen can sleep mid-session because the web has no Wake Lock.

**State & persistence:** settings.focusMode (UserSetting, synced via PATCH /users/me/settings and cached in localStorage 'taktic.settings').

**Web-only deps:** Fullscreen API; document.body/html classList; 100dvh / iOS PWA viewport quirks

**Motion & sound:** None.

**Mobile mapping:** Make the runner screens full-screen stack routes outside the tabs group. Do the following when the runner screen is focused: hide the status bar with expo-status-bar (hidden), set the Android navigation bar to immersive with expo-navigation-bar, and call expo-keep-awake (useKeepAwake). This is new and important for timed sessions. Safe areas come from react-native-safe-area-context. The scroll lock is not needed because the runner is a non-scrolling View.

**Why S:** Native APIs map one to one. The work is mostly deleting web workarounds.


## Keyboard shortcuts and hardware-keyboard affordances  ·  complexity S

**Where:** apps/frontend/src/app/(app)/puzzles/[puzzleId]/page.tsx lines 170-181, apps/frontend/src/components/DifficultySlider.tsx onKeyDown (line 91), apps/frontend/src/components/ui/select.tsx (Escape, unused component)

**Behaviour**

In the read-only puzzle viewer, only in 'solution' mode, a window keydown handler maps ArrowRight to goToPly(ply+1) and ArrowLeft to goToPly(ply-1), with preventDefault. DifficultySlider handles arrow and other keys on its focusable thumb (role=slider aria-* attributes). The Select component closes on Escape. No other shortcuts exist: the runner, review and session-review runners have none.

**State & persistence:** None.

**Web-only deps:** window keydown listeners

**Motion & sound:** Stepping via keys triggers the same animateMove slide and move sounds as the step buttons.

**Mobile mapping:** Replace these with gestures. Add a horizontal swipe on the board area in solution mode (Gesture.Pan with activeOffsetX, failing on vertical) and keep the prev/next buttons, with a light haptic per step. Long-press on prev/next could auto-repeat. For the slider, use accessibilityActions increment/decrement (adjustable role) instead of keys. Optional iPad hardware-keyboard support can be skipped in v1.

**Why S:** Small and well isolated. It mainly needs a gesture-conflict check with board drag.


## Reduced-motion handling and CountTo number animation  ·  complexity S

**Where:** apps/frontend/src/components/RankCeremony.tsx line 35, apps/frontend/src/app/(app)/play/[id]/page.tsx CountTo / FillCount (lines 1240-1272)

**Behaviour**

Exactly two places honour prefers-reduced-motion. (1) RankCeremony shortens or skips its animation. (2) CountTo, used on the summary screen, animates an integer from 'from' to 'to' with requestAnimationFrame: ease-out cubic e = 1-(1-k)^3, default delay 350 ms (it starts after the card lands) and duration 900 ms, rendered with tabular-nums. With reduced motion it jumps straight to 'to'. FillCount embeds one counting number inside an i18n string by replacing a {token}. No CSS animations elsewhere check reduced motion.

**State & persistence:** None.

**Web-only deps:** window.matchMedia('(prefers-reduced-motion: reduce)'); requestAnimationFrame / performance.now

**Motion & sound:** CountTo uses a 350 ms delay, 900 ms duration and cubic ease-out.

**Mobile mapping:** Use Reanimated useReducedMotion() (or AccessibilityInfo.isReduceMotionEnabled) everywhere, not just in two places, and apply it globally to board slides, sparks and ceremonies. For CountTo, use withDelay(350, withTiming(to, {duration:900, easing: Easing.out(Easing.cubic)})) driving an animated TextInput or Text via useAnimatedProps (no React re-render per frame). Optionally add selection haptic ticks while counting.

**Why S:** This is a small utility. It becomes cross-cutting only if reduced motion is applied to every animation.


## Route / deep-link map (complete) for expo-router, universal links and push targets  ·  complexity M

**Where:** apps/frontend/src/app/** (all page.tsx), components/nav.tsx, SessionList.tsx, UserSearch.tsx, friends/leaderboard/admin pages (profile links)

**Behaviour**

Every navigable route and its params, as found by grepping all href/router.push/router.replace targets: / (landing; redirects to /dashboard when a token exists), /login, /register, /dashboard, /play, /play/:id (runner; router.push from /play after POST /sessions; router.replace('/dashboard') at line 362), /review, /review/:puzzleId?theme=<slug> (theme drill; advances with router.replace to keep history flat; back goes to /review?theme=… or /review), /sessions/:id, /sessions/:id/review, /puzzles/:puzzleId, /profile/:nickname (linked from nav, friends x3, leaderboard, UserSearch, admin x2), /friends, /leaderboard, /analytics, /settings, /admin. Auth redirects: the (app) layout does router.replace('/login') when there is no token, and the api.ts 401 handler does window.location.replace('/login'). Settings logout uses router.replace('/login'). Onboarding pushes /play at its end. There are no not-found.tsx, error.tsx or loading.tsx routes, so unknown ids get Next's default 404 or the page's own empty state. No share/copy-link feature exists (no navigator.share or clipboard usage).

**State & persistence:** URL is the only state carrier for theme filter (?theme=) and ids.

**Web-only deps:** next/navigation useRouter/useSearchParams/usePathname; next/link

**Motion & sound:** None.

**Mobile mapping:** Mirror this tree in expo-router: (auth) stack [login, register]; (tabs) [home, play, review, leaderboard, stats, settings] matching the 6-tab bar in the screenshots; full-screen stacks for play/[id], review/[puzzleId], sessions/[id]/review; push screens for sessions/[id], puzzles/[puzzleId], profile/[nickname], friends. Configure a scheme (e.g. taktic://) plus iOS Associated Domains / Android App Links on the production domain so /profile/:nickname, /review?theme= and /sessions/:id open the app. Push payloads should carry a route from this list. Add +not-found.tsx and per-route error boundaries. New opportunity: a share sheet (expo-sharing / RN Share) for profile and session links.

**Why M:** The routing is simple, but universal links need backend/nginx changes (apple-app-site-association, assetlinks.json), and push routing depends on it.


## Outbound external links  ·  complexity S

**Where:** apps/frontend/src/app/(app)/puzzles/[puzzleId]/page.tsx line 264, apps/frontend/src/components/landing/CTA.tsx lines 56, 60

**Behaviour**

The puzzle viewer links each puzzle to https://lichess.org/training/{puzzle.id}. The landing CTA links to https://database.lichess.org/ and https://game-icons.net (attribution). The public/design/themes/CREDITS.md attribution obligations also apply to mobile.

**State & persistence:** None.

**Web-only deps:** <a href target=_blank>

**Motion & sound:** None.

**Mobile mapping:** Open in-app with expo-web-browser openBrowserAsync (SFSafariViewController / Custom Tabs). Put the credits and attribution on a Settings › About screen, because the landing page will not ship in the app.

**Why S:** These are single calls, plus an About screen for licences.


## Error, empty, offline and session-expiry states (API client semantics)  ·  complexity M

**Where:** apps/frontend/src/lib/api.ts, apps/frontend/src/app/(app)/layout.tsx

**Behaviour**

api.ts details. API_URL comes from NEXT_PUBLIC_API_URL; otherwise it is `${location.protocol}//${location.hostname}:4000/api` so LAN phones can reach a dev Mac. assetUrl() prefixes /uploads/... paths with API_HOST and passes absolute http(s) URLs through. Token is in localStorage 'taktic.token'. On a non-OK response, a 401 sent WITH a token triggers handleSessionExpired(): a module-level once-guard clears the token and hard-reloads /login, so parallel 401s redirect only once. A 401 without a token (the login form) is left for the page to show. Error messages come from body.message (string, or JSON.stringify of a validation array) or fall back to statusText, and are thrown as Error. A 204 returns undefined. There is NO request timeout, NO offline detection (no navigator.onLine or 'online'/'offline' listeners), NO retry beyond react-query defaults, and NO error boundaries or not-found routes. The mid-session /attempt and /finish calls are not queued if the network drops.

**API**

- `all endpoints (client semantics)`

**State & persistence:** localStorage 'taktic.token' and a module-level sessionExpiryHandled flag.

**Web-only deps:** fetch + window.location.replace hard reload; localStorage

**Motion & sound:** None.

**Mobile mapping:** Rebuild the client as a shared fetch wrapper with injectable baseUrl and token getter (EXPO_PUBLIC_API_URL). Store the token in expo-secure-store and handle 401 by clearing it and router.replace('/(auth)/login') through an auth store, not a reload. Add AbortController timeouts, @react-native-community/netinfo for an offline banner, react-query onlineManager/focusManager wiring (AppState), and an outbox for /attempt and /finish during sessions. Add designed empty and error states per screen (the web relies on inline text).

**Why M:** The wrapper is small, but offline queuing for the session runner and a consistent error UX touch every screen.


## Locale-sensitive date/number formatting and plural rules  ·  complexity S

**Where:** components/SessionList.tsx (toLocaleDateString x2, toLocaleTimeString), app/(app)/sessions/[id]/page.tsx (date+time), app/(app)/profile/[nickname]/page.tsx:141, components/achievements/AchievementCard.tsx:86, app/(app)/analytics/page.tsx (toLocaleString x3), app/(app)/admin/page.tsx:67, lib/i18n.ts lines 817-824 (Intl.PluralRules for useTn)

**Behaviour**

There are 10 call sites of toLocaleDateString/TimeString/String, each passing the en/uk app language, plus Intl.PluralRules for Ukrainian one/few/many plural forms in useTn. Day grouping in SessionList (Today/Yesterday/date) depends on the local date.

**State & persistence:** settings.language ('taktic.lang').

**Web-only deps:** Browser Intl (full ICU)

**Motion & sound:** None.

**Mobile mapping:** Hermes ships Intl (DateTimeFormat, NumberFormat, PluralRules) on iOS and Android in current RN, so the code can move verbatim. Verify uk-UA output on an Android device early, and use expo-localization to choose the initial language instead of navigator-based detection.

**Why S:** The code ports as is. The only work is verifying it on a device.


## Accessibility baseline  ·  complexity M

**Where:** components/board/Chessboard.tsx (no aria attributes), app/layout.tsx viewport (userScalable:false, maximumScale:1), DifficultySlider, segmented, toggle, Onboarding, settings (aria present)

**Behaviour**

ARIA usage is concentrated in DifficultySlider (7), settings (7), select (5) and Onboarding (4). The chessboard, puzzle runners and charts expose no labels, so the core loop is unusable with a screen reader. Pinch zoom is disabled globally. Chessboard suppresses the context menu (onContextMenu preventDefault) to allow right-click arrows.

**State & persistence:** None.

**Web-only deps:** aria-* / role attributes

**Motion & sound:** None.

**Mobile mapping:** Give each square an accessibilityLabel (e.g. 'e4, white knight'), use accessibilityRole adjustable on the slider, cap allowFontScaling / maxFontSizeMultiplier on board labels and timers, and support Dynamic Type elsewhere. Store reviewers do not require this, but it matters for quality.

**Why M:** Labelling a 64-square interactive board well, and testing it with VoiceOver and TalkBack, is real work.


## Text input platform behaviours (autofill, keyboard types, autofocus)  ·  complexity S

**Where:** app/login/page.tsx (autoComplete username/current-password, autoCapitalize none, spellCheck false), app/register/page.tsx (username, new-password x2), app/(app)/settings/page.tsx PasswordField autoFocus (change password), components/UserSearch.tsx autoFocus, components/RankCeremony.tsx autoFocus (CTA button), app/(app)/admin/page.tsx autoFocus, app/(app)/play/page.tsx:415 inputMode numeric (custom duration 'Other')

**Behaviour**

The web relies on browser password managers through these autocomplete hints. The custom-duration field opens a numeric keypad. Search and change-password fields focus on open.

**State & persistence:** None.

**Web-only deps:** HTML autocomplete/inputMode attributes

**Motion & sound:** None.

**Mobile mapping:** TextInput textContentType ('username', 'password', 'newPassword') plus autoComplete ('username', 'current-password', 'new-password') for iCloud Keychain and Google autofill and strong-password suggestions. This needs Associated Domains webcredentials on the production domain for credential sharing with the old web logins. Use keyboardType 'number-pad' for duration, autoFocus on search and change-password sheets, and react-native-keyboard-controller for avoidance.

**Why S:** These are prop mappings. Credential sharing needs the same AASA file as universal links.


## Server-side timezone awareness (prerequisite for streak and reminder pushes)  ·  complexity M

**Where:** apps/backend/prisma/schema.prisma line 22 comment, apps/backend/src/sessions/sessions.service.ts tickStreak lines 520-585

**Behaviour**

The streak day is ticked from the client-supplied localDate 'YYYY-MM-DD' passed to finish. The User model stores NO timezone (by design, per the schema comment). The server therefore cannot know when a user's local day ends, which any 'your streak is about to break' or daily-reminder push needs.

**API**

- `POST /api/sessions/:id/finish (localDate)`

**State & persistence:** None stored server-side.

**Motion & sound:** None.

**Mobile mapping:** Send the IANA zone from expo-localization getCalendars()[0].timeZone on device registration and on app foreground. Store it on the User or PushDevice, and schedule reminders per zone. Alternatively, schedule local notifications on the device (expo-notifications scheduleNotificationAsync with a daily trigger), which needs no server TZ. Keep sending localDate on finish.

**Why M:** It needs a schema migration and scheduler logic. The local-notification route is simpler but cannot react to friends' activity.


## Dev & QA tooling for mobile (seed script, LAN dev, test account)  ·  complexity S

**Where:** apps/backend/src/scripts/seed-test-sessions.ts (previously unread), apps/frontend/next.config.mjs (allowedDevOrigins ['172.20.10.3','192.168.1.94']), docker-compose.override.yml (postgres on 5433), /.claude-test-account (exists; not read, it holds credentials)

**Behaviour**

seed-test-sessions.ts is run via tsx (no npm script entry). It seeds 20 finished TrainingSessions for the HARDCODED nickname 'lazynightowl': 40% theme mode from a 10-theme list, duration picked from 5/10/15/20/30 min, startRating 1100-1700, solved 3-25, failed 0-8, peak +20..180, sessions spread about 1.3 days apart, and attempts built from real puzzles near the rating. It does not set 'style' or touch streak, progression or achievements. Local dev on a phone works through LAN IPs (allowedDevOrigins plus the API_URL hostname fallback).

**State & persistence:** Writes directly to Postgres via Prisma.

**Motion & sound:** None.

**Mobile mapping:** Parameterise the seed (nickname and count via argv), add style and streak fields, and add a package.json script so Maestro E2E and screenshot runs have deterministic data. For Expo dev clients set EXPO_PUBLIC_API_URL to the Mac's LAN IP, and make sure backend CORS does not block native requests (native requests send no Origin header).

**Why S:** These are small script changes and env setup.


## App icons, release screenshots and store media  ·  complexity S

**Where:** apps/frontend/src/app/icon.png (1254x1254), apps/frontend/src/app/apple-icon.png (180x180), docs/release-screens/bugfixes-batch-1/01..08 *.png (390x844, commit 4ccc9c8)

**Behaviour**

Next's file-based icons: icon.png at 1254 px square is the only high-res source and is below the 1024 minimum for an iOS app icon only if cropped, so it is usable. The 8 release screenshots (stats filter icons, stats radar, themes list, review list icons, play sticky CTA, theme picker, profile activity, dashboard streak) show an OLDER emerald/green design and a 6-tab bottom bar (Головна, Гра, Рев'ю, Топ, Статс, Налашт.), not the current 'Ember on stone' look. They show tab structure and layout intent only, not current visuals.

**State & persistence:** None.

**Motion & sound:** None.

**Mobile mapping:** Make the app.json icon a 1024x1024 opaque PNG with no alpha for iOS, plus an Android adaptive icon (foreground and background layers) and a monochrome icon for Android 13+ themed icons. Configure the splash with expo-splash-screen using the stone background #1d1b20 (themeColor). Produce new store screenshots from the native build with Maestro.

**Why S:** This is asset preparation only, though new adaptive and monochrome artwork is needed.


## Share & invite (NEW, no web equivalent)  ·  complexity M

**Where:** profile/[nickname], friends, session summary in play/[id]

**Behaviour**

The web has no share or copy-link feature anywhere (no navigator.share or clipboard calls). Friends are found only through UserSearch by nickname.

**API**

- `GET /api/users/search (existing)`
- `GET /api/users/:nickname/profile (existing; exact path per backend inventory)`

**State & persistence:** None.

**Motion & sound:** Pair with a success haptic on share completion.

**Mobile mapping:** Add Share.share / expo-sharing with universal links to /profile/:nickname (friend invite) and an optional rendered summary image (react-native-view-shot) for session results. Depends on the deep-link feature.

**Why M:** The share call is simple. The value depends on universal links working and on an image render for the summary.


## Shared-logic candidates

- `apps/frontend/src/lib/pending-puzzle.ts` — FirstPuzzlePayload, stashFirstPuzzle, takeFirstPuzzle — blockers: None (plain module-level Map). On mobile, consider backing it with MMKV so the first puzzle survives a cold start or resume.
- `apps/frontend/src/lib/api.ts` — assetUrl, http.get/post/patch/del, api<T> — blockers: Reads process.env.NEXT_PUBLIC_API_URL and window.location; token in localStorage; window.location.replace on 401. Extract it as createApi({baseUrl, getToken, onUnauthorized}) and share the request and error-message logic.
- `apps/frontend/src/app/(app)/play/[id]/page.tsx (CountTo easing math)` — cubic ease-out 1-(1-k)^3, 350 ms delay / 900 ms duration constants — blockers: Inline in a page component. Lift the constants into a motion-tokens module shared with mobile.
- `apps/backend/src/scripts/seed-test-sessions.ts` — dev seeding script — blockers: Hardcoded nickname 'lazynightowl'. Not wired to an npm script.

## Haptics opportunities

- Session auto-paused on app background, and resume tap: medium impact
- Solution stepping by swipe in the puzzle viewer: selection tick per ply
- CountTo summary counters: optional selection ticks while counting, with a success notification when the final value lands
- Back-swipe or hardware back blocked on the runner, and the exit sheet appearing: warning notification
- Share completed (profile invite or session card): success notification
- Offline banner appearing during a session: warning notification

## Push opportunities

- 'You have an unfinished session' a few minutes after the app is backgrounded mid-session (local notification scheduled on background, cancelled on resume)
- Streak-about-to-break reminder in the user's evening. This needs a server-known IANA timezone (not stored today) or a device-scheduled local notification
- Deep-link targets for every push must come from the route map: /profile/:nickname (friend request or accepted), /friends, /review?theme=<slug> (mistakes to review), /sessions/:id (session result), /play

## Risks

- The session timer is wall-clock based with no visibility handling. Ported naively, every app background longer than the remaining time ends the session on return, and a reload or cold start restarts the timer at full duration with a new puzzle (play/[id]/page.tsx applyNextResponse sets endsAt = now + durationSec).
- Orphaned sessions (endedAt null) are never closed server-side. Mobile app kills will create many more. Rating, streak and achievement rules run only in finish(), so abandoned sessions silently skip progression and calibration.
- The runner uses a 250 ms setInterval that calls setNow and re-renders the whole 1272-line page 4 times a second. Ported to RN as is, this works against the 60/120 fps goal. Drive the clock from a ref or shared value instead.
- There is no offline handling or request timeout. Mid-session /attempt calls on a flaky mobile network will throw and may desync the server's rating with the client.
- The docs/release-screens screenshots show an outdated green design. Anyone using them as a visual reference for the port will build the wrong look; the current design is 'Ember on stone' in globals.css.
- The repo root holds .claude-test-account (credentials file, not read) and .env. Make sure no mobile build step or EAS upload bundles the repo root (configure .easignore).
- Universal links and password autofill credential sharing both need apple-app-site-association / assetlinks.json served from the production domain via deploy/nginx.conf. Nobody has scoped this yet.
- The chessboard has zero accessibility labels. A screen-reader user cannot play, and this is easy to forget in a gesture-heavy rewrite.

## Open questions

- When the app is backgrounded mid-session, should the session auto-pause (the web pause() exists) or keep running like the web does today? Which is fair for the rating rules?
- Should the backend auto-finish (save) or auto-discard stale unfinished sessions, and after what grace period? Does an auto-finished early exit apply the 'early exit' rating rules?
- Is there a production domain the owner controls for universal links and AASA, and will the web stay up (even read-only) so shared links still resolve for people without the app?
- Does the 'Other' custom-duration input on /play enforce min and max bounds? This was not verified here; check play/page.tsx around line 415.
- Should the landing page (and its i18n in landingI18n.tsx) be kept as a marketing website after the web app is retired, or dropped entirely?
- Should the hardcoded nickname 'lazynightowl' in seed-test-sessions.ts become a parameter, and is that a real user on production?
