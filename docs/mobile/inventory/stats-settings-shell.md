# Inventory: stats-settings-shell

_Analytics/stats, settings (incl. sound), onboarding, auth (login/register/change-password), admin, app shell (root+app layouts, nav, providers, store, api client, i18n, toast, utils) — frontend + backend analytics/admin/auth modules_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Stats screen shell (analytics/page.tsx): Stats|Achievements tabs + style filter + data orchestration  ·  complexity L

**Where:** AnalyticsPage, StatsTab, Segmented style filter (All/rapid/blitz/bullet with StyleIcon 16px), Lifetime grid (4 Cards), Recommended focus Card, AchievementsGrid (other area)

**Behaviour**

Header 'stats.title' (22px eos-bone). Local tab state 'stats'|'achievements' (pill switcher: h-9 px-3, active bg-eos-rise; not persisted). Achievements tab renders <AchievementsGrid/> (not in this area). Stats tab: style filter 'all'|TrainingStyle (TRAINING_STYLES order rapid,blitz,bullet; labels t('style.<s>.name')), not persisted, resets on unmount. Sections in order: Activity heatmap card (52 weeks, hint stats.activity_hint) -> Rating history card (highlightStyle = filter unless 'all') -> Lifetime grid (only if overview.data.lifetime): Solved (toLocaleString) + 'N attempts' subline if attempts>0; Accuracy = round(acc*100)% or '—' when attempts==0; Sessions; Peak rating or '—' when 0 (grid 2 cols mobile / 4 cols sm+) -> Recommended focus card only when rec.data.theme non-null: themeLabel(theme, lang) + rec.data.reason (backend English string, NOT localized) -> Themes profile card: RadarChart size 340 if radarData.length>=3 else 'stats.no_data' -> ThemesList. Derivations (useMemo): ratingPoints = timeline filtered by isTrainingStyle mapped {endedAt, style, rating: peakRating}; heatmapData = timeline bucketed by formatLocalDate(new Date(endedAt)) (local TZ!) -> [{date,count}]; radarData = themes with rating>0 && !isMetaTheme, sorted by attempts desc, top 8, re-sorted alphabetically by slug, mapped {label: themeLabel(slug, lang), value: rating}; radarBounds: none -> {1200,2000}; else lo=floor(min/100)*100, hi=ceil(max/100)*100, min=max(600, lo-100), max=hi+100. NOTE timeline query is NOT filtered by style (always all styles, days=365); heatmap therefore ignores the filter; rating chart dims non-selected styles instead. overview.recentSessions and allTimePeak are fetched but unused here. No loading/error UI: sections simply absent until data (keepPreviousData keeps prior filter's data visible during refetch).

**API**

- `GET /api/analytics[?style=bullet|blitz|rapid] -> {recentSessions[20], allTimePeak, lifetime{solved,attempts,accuracy,peakRating,sessions}}`
- `GET /api/analytics/themes[?style=] -> ThemeRow[] {slug,attempts,failures,avgResponseMs,failureRate,weakness,rating}`
- `GET /api/analytics/recommendations[?style=] -> {theme|null, reason}`
- `GET /api/analytics/timeline?days=365 (server clamps 1..730, default 365; optional style) -> [{id,endedAt,style,startRating,peakRating,solved,durationSec}] ordered endedAt asc`

**State & persistence:** react-query keys: ['analytics', filter], ['analytics-themes', filter], ['analytics-rec', filter], ['analytics-timeline']. Global defaults staleTime 30s, keepPreviousData, retry 1. Language from useAppStore settings.language. Tab/filter are component state only.

**Web-only deps:** Tailwind classes / CSS shadows (inset shadows not supported on RN — use borders/gradients or react-native-shadow-2 / Skia); Number.prototype.toLocaleString (Hermes supports Intl.NumberFormat on modern RN; verify); lucide-react icons -> lucide-react-native; grid-cols layout -> flexbox rows

**Motion & sound:** Only transition-colors (Tailwind default 150ms) on tab buttons. No sounds. Mobile opportunity: animated sliding pill indicator for the Stats/Achievements switch and filter (Reanimated withTiming ~200ms), number count-up on lifetime cards.

**Mobile mapping:** Expo Router tab screen 'stats' with a top segmented control (custom Reanimated pill or react-native-pager-view for swipeable Stats|Achievements pages). Use FlashList/ScrollView with sections; RefreshControl invalidates the 4 queries. Filter as horizontally scrollable chips with Haptics.selectionAsync on change. Keep react-query (works in RN) + same keys. Move derivation functions to a shared package. Localize recommendation reason client-side from numeric fields (weakness, failureRate, avgResponseMs) instead of the server string.

**Why L:** Screen itself is simple, but it composes three custom SVG charts plus the achievements grid; total effort dominated by chart ports and touch interaction design.


## ActivityHeatmap (GitHub-style 7x52 grid)  ·  complexity M

**Where:** ActivityHeatmap, buildGrid, levelFor, levelClass, formatTooltip, pluralizeUk, DAY_LABELS/MONTH_LABELS (en/uk inline)

**Behaviour**

Rows Mon..Sun (Mon at top), columns = weeks ending with the current week (Monday-of-current-week computed locally; future days of the current week rendered as empty/transparent). Cell 11x11px, gap 3px, rounded-sm. Intensity buckets are ABSOLUTE: 0 ->0, 1 ->1, 2-3 ->2, 4-7 ->3, 8+ ->4. Colours: level0 white/4% fill + white/4% border; level1..3 = accent (#a64241 ember) mixed at 22%/45%/70% with transparent; level4 = solid accent. Day labels only Mon/Wed/Fri (en) / Пн/Ср/Пт (uk), 9px zinc-500. Month labels above the first column whose first non-null day has date<=7 and month changed (en/uk 3-letter arrays). Horizontal scroller auto-scrolls to the far right (scrollLeft=scrollWidth) after every grid rebuild so the latest week is visible on narrow screens; on md+ it centers with no scroll. Hover (mouseenter) sets a readout under the grid: 'YYYY-MM-DD — N session(s)' / uk 'N сесія/сесії/сесій' / 'no sessions' / 'без сесій'; title+aria-label tooltip. Legend 'Less [5 swatches] More' (uk Менше/Більше) hardcoded, not from i18n dict. Touch: hover doesn't fire on touch, so the readout effectively never updates on phones.

**API**

- `(data from GET /api/analytics/timeline?days=365 via parent)`

**State & persistence:** Local useState hover {date,count}; useRef scroller. No persistence.

**Web-only deps:** CSS grid with gridAutoFlow column; color-mix(in srgb, var(--accent) N%, transparent) — not available in RN; precompute rgba(166,66,65,0.22/0.45/0.70/1); onMouseEnter/onMouseLeave, title attribute; element.scrollLeft

**Motion & sound:** transition-colors on cells (150ms). No sound.

**Mobile mapping:** Render as a single react-native-svg (or @shopify/react-native-skia Canvas for 364 rects at 60fps) inside a horizontal ScrollView; onContentSizeChange -> scrollToEnd({animated:false}). Replace hover with press-and-drag scrub via react-native-gesture-handler Pan/LongPress on the canvas: compute cell from x/y, show a floating tooltip, fire Haptics.selectionAsync when the scrubbed cell changes. Keep buildGrid/levelFor/formatTooltip/pluralizeUk verbatim in shared code. Move legend/tooltip strings into i18n dict.

**Why M:** Pure grid math is portable as-is; work is in the RN rendering (Skia/SVG) and inventing a touch scrub interaction with haptics.


## RatingHistoryChart (per-style smoothed line+area chart)  ·  complexity M

**Where:** RatingHistoryChart, smoothPath (cardinal spline tension 0.5, /6), niceStep (NICE_STEPS [25,50,100,200,250,500,1000]), STYLE_HEX, STYLE_ORDER

**Behaviour**

Input points {endedAt, style, rating(=peakRating)}. Empty -> text 'Not enough sessions yet' / 'Поки мало сесій для графіка' (hardcoded, not in dict). X axis is ORDINAL over all sessions sorted by endedAt (gaps in time not shown); each style's points placed at their global index (key `${style}-${endedAt}-${rating}` — collisions possible if identical). Y range: step=niceStep((hi-lo)/4); yMin=floor(lo/step)*step - step/2; yMax=ceil(hi/step)*step + step/2; grid stops at multiples of step; empty default 1100..1500. Virtual canvas W=1000, H=height(220), padR 12, padT 10, padB 14, preserveAspectRatio=none; Y labels are an HTML overlay in a 44px left column (11px zinc-300 tabular). Styles drawn in order rapid, blitz, bullet; colours bullet #928e94 (graphite), blitz #a64241 (ember), rapid #afc0a9 (sage); area fill linearGradient stopOpacity 0.28 -> 0; stroke 2.2 round; vertex circles r=3 only when a style has <=60 points (stroke rgba(17,15,17,0.4)). highlightStyle dims other styles to opacity 0.18 (legend 0.5). Legend: swatch 16x3, style id UPPERCASE (raw English id, not localized) + last rating. Grid lines rgba(255,255,254,0.05). No interaction/tooltip.

**API**

- `(data from GET /api/analytics/timeline via parent)`

**State & persistence:** None (pure memoized derivations).

**Web-only deps:** SVG preserveAspectRatio='none' + absolutely-positioned HTML label overlay with CSS transform translateY(-50%); linearGradient defs (react-native-svg supports); Tailwind/STYLE_COLORS classes

**Motion & sound:** Legend transition-opacity (150ms) on dim. No draw-in animation. Mobile opportunity: path draw-in on mount (Skia path trim / Reanimated strokeDashoffset ~600ms ease-out), animated opacity when filter changes.

**Mobile mapping:** Measure width via onLayout and compute real pixel coordinates (drop the non-uniform viewBox trick; labels can then live inside the SVG/Skia canvas). Use react-native-svg or Skia Path (Skia recommended for gesture-driven scrubbing at 120fps). Add a pan-to-scrub crosshair showing session date + rating with Haptics.selectionAsync per point (new UX). smoothPath/niceStep/y-range logic shared verbatim.

**Why M:** Math is pure and portable; layout must be reworked for onLayout pixels and the label overlay; optional scrub gesture adds work.


## RadarChart (themes profile)  ·  complexity S

**Where:** RadarChart, wrapLabel

**Behaviour**

N spokes (3..8 from parent), angle starts at -90deg. r = size/2 - 44; viewBox expanded 40px each side horizontally. 5 rings (polygons) stroke rgba(255,255,254,0.08); spokes rgba(255,255,254,0.06); ring value labels at cx+4 (10px zinc-500) = round(min + (max-min)*f). Polygon fill var(--accent-soft) (= accent 18% => rgba(166,66,65,0.18)), stroke var(--accent) width 2 round join; vertex dots r 3.2. Axis labels at 1.14*r, anchor end/start/middle by side, 11px zinc-300; wrapLabel splits labels >12 chars at the most balanced word boundary into 2 lines (lineH 12). n==0 -> '—'.

**API**

- `(data from GET /api/analytics/themes via parent)`

**State & persistence:** None.

**Web-only deps:** CSS var colours in SVG attributes; className fill-zinc-* on <text>; dominantBaseline style

**Motion & sound:** None. Opportunity: polygon morph between style filters (Reanimated interpolate per vertex, ~300ms).

**Mobile mapping:** Straight port to react-native-svg (Path, Line, Circle, Text/TSpan) with hex colours from a theme tokens module; alignmentBaseline instead of dominantBaseline. Optionally tap a vertex to show theme stats + light haptic.

**Why S:** Self-contained SVG with pure geometry; react-native-svg has equivalent primitives.


## Themes list (weakest / strongest / all)  ·  complexity S

**Where:** ThemesList, ThemeRowCard, themeIcon (lib/theme-icons, other area), themeLabel/isMetaTheme (lib/theme-labels)

**Behaviour**

Excludes meta themes. Sub-tabs (h-8 pill): weakest = sort weakness desc top 20 (default); strongest = attempts>0, sort weakness asc top 20; all = sort weakness desc, no limit. Row: 40px icon tile tinted by weakness w (clamped 0..1): w>=0.66 rose (bar rgba(166,66,65,0.8)), >=0.33 amber (bar #a78a64 / text-amber-300), else sage (bar rgba(148,165,142,0.8)); title = themeLabel; subline '<attempts> · <failureRate%>% fail · <avg s>' ('fail' hardcoded English); right: rating (if >0) + 80x8 bar width = w*100%. Backend only returns themes with >=3 attempts. Empty -> stats.no_data.

**API**

- `(GET /api/analytics/themes via parent)`

**State & persistence:** Local sub-tab state, default 'weakest'.

**Web-only deps:** Tailwind; lucide icons via themeIcon

**Motion & sound:** transition-colors on tab buttons only. Opportunity: animate bar widths in (Reanimated withTiming 400ms) and layout transitions when switching tabs (Reanimated LinearTransition).

**Mobile mapping:** FlashList (all-themes tab can be long, ~60+ slugs) with fixed item height; tap row could deep-link to theme drill/review (currently no tap action). Selection haptic on sub-tab change.

**Why S:** Plain list with sorting; logic shareable.


## Settings › Profile tab (profile edit, avatar, change password, logout)  ·  complexity M

**Where:** SettingsPage, TabBar (profile|gameplay|app, underline 2px ember), ProfileTab, LabeledInput, LabeledTextarea, ChangePasswordSection, PasswordField, Avatar (other), AvatarPickerButton (components/AvatarCropper, not read)

**Behaviour**

Settings tab state local (default 'profile', not persisted); header shows 'settings.saving' while a settings PATCH is in flight. Profile: avatar 72px + displayName||nickname + @nickname + AvatarPickerButton -> upload dataUrl -> patchUser({avatarUrl}). Fields commit ON BLUR only if changed: displayName (max 40, placeholder nickname), bio (textarea 3 rows, max 280, no resize), country (max 2, uppercase display, placeholder 'UA'; server lowercases, empty string -> null). Character counters 'n/max'. Errors shown in rose; 'Saving…' line. Change password: collapsed button (btn-slate) -> expanded form with 3 PasswordFields (eye toggle, first autoFocus), rule hint line; valid = current non-empty, new >=8, has letter, has digit, new===repeat, new!==current. Success -> 'profile.password_changed', fields cleared, auto-collapse after 1800 ms. Logout: setToken(null), setUser(null), router.replace('/login') — does NOT clear react-query cache, settings cache or sound prefs.

**API**

- `PATCH /api/users/me/profile {displayName?, bio?, country?} -> updated user (DTO: displayName<=40, bio<=280, country /^([a-z]{2})?$/i)`
- `POST /api/users/me/avatar {dataUrl: data:image/(png|jpeg|webp);base64,...} -> {avatarUrl}`
- `POST /api/auth/change-password {currentPassword, newPassword} -> {ok:true}; 401 'current password is incorrect' (NOTE: api.ts treats any 401 with a token as session expiry and hard-redirects to /login, so a wrong current password logs the user out)`
- `400 'new password must differ from the current one'`

**State & persistence:** useAppStore.user (patchUser, setUser). Local form state. Token in localStorage 'taktic.token'.

**Web-only deps:** onBlur commit semantics; input type=password toggle; autoFocus; next/navigation useRouter; AvatarCropper (likely canvas/DOM based — not read); localStorage via setToken

**Motion & sound:** Toggle-like transitions only (transition-colors). Opportunity: LayoutAnimation/Reanimated height expand for the password form; success haptic.

**Mobile mapping:** Native form screen with KeyboardAvoidingView / react-native-keyboard-controller; commit on onEndEditing or explicit Save in header (blur is unreliable on mobile). TextInput secureTextEntry + textContentType 'password'/'newPassword' + autoComplete for iOS keychain/Android autofill. Avatar: expo-image-picker (allowsEditing, aspect 1:1, quality ~0.8, base64) or expo-image-manipulator to resize before upload; consider multipart upload instead of base64 JSON. Logout: clear SecureStore token, queryClient.clear(), reset zustand stores, unregister push token, router.replace('/(auth)/login'). Haptics.notificationAsync(Success) on password change, Error on failure.

**Why M:** Forms are simple, but avatar pick/crop/upload and the 401-on-wrong-password bug need native rework.


## Settings › Gameplay tab (every UserSettings field documented)  ·  complexity M

**Where:** GameplayTab, PieceSetPicker, ToggleRow, Toggle (h-7 w-12, knob 24px, translate 20px, 200ms ease-out), Segmented (carved well, active ember plate, intentionally no transition)

**Behaviour**

Every control calls patch(p): optimistic setSettings(p) then PATCH /users/me/settings; response.achievementsUnlocked[] each pushes an 'achievement' toast (title achv.<slug>.name, desc achv.<slug>.desc). No rollback or error UI on failure (exception escapes the async fn). Controls: Pieces (PieceSetPicker radio grid 2 cols: APP_PIECE_SETS ['classic','ember'], preview of wK wN bQ bP on /design/board/tile-light|dark.jpg tiles, active outline 2px #a64241); Focus mode toggle; Sound toggle (+ SoundSettings when enabled); Piece animation segmented instant|fast|normal|slow; Play side segmented auto|white|black; Knight arrow segmented bent|straight; Show daily streak toggle; Mirror view toggle. FIELD INVENTORY (client store type UserSettings / client default / DB default in prisma UserSetting / server validation / effect): focusMode bool false/false — play/[id] adds body.focus-mode and calls document.documentElement.requestFullscreen() (exit on unmount). accentColor string '#c72a2f'/'#22c55e' IsHexColor — IGNORED: setSettings strips any --accent inline override; accent fixed to ember #a64241; no UI. boardTheme string 'stone'/'blue' — no UI; passed to Chessboard theme in play/review/puzzles pages. pieceSet string 'classic'/'maestro' — normalizePieceSet maps anything not classic|ember to classic; used by Chessboard, BoardThumbnail, TurnCard, review/puzzle pages. soundEnabled bool true/true — gate in lib/sound.ts sfx() (unless force) and legacy playSound calls. soundPack 'wood'/'wood' — no UI; legacy playSound(settings.soundPack, ...) in puzzles/review pages. language 'en'|'uk' 'en'/'en' IsIn — i18n + persisted to localStorage 'taktic.lang'. fixedColor auto|white|black 'auto'/'auto' — play/[id] side selection & sessions review. animationSpeed instant|fast|normal|slow 'normal'/'normal' — ANIMATION_MS {instant 0, fast 160, normal 280, slow 460} for board piece moves. knightArrow bent|straight 'bent'/'bent' — components/board/Arrows.tsx right-click annotation arrows. showStreak bool true/true — StreakBadge on dashboard/leaderboard/profile (server still tracks). mirrorView bool false/false — flips board visually in play/review/puzzles/session review. onboardingCompleted bool false/false — gates OnboardingModal. reviewAutoAdvance bool (DB default false, DTO accepted) — NOT in client UserSettings type and no frontend consumer found (dead/unused feature flag; arrives in /users/me settings blob and is cached). Also server returns userId in settings object (spread into store).

**API**

- `PATCH /api/users/me/settings (UpdateSettingsDto, all optional) -> {...UserSetting, achievementsUnlocked: string[]} (achievements.evaluate awaited, errors swallowed to [])`

**State & persistence:** useAppStore.settings (zustand) mirrored on every setSettings into localStorage 'taktic.settings' (full JSON) and 'taktic.lang' when language changes. Server is source of truth, reloaded on app mount via /users/me.

**Web-only deps:** document.documentElement.style.removeProperty('--accent'/'--accent-contrast') in setSettings; localStorage; Fullscreen API for focusMode; <img> piece previews with CSS transform/transformOrigin (pieceTransform); CSS background-image tiles; right-click arrows (knightArrow) — mouse-only concept

**Motion & sound:** Toggle knob/track 200ms ease-out; Segmented switches instantly by design (no half-lit frames). Opportunity: haptic on every toggle/segment change.

**Mobile mapping:** Grouped native settings list (iOS-style sections) — e.g. custom rows with Switch (RN Switch tinted #a64241 or custom Reanimated toggle 200ms) and segmented control (@react-native-segmented-control/segmented-control for native feel, or custom). Haptics.selectionAsync on segment, impactAsync(Light) on toggle. Persist settings with react-native-mmkv (synchronous, so first paint has user settings — replaces the localStorage layout-effect hydration). focusMode -> expo-status-bar hidden + expo-navigation-bar immersive on Android + expo-keep-awake during sessions. knightArrow: only meaningful if mobile gets long-press-drag arrows; otherwise hide. Add new mobile-only settings: haptics on/off, notifications (daily reminder time, streak alerts), maybe reduce-motion. Expo Image for piece previews (expo-image with SVG/PNG).

**Why M:** Many small controls plus a settings-sync layer, achievement toasts, and replacement of DOM side effects (fullscreen, CSS vars).


## Sound settings (volume + per-event variant picker with preview)  ·  complexity M

**Where:** SoundSettings, SOUND_CATALOG / SOUND_EVENT_ORDER (lib/sound/catalog, not read), sfx / stopLongClip / useSoundPrefs (lib/sound.ts, not fully read)

**Behaviour**

Shown only when soundEnabled. Volume range 0..100 (stored 0..1) with % readout, accent #a64241. List of events in SOUND_EVENT_ORDER — i18n keys sound.ev.{move,capture,check,castle,promote,correct,mistake,gate,rankTomoe,rankMangekyo,rankFinal,rankDown} (12 events). If an event has >1 variant: <select> (label name + ' ·  shinobi' suffix for shinobi variants); on change pick(ev,id), stopLongClip(0), sfx(ev,{variant,force:true}) preview. Else static name. ▶ button: stopLongClip(0) + sfx(ev,{force:true}). Preview bypasses soundEnabled via force.

**State & persistence:** useSoundPrefs zustand store {volume, picks, setVolume, pick} persisted in localStorage 'taktic.soundPrefs' (lib/sound.ts PREFS_KEY) — device-local, NOT synced to server.

**Web-only deps:** <input type=range>; <select>/<option>; Web Audio playback in lib/sound.ts (per recent commit: Web Audio short clips, trimmed silence, loudness levelled)

**Motion & sound:** Plays sound previews. No animation.

**Mobile mapping:** @react-native-community/slider (or Reanimated custom slider with haptic ticks at 0/50/100) for volume; variant choice via native ActionSheet / bottom sheet (@gorhom/bottom-sheet) or inline radio list; preview via expo-audio (or react-native-audio-api for low-latency Web-Audio-like API). Preload short clips into memory for <20ms latency. Persist prefs in MMKV; consider syncing to server. Pair each sound event with a haptic pattern (move=light, capture=medium, check=rigid, correct=success, mistake=error, rank up=heavy sequence).

**Why M:** UI is small but depends on porting the whole Web Audio engine (other area) to a native low-latency audio library.


## Settings › App tab (language, install card, replay onboarding, reset progress)  ·  complexity S

**Where:** AppTab, ResetProgressSection

**Behaviour**

Language segmented English / Українська -> patch({language}) (achievement 'set-language' may toast). Install card: static PWA 'Add to Home Screen' instructions (obsolete in native). Replay onboarding: patch({onboardingCompleted:false}) -> modal reappears immediately (global OnboardingModal). Reset progress (danger card, rose tints rgba(166,66,65,…)): two-step confirm inline (no modal): Cancel / 'Yes, reset' -> POST /users/me/reset-progress -> GET /users/me -> setProgressions -> router.push('/dashboard'); error shown inline. Does not invalidate react-query caches (analytics/sessions remain stale up to 30s/until refetch) nor reset streak (server resetProgress doesn't touch streak fields).

**API**

- `POST /api/users/me/reset-progress -> {ok:true} (transaction: delete attempts, sessions, puzzle history, review items; style progressions -> 1200/1200/1200, weakSessionStreak 0, calibrationSessionsLeft 5; legacy progression -> 1200)`
- `GET /api/users/me`

**State & persistence:** settings via store; progressions via setProgressions.

**Web-only deps:** next/navigation router.push

**Motion & sound:** None; transition-colors on buttons.

**Mobile mapping:** Replace install card with Notifications section (permission state, reminder toggle/time) and Haptics toggle. Reset progress: native Alert.alert destructive confirm (or bottom sheet) + Haptics.notificationAsync(Warning); after success queryClient.invalidateQueries() / clear. Language: could default from expo-localization on first launch.

**Why S:** Few simple actions; just needs cache invalidation fix and native confirm.


## Onboarding welcome modal (5 slides)  ·  complexity S

**Where:** OnboardingModal (mounted globally in root layout)

**Behaviour**

Shows when user && settingsReady && !settings.onboardingCompleted (and after client mount). Full-screen overlay z-80, bg black/85 + backdrop-blur-md, centered glass card max-w-md rounded-3xl. Slides (icon 28px in 64px tile): welcome (Sparkles amber-300), styles (Layers accent), calibration (Compass amber), streak (Flame amber), start (Swords accent); keys onboarding.<id>.title/body. Dots: active w-6 accent, others w-1.5 white/15, transition-all (150ms). Controls: X (top-right) and 'Skip' -> persistDone; Back (hidden on first); Next; on last 'Let's go' -> persistDone + router.push('/play'). persistDone: optimistic setSettings({onboardingCompleted:true}) then PATCH; failure ignored. No swipe, no keyboard nav, no slide animation (content swaps instantly). Note: the 'start' body text tells users to replay from 'Settings → App' (uk says 'Налаштуваннях → Програма' while the tab label is 'Додаток' — copy mismatch).

**API**

- `PATCH /api/users/me/settings {onboardingCompleted:true}`

**State & persistence:** Local step index; gate flag in store + server (migration backfilled true for users with history).

**Web-only deps:** react-dom createPortal(document.body); backdrop-filter blur; next/navigation

**Motion & sound:** Only dot width transition. Mobile opportunity: horizontally swipeable pager with parallax icons, animated dot width interpolated from scroll offset, spring on CTA.

**Mobile mapping:** Full-screen modal route (expo-router presentation 'fullScreenModal') or root-level overlay; react-native-pager-view or Reanimated FlatList pagingEnabled for swipe; dots driven by useAnimatedScrollHandler; expo-blur BlurView for backdrop. Haptics.selectionAsync per page change, impact on 'Let's go'. Final step could request push-notification permission (natural place to pitch streak reminders).

**Why S:** Static content; swipe pager is a well-known pattern.


## Login screen  ·  complexity S

**Where:** LoginPage, Input, PasswordInput (ui, not read), Logo (brand, not read)

**Behaviour**

Logo 128 glow, 'tac·tic·tak' 30px, subtitle auth.login. Fields: nickname (autoComplete username, autoCapitalize none, autocorrect off, spellcheck off), password (current-password). Submit -> POST /auth/login -> setToken, setUser(r.user) -> GET /users/me to hydrate user (incl verified, isAdmin), settings, progressions (failure non-fatal; streak NOT set here, unlike Providers) -> router.replace('/dashboard'). Error shows server message raw ('invalid credentials', English only). Button label toggles auth.logging_in. Link to /register.

**API**

- `POST /api/auth/login {nickname, password} -> {token, user{id,nickname}}; 401 'invalid credentials'`
- `GET /api/users/me -> {id,nickname,displayName,avatarUrl,bio,country,createdAt,verified,isAdmin,settings,progression(legacy),progressions{bullet,blitz,rapid},streak{days,freezes,lastDay,freezeRegenAt}}`

**State & persistence:** Token localStorage 'taktic.token'; user/settings/progressions in zustand.

**Web-only deps:** form onSubmit; next/link; next/navigation; localStorage; min-h-dvh

**Motion & sound:** None.

**Mobile mapping:** (auth) stack in expo-router; TextInput with textContentType='username'/'password', returnKeyType next/go, onSubmitEditing chain; KeyboardAvoidingView; token in expo-secure-store; Haptics error on failure + shake animation (Reanimated withSequence). Map server error messages to i18n keys.

**Why S:** Two fields and one call; needs secure storage swap only.


## Register screen with live rule checklist  ·  complexity S

**Where:** RegisterPage, RuleList

**Behaviour**

Logo 96. Nickname (maxLength 20) rules: 3–20 chars; /^[A-Za-z0-9_-]+$/; no consecutive _ or - (/^(?!.*[-_]{2}).+$/). Password rules: >=8, has letter, has digit. Repeat must match. Rules list shown once field touched or non-empty (Check/X 11px, sage when met). Submit disabled until formValid; on submit marks all touched. POST /auth/register includes current UI language (from landing / taktic.lang). Then mirrors login: GET /users/me hydrate (comment: avoids leaking previous account's progressions in same app instance) -> replace('/dashboard'). Server errors raw ('nickname already taken', class-validator messages).

**API**

- `POST /api/auth/register {nickname, password, repeatPassword, language?} -> {token, user}; 400 'passwords do not match' | 'nickname already taken' | validation messages. Creates User + UserSetting(language) + legacy UserProgression + 3 UserStyleProgression rows.`

**State & persistence:** Same as login. setUser here omits verified/isAdmin.

**Web-only deps:** form; next/link; next/navigation

**Motion & sound:** None. Opportunity: rule rows animate check-in (scale/opacity 150ms) with a light haptic as each rule becomes met.

**Mobile mapping:** Same as login; keep the regex rules in a shared validation module also used by backend DTOs. Consider async nickname availability check (new endpoint) for nicer UX.

**Why S:** Simple validated form; logic shareable.


## Auth/session plumbing & bootstrap (api client, Providers, store)  ·  complexity M

**Where:** lib/api.ts (API_URL, API_HOST, assetUrl, getToken/setToken, api(), http.get/post/patch/del), lib/providers.tsx (QueryClient + /users/me bootstrap + settings cache hydration), lib/store.ts (useAppStore)

**Behaviour**

API_URL = NEXT_PUBLIC_API_URL ?? `${location.protocol}//${location.hostname}:4000/api` (LAN dev). assetUrl prefixes relative upload paths with API_HOST. api(): JSON headers + Bearer token; non-OK -> if 401 AND a token was sent -> handleSessionExpired (module-level once-guard, clears token, window.location.replace('/login')); error message = body.message (stringified if array) else statusText; 204 -> undefined. Providers: QueryClient {retry:1, refetchOnWindowFocus:false, placeholderData: keepPreviousData, staleTime: 30_000}. Layout-effect (before paint) reads 'taktic.settings' -> setSettings + settingsReady=true. Effect: no token -> apply 'taktic.lang' then settingsReady=true; with token -> GET /users/me -> setUser/settings/progressions/streak, finally settingsReady=true (also on error). Only runs on mount. App layout redirects to /login if no token (client-side only, after paint). Store: user, settings (DEFAULT_SETTINGS), progressions (DEFAULT_PROGRESSIONS: each style 1200/1200/1200, calibrationSessionsLeft 5, weakSessionStreak 0), streak (EMPTY_STREAK days 0, freezes 1), settingsReady; actions setUser, patchUser, setSettings (side-effects described), setProgressions, patchStyleProgression, setStreak. JWT: HS256 via JWT_SECRET (fallback 'dev-secret'), expiresIn JWT_EXPIRES_IN ?? '7d', payload {sub, nickname}; no refresh tokens; JwtStrategy trusts payload (nickname in token can go stale).

**API**

- `GET /api/users/me`
- `GET /api/auth/me (returns {id,nickname} from token; unused by frontend files read)`

**State & persistence:** localStorage keys in this area: 'taktic.token', 'taktic.settings', 'taktic.lang'; elsewhere 'taktic.soundPrefs', 'taktic.lastStyle', 'taktic.lastDurations' (play page). Zustand stores: useAppStore, useToastStore, useSoundPrefs.

**Web-only deps:** window.localStorage; window.location.replace (hard reload as state reset); process.env.NEXT_PUBLIC_*; useLayoutEffect pre-paint hydration trick; document.documentElement.style

**Motion & sound:** None.

**Mobile mapping:** createApiClient({baseUrl: process.env.EXPO_PUBLIC_API_URL, getToken, onUnauthorized}) in a shared package; token in expo-secure-store (async) with an in-memory cache loaded during splash (expo-splash-screen preventAutoHideAsync until token+MMKV settings ready). onUnauthorized -> clear token, queryClient.clear(), reset stores, router.replace to auth group (no hard reload exists in RN — explicit reset required). Settings cache in react-native-mmkv (sync) so no flash. Replace refetchOnWindowFocus with react-query focusManager wired to AppState + onlineManager wired to @react-native-community/netinfo. Expo Router protected groups: (auth) vs (app) decided in root _layout by token presence. Backend: add refresh-token or long-lived device sessions, plus device push-token registration endpoint.

**Why M:** Needs a platform-agnostic API client, secure storage, explicit state reset on logout/401, and splash-gated bootstrap; backend auth may need refresh tokens.


## App shell: navigation, focus routes, pull-to-refresh, rotate lock, fonts, theme  ·  complexity L

**Where:** app/layout.tsx (RootLayout), app/(app)/layout.tsx (AppLayout), Nav (desktop header, mobile top bar, mobile bottom tab bar), NavIcons (HomeIcon png, PlayIcon mask png, ReviewIcon mask svg 28x24, LeaderboardIcon Trophy 21, StatsIcon BarChart3 21, ShurikenIcon custom SVG 23), PullToRefresh, rotate-lock overlay

**Behaviour**

Tabs (6): /dashboard home, /play play, /review review, /leaderboard 'Board'/'Топ', /analytics stats, /settings (Shuriken). Active = pathname.startsWith(href). Mobile bottom bar fixed, bg eos-shade, top seam inset shadow, padding-bottom safe-area, each tab h-16, label 10px bold, active text eos-bone + 2px ember bar at top spanning middle 44% (left/right 28%); inactive eos-dust; Home png dimmed (opacity 50%, saturate .55) when inactive; lucide stroke 2 active / 1.8 inactive. Mobile top bar h-14: Logo 32 + 'tac·tic·tak' Cinzel 20px; right avatar 36 linking to /profile/<nickname> (placeholder circle until user loaded). Desktop header: logo 40, horizontal links, avatar+nickname, logout icon. Focus-mode routes (no chrome, full viewport): /play/<id>, /review/<x>, /sessions/<id>/review. Normal routes: Nav + PullToRefresh(onRefresh = queryClient.invalidateQueries() ALL) + main max-w-5xl px-4 py-4, pb-24 for tab bar. PullToRefresh: window touch listeners, only at scrollY 0, rubber dy*0.45 capped MAX 110px, TRIGGER 72px, arrow rotates 0..180deg with progress, spinner while refreshing, snap back 'transform 180ms ease'. Root: fonts Oswald (landing, latin+cyrillic), Cinzel (display/titles/numbers — latin + latin-ext ONLY, no cyrillic), Manrope (UI, cyrillic). html class 'dark'; themeColor #1d1b20; viewport no zoom, viewport-fit cover; PWA manifest/appleWebApp meta. Rotate lock: landscape && max-height 500px -> full-screen 'Please rotate your device' (bilingual hardcoded) hiding everything else. ToastContainer outside Providers; OnboardingModal inside. Design tokens (globals.css :root): --eos-ink #1d1b20 ground, --eos-shade #222025 bars, --eos-slate #29282d cards, --eos-rise #353339 pressed/chips, --eos-seam #413f46 borders, --eos-well #1a181c inputs/segment track, --eos-bone #e7e0d7 text, --eos-ash #a5a0a4 secondary, --eos-dust #736f74 faint, --eos-ember #a64241 accent, --eos-embers #592628 pressed tint, --eos-rose #d8847c negative, --eos-sage #afc0a9 positive, --eos-hl #3a6296 board highlight; --accent = ember, --accent-soft 18%, --accent-weak 8%, --accent-contrast #f5eee5; radius 'control' 6px.

**State & persistence:** Route-derived; user from store. No persistence.

**Web-only deps:** next/font/google; Next metadata/viewport/manifest; usePathname/useRouter/Link; CSS mask-image for tinted PNG/SVG icons; position:fixed + env(safe-area-inset-*); window touch events for pull-to-refresh; CSS media query orientation lock; backdrop/inset box-shadows

**Motion & sound:** Nav transition-colors (150ms), Home icon opacity/filter transition. Pull-to-refresh 180ms ease snap. Opportunity: animated tab indicator sliding between tabs (Reanimated shared value), tab press scale 0.92 spring, native stack push/pop transitions, shared-element transitions from dashboard cards into session screens.

**Mobile mapping:** Expo Router: root _layout (fonts via expo-font/@expo-google-fonts: Cinzel, Manrope, Oswald if needed; SplashScreen until fonts+auth ready; GestureHandlerRootView; QueryClientProvider; ToastHost), (auth) stack, (app)/(tabs) with custom tabBar component (BlurView or solid #222025, safe-area via react-native-safe-area-context, Haptics.selectionAsync on tab press), focus routes as stack screens outside the tabs group (presentation 'fullScreenModal' or card with gestureEnabled per screen; headerShown false; hide status bar). Tinted icons: export PNG masks as SVG (react-native-svg with fill currentColor) or Image with tintColor (works for monochrome PNGs). PullToRefresh -> ScrollView/FlashList RefreshControl (tintColor #a64241) per screen. Rotate lock -> app.json 'orientation': 'portrait' (or expo-screen-orientation lock). Theme tokens -> a TS tokens module (shareable) + NativeWind (if you want to keep Tailwind class names) or StyleSheet/Unistyles. StatusBar style light, background #1d1b20 in app.json (userInterfaceStyle dark, android navigationBar color). Desktop header dropped.

**Why L:** Defines the whole navigation architecture, providers, fonts, tokens, splash/bootstrap and the custom animated tab bar that every other feature sits in.


## Toast notifications (achievement / info)  ·  complexity S

**Where:** ToastContainer, ToastCard, useToastStore (lib/toast.ts), ACHIEVEMENT_ICON_MAP (components/achievements/icons, not read)

**Behaviour**

Store: toasts[] with id `${Date.now()}-${random4}`, push/dismiss/clear. Container fixed top-right (top-3 right-3 + safe-area-top), z-200, width min(360px, 100vw-1.5rem), stacked gap-2. Card: glass, rounded-2xl, border rgba(166,66,65,0.35); 40px icon tile gradient 160deg #b8524c -> #883536 with lucide icon by achievement slug (fallback Trophy) in #f5eee5; eyebrow 'Achievement' / 'Notice' (hardcoded English, 11px uppercase rose); title (truncate); description (2-line clamp); X dismiss. Auto-dismiss AUTO_DISMISS_MS = 4500. Entry: slideInRight 220ms ease-out (translateX 110% -> 0, opacity 0 -> 1). No exit animation. Pushed by settings page, play runner, friends, review pages, ProfileEditor, AchievementsGrid (consumers found via grep).

**State & persistence:** In-memory zustand only.

**Web-only deps:** CSS keyframes animation; position fixed; env(safe-area-inset-top); line-clamp

**Motion & sound:** 220ms ease-out slide-in from right; 4500ms lifetime. No sound.

**Mobile mapping:** Keep useToastStore verbatim; render a top-center banner host with Reanimated entering (SlideInUp / FadeInDown spring) and exiting animations, swipe-up/horizontal to dismiss (Gesture.Pan), safe-area aware; Haptics.notificationAsync(Success) on achievement toasts (optionally a celebratory sound). Alternatively use 'sonner-native' or 'burnt' (native iOS toasts) but custom gives brand styling. When app is backgrounded, achievement unlocks could arrive as push instead.

**Why S:** Store is reusable as-is; only the presentational host needs rebuilding.


## i18n (en/uk dictionaries, useT, useTn)  ·  complexity S

**Where:** lib/i18n.ts (en dict 376 keys, uk dict 377 keys), useT, useTn

**Behaviour**

Flat Record<string,string> per language. Only diff: en has 'review.puzzle_word.one/other'; uk has 'review.puzzle_word.one/few/many' (en-only 'review.puzzle_word.other'; uk-only '.few', '.many'). Namespaces: nav (home, play, review, stats, settings, leaderboard, logout, nav.friends), brand, auth.*, common.*, profile.*, leaderboard.*, friends.*, dashboard.*, play.*, calibration.*, style.*, levels.*, unlock.*, demote.*, review.*, puzzle.*, stats.*, streak.*, achv.* (incl 24 achievement name/desc pairs + categories), settings.*, sound.ev.* (12), rank.*, onboarding.*. useT(): reads settings.language from store; lookup dict[key] ?? en[key] ?? key. Placeholders like {floor}, {n}, {style} are substituted manually by callers via .replace (no interpolation helper in i18n.ts). useTn(): Intl.PluralRules(lang).select(count) -> `${key}.${form}` with fallbacks .other -> .many -> en form -> en .other -> key; creates a new PluralRules per render. Duplicate pluralizeUk exists inside ActivityHeatmap. Several strings are hardcoded outside the dicts (heatmap legend/tooltip, rating chart empty text, ThemeRowCard 'fail', toast eyebrows, rotate lock, admin page entirely English, aria labels, error fallbacks, backend error messages and recommendation reason).

**State & persistence:** Language in settings (server + 'taktic.lang' + 'taktic.settings').

**Web-only deps:** 'use client' directive (harmless); Intl.PluralRules (needs Hermes Intl — verify on target RN/Hermes version)

**Motion & sound:** None.

**Mobile mapping:** Move dictionaries to packages/shared/i18n/{en,uk}.ts verbatim; keep useT/useTn hooks (zustand works in RN). Add an interpolate(key, vars) helper. Initial language: stored setting, else expo-localization device locale ('uk' if languageCode==='uk'). Optionally adopt i18next/react-i18next later, but not required. Ensure Ukrainian display font: Cinzel has no Cyrillic — pick a Cyrillic-capable display face or fallback.

**Why S:** Pure data + tiny hooks; mostly a move into a shared package plus localizing the stray hardcoded strings.


## Admin dashboard (recommendation: keep on web, do not port in v1)  ·  complexity M

**Where:** AdminPage, ActivitySection, StatBox, ActivityChart (SVG 920x220 polyline chart), Legend, UsersSection, UserRow, Avatar (local initials fallback)

**Behaviour**

Client gate: once settingsReady, non-admin -> replace('/dashboard'); renders null until known. All copy hardcoded English. Activity: 4 stat boxes (Users total, Sessions today, DAU 7d unique, MAU 30d unique); 'Last 30 days' chart with 3 lines: sessions (accent), active users (#4acf9d), signups (#4dbcec dashed 3 3), y ticks step ceil(max/4), x labels every 5 days (MM-DD); 'Recently active (top 20)' 2-col grid linking to /profile/<nick> with 'N/7d' and relative time (just now / Xm / Xh / Xd / Xmo ago). Users: search input (resets offset), table grid columns [1.4fr 140 120 120 140 180] (desktop-only layout): user (avatar 32, displayName, 'admin' badge, ✓ verified, @nick link), joined (en-CA date), sessions, attempts, last active, actions: 'Password' toggles inline reset form (min 8 chars client check; keeps form open after success for copying), Delete (danger; disabled for self) with window.confirm and alert on failure; invalidates ['admin','users'] and ['admin','activity']. Pagination limit 25 with Prev/Next and 'Showing a–b of total'.

**API**

- `GET /api/admin/me -> {id,nickname,isAdmin:true} (unused by page)`
- `GET /api/admin/users?q=&limit=25&offset= (server: limit 1..100, default 50; search nickname/displayName case-insensitive contains; ordered createdAt desc) -> {total,limit,offset,users[{id,nickname,displayName,avatarUrl,country,createdAt,isAdmin,verified,sessionCount,attemptCount,lastSessionAt}]}`
- `DELETE /api/admin/users/:id -> {ok:true}; 403 on self; 404 missing (cascade delete)`
- `POST /api/admin/users/:id/password {password>=8} -> {ok, nickname}`
- `GET /api/admin/activity?days=30 (1..365) -> {days, totals{totalUsers,sessionsToday,dau7,mau30}, daily[{day,signups,sessions,activeUsers}], recent[20]}. AdminGuard = JWT + DB lookup of isAdmin on every request.`

**State & persistence:** react-query keys ['admin','activity',30], ['admin','users',q,offset,limit]; local search/offset/form state.

**Web-only deps:** window.confirm / window.alert; desktop CSS grid table; next/link; <img>

**Motion & sound:** hover backgrounds only.

**Mobile mapping:** Recommended: keep a minimal web admin (could be the existing Next app trimmed to /login + /admin, or a tiny separate admin SPA) since it is an operator tool, English-only, desktop table layout, used by one person. If a native version is desired later: an isAdmin-gated stack screen reachable from Settings, stat cards + victory-native/Skia line chart, FlashList of users with swipe actions (delete with Alert destructive confirm + warning haptic), bottom sheet for password reset. Push opportunity for admin: new signup notification.

**Why M:** If ported: chart + paginated searchable list + destructive actions with mobile-appropriate UX; if kept on web: S (only needs the web app to remain deployable).


## Backend analytics/admin/auth endpoint semantics relevant to mobile  ·  complexity M

**Where:** AnalyticsService.overview/themes/recommendations/timeline, AdminService, AuthService, UsersService.updateSettings/resetProgress/updateProfile/getProfile

**Behaviour**

Analytics: style filter accepted only if isTrainingStyle, otherwise all. overview: last 20 finished sessions + lifetime counts (attempts, correct attempts, max peakRating, finished session count). themes: raw SQL grouping attempts by theme slug with HAVING COUNT(*)>=3, rating = 90th percentile (PERCENTILE_CONT 0.9) of puzzleRating over CORRECT attempts (0 if none); weakness = 0.7*failureRate + 0.3*(avgMs / maxAvgMs across themes). recommendations: highest weakness theme, reason English text '…highest weakness score (N%): failure rate N%, avg Nms'; when none: theme null with reason 'play more sessions to get recommendations'. timeline: finished sessions in last N days (client buckets locally for TZ correctness). Public profile reuses themes() and timeline() via /users/by-nickname/:nickname/themes|timeline (no auth). Auth: nickname + password only (bcrypt cost 10), no email, no password reset flow except admin-set, no account self-deletion, no rate limiting visible in these files. Admin activity mixes server-local 'today' (setHours(0)) with Postgres date_trunc day buckets.

**API**

- `see other features`

**State & persistence:** Postgres via Prisma; UserSetting table one row per user.

**Motion & sound:** n/a

**Mobile mapping:** Backend changes needed for mobile: (1) push token table + POST/DELETE /users/me/devices (Expo push tokens), (2) notification preferences fields on UserSetting (e.g. remindersEnabled, reminderLocalTime, timezone, streakAlerts, friendAlerts), (3) scheduled job (Redis/BullMQ or Nest @Cron) for streak-at-risk reminders using stored TZ, (4) DELETE /users/me for App Store account-deletion requirement, (5) refresh tokens / longer sessions, (6) localized-or-structured recommendation reason, (7) optionally multipart avatar upload.

**Why M:** Existing endpoints work unchanged for mobile, but push/notification, account deletion and session-lifetime additions are new backend work.


## Shared-logic candidates

- `apps/frontend/src/lib/utils.ts` — fmtResponseTime, fmtDuration, formatLocalDate, streakState, type StreakState (pure). cn() is web/Tailwind-specific. — blockers: cn depends on clsx + tailwind-merge (only useful with NativeWind); split it out. Rest is verbatim-shareable.
- `apps/frontend/src/lib/i18n.ts` — en/uk dictionaries (376/377 keys), useT, useTn — blockers: 'use client' directive and import of useAppStore; extract dicts into packages/shared/i18n and keep hooks per app (or inject a language getter). Intl.PluralRules availability on Hermes must be verified.
- `apps/frontend/src/lib/store.ts` — types Language, ColorMode, AnimationSpeed, KnightArrowMode, UserSettings, Streak, AuthUser, Progression, Progressions; ANIMATION_MS; DEFAULT_SETTINGS/EMPTY_PROGRESSION/EMPTY_STREAK (not exported today); useAppStore — blockers: setSettings has DOM side effects (document.documentElement.style) and localStorage writes; refactor to inject a persistence adapter (MMKV on mobile). Imports SoundPack type from lib/sound (web audio module).
- `apps/frontend/src/lib/toast.ts` — useToastStore, Toast, ToastTone — blockers: None (pure zustand; 'use client' is harmless).
- `apps/frontend/src/lib/api.ts` — api, http (get/post/patch/del), assetUrl, API_URL/API_HOST, getToken/setToken — blockers: window.localStorage token, window.location redirect on 401, NEXT_PUBLIC env + window.location.hostname fallback. Refactor to createApiClient({baseUrl, getToken, onUnauthorized}) — fetch itself works in RN.
- `apps/frontend/src/components/charts/RatingHistoryChart.tsx` — smoothPath, niceStep, NICE_STEPS, STYLE_HEX, STYLE_ORDER, y-range/gridStops computation (currently inline in useMemo) — blockers: Pure functions are embedded in a React/SVG component; extract to charts/ratingHistory.math.ts.
- `apps/frontend/src/components/charts/ActivityHeatmap.tsx` — buildGrid, formatDate, levelFor, formatTooltip, pluralizeUk, DAY_LABELS, MONTH_LABELS, month-marker computation — blockers: Embedded in component; levelClass uses Tailwind + color-mix (replace with rgba token table).
- `apps/frontend/src/components/charts/RadarChart.tsx` — wrapLabel, radar geometry (toXY/spokePoint/rings) — blockers: Geometry inside useMemo of component; colour props default to CSS vars.
- `apps/frontend/src/app/(app)/analytics/page.tsx` — Overview/ThemeRow/Recommendation/TimelinePoint types; derivations ratingPoints, heatmapData, radarData, radarBounds, ThemesList sort/slice rules, weakness colour buckets (0.33/0.66) — blockers: Inline in components; extract to analytics selectors. Types should ideally come from a shared API-types package (or be generated from backend).
- `apps/frontend/src/app/register/page.tsx + apps/backend/src/auth/dto.ts` — NICK_RE /^[A-Za-z0-9_-]+$/, NICK_NO_DOUBLES_RE /^(?!.*[-_]{2}).+$/, length 3–20, password rules (>=8, letter, digit, max 128), change-password validity — blockers: Duplicated between frontend and backend DTO decorators; move constants to shared package and reference from both.
- `apps/frontend/src/app/(app)/admin/page.tsx` — relative(iso), fmtDate(iso), AdminUserRow/UsersResponse/ActivityResponse types — blockers: None for helpers (relative() is English-only).
- `apps/frontend/src/lib/levels.ts (partially seen)` — TrainingStyle, TRAINING_STYLES, isTrainingStyle, DEFAULT_STYLE, CALIBRATION_SESSIONS, UNLOCK_REWARD, etc. — blockers: Not fully read in this area; backend has its own isTrainingStyle in sessions/unlock — candidate for a single shared module.
- `apps/frontend/src/lib/pieces.ts (partially seen)` — APP_PIECE_SETS, normalizePieceSet, pieceUrl, pieceTransform — blockers: pieceUrl returns web public paths; mobile needs bundled asset requires/SVG components. normalizePieceSet is pure.

## Haptics opportunities

- Bottom tab press: Haptics.selectionAsync (plus scale spring on icon)
- Stats/Achievements switch, style filter chips, themes sub-tabs, settings tabs, every Segmented change: selectionAsync
- Settings toggles (focus, sound, streak, mirror): impactAsync(Light)
- Heatmap press-and-drag scrub: selectionAsync each time the scrubbed day changes; stronger tick on days with sessions
- Rating chart scrub crosshair: selectionAsync per session point
- Radar vertex tap: impactAsync(Light)
- Pull-to-refresh crossing the 72px trigger threshold: impactAsync(Medium); success when refresh completes
- Achievement toast appear: notificationAsync(Success) (pairs with achievementsUnlocked from PATCH settings and session finish)
- Login/register failure: notificationAsync(Error) + shake; success: Success
- Register rule checklist item turning green: light impact
- Change password success: Success; wrong current password: Error
- Reset progress confirm sheet open: notificationAsync(Warning); confirm: impactAsync(Heavy)
- Onboarding page swipe: selectionAsync; 'Let's go': impactAsync(Medium)
- Sound preview ▶ and volume slider ticks at 0/25/50/75/100: selectionAsync
- Admin destructive delete confirm (if ported): Warning

## Push opportunities

- Streak at risk: local-evening reminder when streakState === 'at_risk' (lastDay is yesterday) — needs user timezone + reminder time stored server-side, or schedule locally with expo-notifications on each app open/session finish (no backend needed for a local version)
- Streak freeze consumed / regenerated (Streak.freezes, freezeRegenAt) — 'Your freeze saved your 12-day streak' / 'Freeze recharged'
- Streak milestones and achievement unlocks earned while app is backgrounded (achievements evaluated server-side)
- Daily training reminder at user-chosen time (new setting fields: remindersEnabled, reminderTime, timezone)
- Weekly stats digest: sessions this week, rating delta, recommended focus theme from /analytics/recommendations
- Weakest-theme nudge: 'Your weakest pattern is <theme> — drill 5 puzzles' deep-linking into theme review
- Calibration finished / norm level-up or demotion summaries (if a session ends offline/background)
- Review queue growing (failed/slow puzzles waiting) — gentle reminder
- Admin-only: new signup / daily activity summary (optional)
- Re-engagement after N days inactive (Recently-active data exists in admin activity query)

## Risks

- App Store guideline 5.1.1(v): apps with account creation must offer in-app account deletion — only DELETE /admin/users/:id exists; need DELETE /users/me (cascade) before iOS submission.
- Session lifetime: JWT expires in 7d with no refresh token; mobile users will be silently logged out weekly. JWT_SECRET falls back to 'dev-secret' if env missing.
- api.ts treats ANY 401 with a token as session expiry; POST /auth/change-password returns 401 for a wrong current password, so the user gets logged out instead of seeing an error. Must fix (return 400/403 or special-case) before/while porting.
- Logout does not clear react-query cache, 'taktic.settings', or sound prefs; web relied on hard reload (window.location.replace) for 401 reset. RN has no reload — explicit reset of query cache + all zustand stores is required or data leaks between accounts.
- Settings PATCH is optimistic with no rollback and unhandled rejection on failure; offline changes silently diverge from server until next /users/me.
- Client vs DB defaults diverge (accentColor #c72a2f vs #22c55e, boardTheme 'stone' vs 'blue', pieceSet 'classic' vs 'maestro'); legacy fields accentColor/boardTheme/soundPack have no UI; reviewAutoAdvance exists in DB/DTO but has no frontend consumer. Decide which fields survive in the mobile schema.
- Sound prefs (volume, per-event picks) are device-local only; a fresh mobile install loses them unless synced.
- Recommendation 'reason' is an English server string; many UI strings are hardcoded outside i18n (heatmap legend/tooltip, chart empty text, 'fail', toast eyebrow, admin page, server validation errors).
- Cinzel display font has no Cyrillic subset — Ukrainian titles fall back to a system serif; pick a Cyrillic-capable display font for native.
- Intl.PluralRules / Intl.NumberFormat on Hermes: verify availability on the chosen Expo SDK; otherwise fall back to the existing pluralizeUk helper.
- Heatmap = 364 cells and rating chart may hold hundreds of points per year; naive RN Views/SVG nodes can drop frames on low-end Android — prefer Skia or a few batched SVG paths.
- RatingHistoryChart point index key `${style}-${endedAt}-${rating}` can collide (identical timestamps), mispositioning points; fix while porting.
- Timeline endpoint returns a flat list of all sessions for 365 days on each Stats visit (and publicly via by-nickname); heavy users => large payload; consider server-side aggregation or caching with react-query persistence.
- Avatar upload sends base64 data URLs in JSON; large phone photos may exceed body limits — resize with expo-image-manipulator or switch to multipart.
- Onboarding/admin gating relies on settingsReady; without synchronous storage (MMKV) the native app would flash defaults or the onboarding modal before /users/me resolves.
- Profile fields save on blur; on mobile, blur is not reliably triggered when navigating away (tab switch, swipe back) — risk of lost edits.
- Admin 'sessionsToday' uses server-local midnight while daily buckets use Postgres date_trunc (DB TZ) — inconsistent numbers; minor but surfaces if ported.
- focusMode semantic (Fullscreen API) has no direct native equivalent; needs status-bar hiding + Android immersive navigation bar + keep-awake.
- knightArrow setting targets right-click annotation arrows — meaningless on touch unless a long-press-drag arrow gesture is designed.
- If the web app is retired entirely, the admin tool and the public landing page (taktic.lang language picker) lose their host; decide what stays deployed.

## Open questions

- Admin: keep a trimmed web deployment (/login + /admin) or build an isAdmin-gated native screen? Recommendation is keep web for v1.
- Should the PWA 'Install app' card be replaced by a Notifications section (permission, daily reminder time, streak alerts) and a Haptics toggle in Settings › App?
- Which legacy settings fields (accentColor, boardTheme, soundPack, reviewAutoAdvance) should be dropped or revived on mobile? Do achievements 'set-accent'/'set-board' remain unlockable without UI (achievements service not read)?
- Should sound preferences (volume, variant picks) move to the server so they follow the user across devices?
- Will mobile support board annotation arrows (long-press drag)? If not, hide the knightArrow setting.
- Auth roadmap: add email/password recovery, Sign in with Apple/Google, refresh tokens? Any of these changes the login/register screens substantially.
- Where should timezone/reminder-time live for server-sent streak reminders (new UserSetting fields), or are local scheduled notifications (expo-notifications) acceptable for v1?
- First-launch language on mobile: device locale via expo-localization, or always ask (web used landing-page picker + 'taktic.lang')?
- Not read in this area (need inventory from other areas): AchievementsGrid, achievements/icons, AvatarCropper/AvatarPickerButton, Avatar, Logo, PasswordInput/Input/Button/Card UI primitives, lib/sound.ts + sound/catalog, theme-labels/theme-icons contents, StyleIcon, Chessboard/Arrows, play/[id] focus-mode CSS ('focus-mode', 'play-locked' body classes).
- Should the Stats heatmap honour the style filter (currently timeline query is unfiltered while other sections filter)?
- Styling approach for native: NativeWind (reuse Tailwind mental model / tokens) vs StyleSheet/Unistyles — affects how much class-based code is reusable.
