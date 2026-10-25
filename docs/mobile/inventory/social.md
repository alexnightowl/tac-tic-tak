# Inventory: social

_Home/dashboard, public profile + profile editor, avatars (display, crop, upload), friends + user search, leaderboard, achievements (grid, evaluation, unlock toasts), daily streaks (badge + backend rules)_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Home / Dashboard  ·  complexity S

**Where:** apps/frontend/src/app/(app)/dashboard/page.tsx (DashboardPage, StyleRatingCard), components/ui/card.tsx (Card hero / CardTitle / CardValue), components/SessionList.tsx (recent sessions, swipe-to-delete), components/StreakBadge.tsx, components/UserBadges.tsx, components/StyleIcon.tsx

**Behaviour**

Header: small caps label t('dashboard.welcome') above the user's nickname (26px, Cinzel heading font) with an inline verified BadgeCheck (size 20) if user.verified. Top right: if settings.showStreak && streak.days > 0, a StreakBadge computed with streakState(days, lastDay) from the zustand store; under it a 10px caption: at_risk -> t('streak.at_risk') in #d7b777 at 80% opacity, secured -> t('streak.secured') in zinc-500; 'broken' still shows the stale count with no caption (deliberate 'honesty' choice). Hero Card (slate texture tx-slate) with label t('dashboard.ready') and a full-width large Button 'Play' icon + t('dashboard.start') linking to /play. A 3-column grid of StyleRatingCard for TRAINING_STYLES (bullet/blitz/rapid): style icon (15px) + uppercase style name, currentPuzzleRating (2xl extrabold tabular), then t('play.unlocked') + unlockedStartRating. Data comes from store.progressions (hydrated from GET /users/me), not from the overview query. Two stat cards: 'All-time peak' = overview.allTimePeak or em dash; 'Sessions' = overview.recentSessions.length (BUG: the backend caps recentSessions at take:20, so this never shows more than 20; overview.lifetime.sessions exists in the response but is not in the frontend Overview type). Recent sessions list (SessionList) with swipe-to-delete: onDelete calls DELETE /sessions/:id (errors swallowed), then invalidates ['overview'], ['analytics'], ['analytics-themes']. Empty label t('dashboard.empty'). No pull-to-refresh, no skeletons (values just appear).

**API**

- `GET /api/analytics (overview: recentSessions[<=20], allTimePeak, lifetime{solved,attempts,accuracy,peakRating,sessions})`
- `DELETE /api/sessions/:id`
- `GET /api/users/me (indirect, via providers.tsx hydration: user, settings, progressions, streak)`

**State & persistence:** react-query key ['overview'] (enabled when store.user is set; global defaults: staleTime 30000ms, retry 1, refetchOnWindowFocus false, placeholderData keepPreviousData). zustand useAppStore: user, progressions, settings.language, settings.showStreak, streak{days,freezes,lastDay,freezeRegenAt}. Settings are mirrored to localStorage 'taktic.settings' and language to 'taktic.lang' by store.setSettings; auth token in localStorage 'taktic.token'.

**Web-only deps:** next/link (Link href=/play) -> expo-router Link/router.push; Tailwind classes + CSS vars (--eos-*), .tx-slate texture background -> RN StyleSheet/NativeWind tokens + ImageBackground; lucide-react -> lucide-react-native; SessionList swipe implemented with DOM pointer events (other area) -> react-native-gesture-handler Swipeable / Reanimated

**Motion & sound:** No animations on the dashboard itself apart from StreakBadge 'streak-pulse' (opacity 1 -> 0.55 -> 1, 1.6s ease-in-out infinite) when at_risk, and the SessionList swipe (radius + delete-button opacity tied to swipe progress). btn press feedback via CSS :active brightness(0.86) translateY(1px). No sounds.

**Mobile mapping:** Expo Router tab 'Home' as initial route. ScrollView with RefreshControl (pull-to-refresh invalidates ['overview'] + refetches /users/me for streak/progressions). Use lifetime.sessions for the Sessions tile. Stat tiles: animate number changes with Reanimated (count-up 400-600ms) when returning from a session. Primary CTA: Pressable with Reanimated scale 0.97 on pressIn + Haptics.impactAsync(Medium) -> push play setup. FlashList not needed (<=20 rows) but recent list should be a FlatList-in-ScrollView alternative (render rows directly). Streak pulse via Reanimated withRepeat(withTiming(0.55, {duration: 800, easing: inOut(ease)}), -1, true). Persist query cache with @tanstack/query-async-storage-persister (or MMKV) for instant cold start.

**Why S:** Static layout over two data sources already in the store/one query; the only interactive piece (swipe delete) belongs to SessionList.


## Daily streak (badge, state, freeze rules)  ·  complexity M

**Where:** components/StreakBadge.tsx, lib/utils.ts streakState()/formatLocalDate(), apps/backend/src/sessions/streak.ts applyStreakOnPlay()/isValidDay(), apps/backend/src/sessions/sessions.service.ts tickStreak(), used on dashboard, leaderboard rows, profile hero

**Behaviour**

Badge: lucide Flame (14px md / 12px sm) + day count, tabular, semibold, text-sm/xs. Renders null when days <= 0. Tint by state: secured/none = amber-300, at_risk = amber-300 + streak-pulse, broken = zinc-500. aria-label '{days}-day streak' + ' (play today to keep it)' / ' (broken)'. freezeAvailable prop accepted but intentionally ignored. Client state: streakState(days,lastDay) -> 'none' if days<=0 or no lastDay; 'secured' if lastDay == today (device local YYYY-MM-DD); 'at_risk' if lastDay == yesterday; else 'broken'. Server rules (streak.ts): freeze cap STREAK_FREEZE_MAX=1, regen STREAK_FREEZE_REGEN_DAYS=7. On each finished session, client sends its local date (opts.localDate 'YYYY-MM-DD'); if missing/invalid -> streak untouched, returns null. Regenerate freeze first if today >= freezeRegenAt. Same day -> 'same-day'. First play or days==0 -> 'started' (1). gap<0 (clock skew) -> unchanged 'same-day'. gap==1 -> 'continued' (+1). gap==2 with freeze -> 'frozen' (+1, freezes-1, regenAt=today+7). Otherwise -> 'reset' to 1. The session-finish response carries streak{days,freezes,lastDay,freezeRegenAt,outcome} and play/[id] page calls store.setStreak. Server never lazily resets: a broken streak keeps its old streakDays until the next play, so every consumer must run streakState. Leaderboard only shows the badge when state is secured or at_risk (and renders it without the state prop, so no pulse). Profile hero shows Flame + t('profile.streak') + days whenever streak.days > 0 WITHOUT checking state (BUG: shows stale broken streaks). Gated everywhere by settings.showStreak (PATCH /users/me/settings showStreak).

**API**

- `GET /api/users/me -> streak{days,freezes,lastDay,freezeRegenAt}`
- `GET /api/users/by-nickname/:nickname -> streak{days,freezes,lastDay}`
- `GET /api/leaderboard -> rows[].streakDays/streakLastDay`
- `session finish endpoint (sessions area) -> streak{...,outcome}`

**State & persistence:** zustand useAppStore.streak (EMPTY_STREAK = {days:0, freezes:1, lastDay:null, freezeRegenAt:null}); not persisted locally except through settings cache. DB: User.streakDays Int@0, streakFreezes Int@1, streakLastDay String?, streakFreezeRegenAt String? (no timezone column).

**Web-only deps:** CSS keyframes streak-breath / .streak-pulse in globals.css -> Reanimated; lucide-react Flame -> lucide-react-native

**Motion & sound:** streak-pulse: opacity 1 -> 0.55 -> 1, 1.6s period, ease-in-out, infinite, only in at_risk state. No sounds. No 'streak extended' celebration exists on web (opportunity on mobile).

**Mobile mapping:** Single <StreakBadge> component with Reanimated pulse; respect reduced motion (AccessibilityInfo.isReduceMotionEnabled). On session finish with outcome 'continued'/'started' play a flame burst (Lottie or Skia particles) + Haptics.notificationAsync(Success); 'frozen' -> ice shimmer + toast explaining the freeze was used; 'reset' -> soft warning haptic. Schedule LOCAL notifications with expo-notifications: when the app backgrounds / after each session, cancel and reschedule a 'streak at risk' reminder for e.g. 20:00 device-local tomorrow (and a last-chance one ~22:30) — no server timezone needed. Use expo-localization/device clock for formatLocalDate (same pure function). Add iOS widget / Android home-screen widget later (expo-widgets / react-native-android-widget) showing the flame.

**Why M:** Badge itself is S; the meaningful mobile value (local reminder scheduling, celebration on outcome, fixing stale-broken display, TZ handling) adds logic across session-finish and app lifecycle.


## Public profile page  ·  complexity L

**Where:** apps/frontend/src/app/(app)/profile/[nickname]/page.tsx (ProfilePage), components/Avatar.tsx, components/UserBadges.tsx, components/FriendActionButton.tsx, components/ProfileEditor.tsx, components/charts/RadarChart, RatingHistoryChart, ActivityHeatmap (other area), components/SessionList.tsx, lib/theme-labels themeLabel/isMetaTheme

**Behaviour**

Route param nickname. isSelf = case-insensitive compare with store.user.nickname. Three parallel queries. Loading: plain text 'Loading…' (hardcoded EN). Error/404: centered t('profile.not_found_title') + t('profile.not_found_hint') with {nickname} replaced. Hero Card (tx-slate, p-5): Avatar 64px; displayName (trimmed displayName || nickname, 22px, truncate); verified badge 18px; '@nickname' only when displayName set; '· COUNTRY' uppercase if country. Bio with whitespace-pre-wrap. Meta row (11px zinc-500): CalendarDays + t('profile.joined') + createdAt formatted toLocaleDateString(uk-UA|en-US, {year:'numeric', month:'long'}); Trophy + t('profile.peak') + allTimePeak when not null; Flame + t('profile.streak') + days in #d7b777 when showStreak && streak.days>0 (no state check). Actions row (own line, right-aligned >=sm): self -> link button to /friends (btn-slate, Users icon, t('nav.friends')) + ProfileEditor (onSaved -> refetch); other -> FriendActionButton. Ratings section: 3 cards per style with currentPuzzleRating and t('play.unlocked') unlockedStartRating ('—' fallbacks). Activity heatmap card (only if any timeline points): counts sessions per local day via formatLocalDate(new Date(endedAt)), weeks=52. Rating history card (only if points): timeline filtered to training styles, mapped to {endedAt, style, rating: peakRating}. Theme radar (only if >=3 themes): themes with rating>0 and not meta, top 8 by attempts, then sorted by slug, labelled via themeLabel(slug, language); bounds: no data -> {1200,2000}; else pad = max(50, round((hi-lo)*0.2)), min = max(0, lo-pad), max = hi+pad; size 340. Recent sessions: data.recentSessions (server take 10, endedAt not null, ordered by startedAt desc) with onDelete={() => {}} (BUG: a no-op handler makes SessionList canDelete=true, so swipe-to-delete appears on other users' profiles and on your own profile it silently does nothing). Rows link to /sessions/:id.

**API**

- `GET /api/users/by-nickname/:nickname (no auth) -> {id,nickname,displayName,avatarUrl,bio,country,createdAt,verified,progressions{bullet|blitz|rapid:{startPuzzleRating,currentPuzzleRating,unlockedStartRating,calibrationSessionsLeft,weakSessionStreak}},allTimePeak|null,streak{days,freezes,lastDay},recentSessions[10]}`
- `GET /api/users/by-nickname/:nickname/themes (no auth) -> ThemeRow[] {slug,attempts,failures,avgResponseMs,failureRate,weakness,rating}`
- `GET /api/users/by-nickname/:nickname/timeline (no auth) -> last 365 days TimelinePoint[] {id,endedAt,style,startRating,peakRating,solved,durationSec}`
- `GET /api/users/by-nickname/:nickname/friendship (auth) via FriendActionButton`

**State & persistence:** react-query keys ['profile', nickname], ['profile-themes', nickname], ['profile-timeline', nickname] (keyed by raw route casing, so different casings = different cache entries). Derived data via useMemo (ratingPoints, heatmapData, radarData, radarBounds). zustand: user, settings.language, settings.showStreak. Backend lookup is prisma findUnique({nickname}) = case-sensitive exact match.

**Web-only deps:** next/navigation useParams -> expo-router useLocalSearchParams; next/link -> expo-router Link; SVG chart components (RadarChart, RatingHistoryChart, ActivityHeatmap) -> react-native-svg or @shopify/react-native-skia (victory-native XL); Date.toLocaleDateString with 'uk-UA' -> Hermes Intl (verify uk locale support) or date-fns with uk locale; CSS whitespace-pre-wrap/truncate -> Text numberOfLines / default newline handling

**Motion & sound:** None on web (no transitions, no skeletons). Charts are static.

**Mobile mapping:** Stack screen /profile/[nickname] reachable from leaderboard, friends, search, deep links (expo-linking + universal links taktic.app/profile/:nick). Parallax/collapsing header with Reanimated useAnimatedScrollHandler (avatar shrinks into nav bar title), shared-element transition of the Avatar from the list row (Reanimated sharedTransitionTag). Skeleton placeholders (moti/skeleton) instead of 'Loading…'. Prefetch profile query on row pressIn (queryClient.prefetchQuery) so the screen opens filled. Charts: Skia for the 52-week heatmap (364 cells - draw in one Canvas, not 364 Views), victory-native (Skia) line chart with pan-to-scrub + selection haptics, Skia/SVG radar. Hide session swipe-delete when !isSelf. Pull-to-refresh refetches all three queries. Share button (Share API) for profile deep link.

**Why L:** Screen itself is moderate, but it embeds three custom charts that must be rebuilt natively (Skia/SVG) with gesture scrubbing, plus collapsing header/shared transitions for the smooth feel.


## Profile editor (display name, bio, country)  ·  complexity S

**Where:** components/ProfileEditor.tsx (ProfileEditor button, EditorDialog, Field), duplicate inline-editing implementation in app/(app)/settings/page.tsx ProfileTab (commit per field, no achievement toasts on avatar there)

**Behaviour**

Button 'Pencil' + t('profile.edit') opens a portal modal (z-60, bg black/70 + backdrop-blur-sm, bottom-aligned on mobile widths, centered on md+; tap on backdrop closes). Header t('profile.edit_title') + X close. Avatar 64 + AvatarPickerButton (t('profile.change_avatar')). Fields with label + counter hint: displayName (maxLength 40, placeholder = nickname, counter 'n/40'), bio textarea rows 3 maxLength 280 resize-none placeholder t('profile.bio_placeholder') counter 'n/280', country (2 chars, uppercase display, placeholder 'UA', hint t('profile.country_hint')). Validation: nameValid = empty or 1..40; bioValid <= 280; countryValid = empty or /^[A-Za-z]{2}$/; invalid hint turns eos-rose. Save (btn-ember, spinner while saving) -> PATCH /users/me/profile {displayName,bio,country}; server trims, empty -> null, lower-cases country; returns updated fields + achievementsUnlocked (set-bio/set-country etc.) -> patchUser in store + achievement toasts, then closes (onClose also triggers parent refetch). Error shown as message text in eos-rose. Cancel = close (always triggers onSaved refetch too). Server DTO: displayName MaxLength 40, bio MaxLength 280, country /^([a-z]{2})?$/i. Note: closing via Cancel or backdrop also calls onSaved -> refetch.

**API**

- `PATCH /api/users/me/profile {displayName?, bio?, country?} -> {id,displayName,bio,country,avatarUrl,nickname,achievementsUnlocked[]}`
- `POST /api/users/me/avatar (see Avatar upload)`

**State & persistence:** Local useState for form fields/saving/err; zustand patchUser; toast store push (tone 'achievement'). No draft persistence.

**Web-only deps:** react-dom createPortal + document.body -> RN Modal / @gorhom/bottom-sheet; backdrop-blur-sm -> expo-blur BlurView; HTML input/textarea -> TextInput (multiline), autoCapitalize='characters' for country; mounted guard for SSR -> unnecessary in RN

**Motion & sound:** No enter/exit animation on web (appears instantly). Spinner via Tailwind animate-spin.

**Mobile mapping:** @gorhom/bottom-sheet (snap to content, keyboard-aware with BottomSheetTextInput) or a native formSheet stack presentation (expo-router presentation:'formSheet'). KeyboardAvoiding via react-native-keyboard-controller. Country: replace free-text 2-letter input with a searchable country picker (flag emoji list) - optional improvement. Live counters, Haptics.notificationAsync(Success) on save, (Error) on failure with shake animation on invalid field (Reanimated withSequence). Consolidate the duplicated settings ProfileTab and this editor into one native screen.

**Why S:** Three fields with simple validation and one PATCH; bottom sheet + keyboard handling are standard libraries.


## Avatar picker, cropper and upload  ·  complexity M

**Where:** components/AvatarCropper.tsx (AvatarCropper modal, AvatarPickerButton, renderCrop, loadImage), apps/backend/src/users/users.service.ts setAvatar(), apps/backend/src/main.ts static /uploads

**Behaviour**

AvatarPickerButton: hidden <input type=file accept='image/png,image/jpeg,image/webp'>; selecting a file opens the cropper (input value reset so the same file can be re-picked). Cropper: portal modal z-70 bg black/80 blur; title 'Crop avatar' (hardcoded EN); square area using react-easy-crop with cropShape 'round', aspect 1, no grid, drag to pan, pinch/wheel to zoom; zoom slider range 1..4 step 0.01 (custom '.ticks' slider with --pct CSS var). Save: draws the cropped pixel area into a 256x256 canvas (imageSmoothingQuality 'high') and exports JPEG quality 0.88 as a data URL -> onConfirm -> POST /users/me/avatar {dataUrl}. Errors: 'Failed to read file' / e.message / 'Upload failed'. Cancel/backdrop closes. Backend: DTO requires /^data:image\/(png|jpeg|webp);base64,/; decodes, rejects empty or > 4MB (MAX_AVATAR_BYTES) with 'image too large (NKB)'; writes uploads/avatars/{userId}.{ext} on local disk (deletes other-extension copies); avatarUrl = '/uploads/avatars/{file}?v={Date.now()}' (cache-bust); runs achievements.evaluate (set-avatar). JSON body limit raised to 6mb. Served by useStaticAssets(prefix '/uploads/'). Frontend resolves relative URL with assetUrl() = API_HOST + path. No avatar removal endpoint.

**API**

- `POST /api/users/me/avatar {dataUrl: 'data:image/jpeg;base64,...'} -> {avatarUrl, achievementsUnlocked[]}`
- `GET /uploads/avatars/{userId}.{ext}?v={ts} (static, outside /api)`

**State & persistence:** Local useState (file, imageSrc data URL, crop {x,y}, zoom, croppedArea px, submitting, err). On success store.patchUser({avatarUrl}). Server: file on disk + User.avatarUrl.

**Web-only deps:** <input type=file> -> expo-image-picker (launchImageLibraryAsync / launchCameraAsync, allowsEditing+aspect [1,1] gives native crop on iOS/Android); react-easy-crop -> native picker crop, or a custom Reanimated+Gesture Handler pinch/pan circle cropper; FileReader.readAsDataURL -> expo-file-system / picker base64 option; HTMLCanvasElement drawImage + toDataURL -> expo-image-manipulator (crop + resize 256 + compress 0.88 JPEG, base64:true); createPortal/document.body -> RN Modal; input type=range -> @react-native-community/slider or gesture-only zoom; assetUrl() uses API_HOST derived from window.location -> config constant from expo-constants/env

**Motion & sound:** None besides react-easy-crop's own drag/zoom and animate-spin loader.

**Mobile mapping:** Action sheet (Take photo / Choose from library / Remove) -> expo-image-picker with permissions -> custom circular cropper screen (GestureDetector Pinch+Pan simultaneous, clamp zoom 1..4 with soft haptic at limits) -> expo-image-manipulator to 256px JPEG 0.88 -> upload. Prefer switching backend to multipart (FileInterceptor) or presigned S3 URL; keep data-URL endpoint for compatibility. Optimistic local preview immediately (show local uri) with upload progress ring. Render avatars with expo-image (memory+disk cache, transition 150ms); the ?v= cache-buster keeps cache correct.

**Why M:** Native picker/manipulator replaces canvas easily, but a quality custom round cropper with gestures, permissions flows, and likely backend storage change (local disk/base64) add work.


## Avatar display (initials disc, creator crown) and verified badge  ·  complexity S

**Where:** components/Avatar.tsx (Avatar, CreatorCrown, getInitials, hashString), components/UserBadges.tsx, lib/creators.ts (CREATOR_NICKNAMES = {'lazynightowl'}), .eos-avatar in globals.css

**Behaviour**

Avatar(nickname, avatarUrl, size=40): wrapper size x size. If avatarUrl -> <img> round object-cover; else initials disc: getInitials splits on non [A-Za-zА-Яа-яЁё0-9] chars -> first letters of first two parts, else first 2 chars, uppercased, '?' if empty; font size round(size*0.36), Cinzel 700 with engraved text-shadow on a slate texture (/design/textures/slate.jpg?v=3 at 220px) with radial highlight and inset shadows. BG_COLORS has a single entry so hashString is effectively unused. Normal ring: box-shadow 0 0 0 1px rgba(17,15,17,0.65), 0 0 0 2px rgba(255,255,254,0.06). Creator (nickname in CREATOR_NICKNAMES, case-insensitive): 2px amber-300 outline with 2px offset + crown chip bottom-right: chip = max(14, round(size*0.32)), icon = max(9, round(chip*0.6)), offset -round(chip*0.15), gradient 135deg #fce898 0% / #eca226 60% / #d07c20 100%, ring-2 in --bg-base, Crown filled amber-950, title 'Creator'. UserBadges: sky-400 lucide BadgeCheck at given size when verified (server User.verified, flipped manually in DB). Used at sizes 36 (lists), 64 (profile/editor), 72 (settings).

**State & persistence:** Stateless. Creator list hardcoded in client.

**Web-only deps:** <img> -> expo-image; CSS outline/outline-offset -> extra wrapping View with borderWidth + padding; box-shadow stacks / radial-gradient / text-shadow -> pre-rendered slate disc PNG asset or Skia; textShadow* props for engraved text; CSS url() texture -> require('assets/slate.jpg') ImageBackground; lucide-react Crown/BadgeCheck -> lucide-react-native; Cinzel font via next/font -> expo-font (@expo-google-fonts/cinzel)

**Motion & sound:** None.

**Mobile mapping:** Memoized <Avatar> (React.memo) since it appears in long lists; use expo-image with recyclingKey for FlashList rows and a cachePolicy 'memory-disk'. Pre-render the slate initials background as a static image asset to avoid per-row Skia cost. Optionally move creator flag to the server (User.isCreator) to avoid shipping a hardcoded list in the binary.

**Why S:** Pure presentational; only the stone styling needs asset-based recreation.


## Friends screen (requests + friend list)  ·  complexity M

**Where:** apps/frontend/src/app/(app)/friends/page.tsx (FriendsPage), components/UserSearch.tsx (embedded), apps/backend/src/users/friends.controller.ts, apps/backend/src/users/friendship.service.ts

**Behaviour**

Title t('friends.title'). Card 'Find players' with UserSearch (onAction -> invalidate lists). Incoming section (only if any): header t('friends.incoming') (count); rows = glass card, Avatar 36 + displayName||nickname (+ '@nickname' if displayName) + verified badge, whole left part links to profile; Accept button (btn-ember, Check) -> POST /friends/:id/accept, then toasts every slug in achievementsUnlocked (first-friend, five-friends) and invalidates; Decline (X) -> DELETE /friends/:id. Outgoing section: same row + 'Clock' t('friends.waiting'); Cancel -> DELETE /friends/:id. My friends: header t('friends.my') (count), empty state card t('friends.empty'); each row has a UserMinus icon button (aria t('friends.unfriend')) -> DELETE /friends/by-user/:otherId immediately with NO confirmation. No optimistic updates: lists refresh after invalidate. Errors are not caught (unhandled promise rejections, no feedback). Ordering: friends by acceptedAt desc; pending by createdAt desc. No pagination. Server: sendRequest 404 if no user, 400 self, 409 'already friends' / 'request already pending'; if the target already sent a pending request to me, sendRequest auto-accepts it. accept: only addressee, must be pending; evaluates achievements for both users but returns only the accepter's (requester's count in _requesterAchievements, never surfaced to them until they open achievements). reject: either party, pending only. removeByUserId: accepted only, either direction. Friendship statuses: 'pending' | 'accepted' (no 'blocked').

**API**

- `GET /api/friends -> [{friendshipId, since, user:{id,nickname,displayName,avatarUrl,country,verified}}]`
- `GET /api/friends/pending -> {incoming:[{id,createdAt,user}], outgoing:[{id,createdAt,user}]}`
- `POST /api/friends/request {nickname} (3-20 chars, /^[A-Za-z0-9_-]+$/)`
- `POST /api/friends/:id/accept -> {id,status,user,achievementsUnlocked[],_requesterAchievements}`
- `DELETE /api/friends/:id (decline incoming / cancel outgoing)`
- `DELETE /api/friends/by-user/:otherId (unfriend)`

**State & persistence:** react-query keys ['friends'], ['friends-pending'] (also invalidated by FriendActionButton). Toast store for achievement toasts. DB Friendship(id, requesterId, addresseeId, status, createdAt, acceptedAt) unique(requesterId, addresseeId), indexes on (addresseeId,status), (requesterId,status).

**Web-only deps:** next/link -> expo-router; hover:bg-white/5 states -> Pressable pressed style; Tailwind .glass -> RN style token

**Motion & sound:** None (rows appear/disappear instantly after refetch).

**Mobile mapping:** Tab or stack screen with a SectionList/FlashList (sections: Requests (incoming) / Sent / Friends) and a badge count on the tab icon from pending.incoming.length (also app icon badge via expo-notifications setBadgeCountAsync). Swipeable rows (react-native-gesture-handler ReanimatedSwipeable): swipe right = accept, left = decline/unfriend with confirm ActionSheet for unfriend. Optimistic mutations with useMutation onMutate + rollback, Reanimated Layout animations (FadeOut, LinearTransition) when a row moves from Requests to Friends. Haptics: success on accept, light impact on decline, warning on unfriend. Pull-to-refresh. Refetch on app foreground (AppState -> focusManager) and on push receipt. Error toasts for 409/404.

**Why M:** CRUD over 6 existing endpoints, but the polished version needs optimistic updates, swipe actions, layout animations and badge counts.


## User search (find players)  ·  complexity S

**Where:** components/UserSearch.tsx (UserSearch, FriendAction), users.controller.ts search(), friendship.service.ts search()/statusWith()

**Behaviour**

Text input (h-11, Search icon left, Loader2 spinner right while loading, autoFocus). Query < 2 trimmed chars -> results cleared. Debounce 250ms then GET /users/search?q=. Errors -> empty results. 'No matches.' (hardcoded EN) when >=2 chars, results empty, not loading. Results: up to 10 users (server min(limit,25), take 10 from controller), case-insensitive nickname prefix match (startsWith, mode insensitive), excludes viewer, ordered by nickname asc; displayName is NOT searched. Each result: avatar 36, name/@nick, verified, country; left part links to profile. Per-row action from friendship.state (server enriches each hit with statusWith via N+1 queries): self -> nothing; friends -> sage 'Friends' label; outgoing -> 'Requested' with Clock; incoming -> 'Accept' button; none -> 'Add' button. All these labels are hardcoded English (not i18n). Add/Accept both call POST /friends/request {nickname} (for incoming the server auto-accepts) and then locally set state to 'outgoing' (BUG: after accepting it shows 'Requested' instead of 'Friends'; achievementsUnlocked from the auto-accept is ignored). Errors silently swallowed. No race protection: a slow older response can overwrite newer results (no abort).

**API**

- `GET /api/users/search?q= (auth) -> [{id,nickname,displayName,avatarUrl,country,verified,friendship:{state,friendshipId}}]`
- `POST /api/friends/request {nickname}`

**State & persistence:** Local useState (q, results, loading) + useRef debounce timer. Not in react-query.

**Web-only deps:** HTML input autoFocus -> TextInput autoFocus / search bar in native header (expo-router headerSearchBarOptions on iOS); next/link -> expo-router; Tailwind animate-spin -> ActivityIndicator

**Motion & sound:** Spinner only.

**Mobile mapping:** Move to react-query: useQuery(['user-search', debouncedQ], {enabled: q.length>=2}) with AbortSignal so stale responses never win; use a useDebouncedValue 250ms. Native search bar (iOS large-title header search) and keyboardDismissMode='on-drag'. Fix state transition after Accept -> 'friends' and toast achievements. Selection haptic on Add. Optional: QR code / share-link 'add me' (expo-camera barcode scanner) since nickname typing is clunky on phones; contact-style invite via Share sheet with deep link.

**Why S:** One debounced endpoint and a state-to-button mapping; fixes are small.


## Friend action button on profile  ·  complexity S

**Where:** components/FriendActionButton.tsx (FriendActionButton, ActionBtn)

**Behaviour**

Fetches relationship via GET /users/by-nickname/:nickname/friendship. Renders nothing while loading or for 'self'. none -> primary 'UserPlus' t('profile.add_friend') -> POST /friends/request. outgoing -> ghost 'Clock' t('profile.cancel_request') -> DELETE /friends/:friendshipId. incoming -> two buttons: primary Accept (POST /friends/:id/accept) and ghost Decline (DELETE /friends/:id). friends -> ghost 'UserMinus' t('profile.unfriend') with title tooltip t('profile.friends') -> DELETE /friends/by-user/:targetUserId (no confirm). busy = any mutation pending -> all disabled (opacity 60) and busy buttons swap icon for a 12px spinner (the Decline button never shows a spinner). onSuccess invalidates ['friendship-with', nickname], ['friends'], ['friends-pending']. Accept here does NOT toast achievementsUnlocked (inconsistent with friends page). Errors: no UI (react-query mutation error ignored). Backend friendship lookup is case-sensitive findUnique by nickname; unknown user -> {state:'none'}.

**API**

- `GET /api/users/by-nickname/:nickname/friendship (auth) -> {state:'none'|'self'|'outgoing'|'incoming'|'friends', friendshipId|null}`
- `POST /api/friends/request {nickname}`
- `POST /api/friends/:id/accept`
- `DELETE /api/friends/:id`
- `DELETE /api/friends/by-user/:targetUserId`

**State & persistence:** react-query key ['friendship-with', nickname] + 4 useMutation instances.

**Web-only deps:** title attribute tooltip -> long-press tooltip or omit; hover:brightness-110 -> Pressable pressed opacity/scale

**Motion & sound:** Spinner swap only.

**Mobile mapping:** Single <FriendshipButton> with optimistic state machine (setQueryData) and Reanimated layout transition for label/width change (none -> Requested). Unfriend behind an ActionSheet/Alert confirm. Haptics per action. Toast achievements on accept for parity.

**Why S:** Small state machine over existing endpoints.


## Leaderboard  ·  complexity M

**Where:** apps/frontend/src/app/(app)/leaderboard/page.tsx (LeaderboardPage, Row), components/ui/segmented.tsx, apps/backend/src/users/leaderboard.controller.ts, apps/backend/src/users/leaderboard.service.ts

**Behaviour**

Title with ember Trophy. Segmented control for style (bullet/blitz/rapid, default 'blitz', icons StyleIcon 18px; active tab bg-eos-ember with inset shadows, no background transition by design so fast switching never shows two half-lit tabs). Scope toggle Global/Friends (eos-well track, active bg-eos-rise; default 'global'). Fetch GET /leaderboard?style&scope&limit=100. Loading -> 'Loading…' (hardcoded EN) only on first load; when switching, keepPreviousData keeps old rows dimmed to opacity 0.6 with a 150ms opacity transition. Empty: t('leaderboard.empty_friends') or t('leaderboard.empty'). Row (whole row links to profile): rank column w-8 - ranks 1/2/3 show lucide Medal in #d7b777 / #cbc5bf / #ad7f5c, others numeric zinc-500; Avatar 36; name/@nick + verified; country (10px uppercase); streak badge (sm, no state tint) only when showStreak and streakState(row.streakDays,row.streakLastDay) is secured or at_risk (computed with the VIEWER's local date against other users' local-day strings); rating with StyleIcon 16. Self row highlighted: inset 1px rgba(166,66,65,0.55) ring and bg #2e262c. Server: style validated (fallback blitz), scope 'friends' includes viewer + accepted friends; limit clamp 1..200 (default 100); ordering currentPuzzleRating desc then updatedAt asc (earlier achiever wins ties); rank = index+1 (no tie sharing); reads UserStyleProgression joined to user. If the viewer is outside the top N they never see their own rank. No pagination, no time-window boards.

**API**

- `GET /api/leaderboard?style=bullet|blitz|rapid&scope=global|friends&limit=100 (auth) -> [{rank,rating,unlocked,isSelf,streakDays,streakLastDay,user:{id,nickname,displayName,avatarUrl,country,verified}}]`

**State & persistence:** Local useState style ('blitz'), scope ('global') - not persisted. react-query key ['leaderboard', style, scope] with global keepPreviousData + 30s staleTime. zustand settings.showStreak.

**Web-only deps:** next/link -> expo-router; CSS transition-opacity/hover:brightness-110 transition-[filter] -> Reanimated; Tailwind arbitrary shadows -> RN styles

**Motion & sound:** Placeholder dim: opacity 1 -> 0.6, 150ms. Row hover brightness (desktop only). Segmented intentionally instant.

**Mobile mapping:** FlashList (estimatedItemSize ~60) with memoized rows; horizontal pager (react-native-pager-view or Reanimated swipe) between the three styles in sync with an animated segmented indicator (sliding pill via Reanimated, Haptics.selectionAsync on change). Scope toggle as a second segmented control. Sticky 'your position' row pinned at bottom when isSelf row is off-screen (requires backend to return viewer rank/row even if outside top N - small backend addition). Podium header for top 3 with medal colours. Pull-to-refresh. Persist last style/scope in MMKV. Prefetch other styles on mount for instant swipes.

**Why M:** Single endpoint, but native polish (pager between styles, sliding segmented indicator, sticky self row needing a backend tweak, list perf) goes beyond a straight port.


## Achievements grid, evaluation and star-repo  ·  complexity M

**Where:** components/achievements/AchievementsGrid.tsx (mounted as the second tab of app/(app)/analytics/page.tsx), components/achievements/AchievementCard.tsx, components/achievements/icons.tsx ACHIEVEMENT_ICON_MAP, apps/backend/src/achievements/registry.ts ACHIEVEMENT_DEFS (23 achievements), apps/backend/src/achievements/achievements.service.ts, apps/backend/src/achievements/achievements.controller.ts

**Behaviour**

On mount: GET /achievements and fire-and-forget POST /achievements/evaluate (catch-all; newly unlocked slugs -> toasts + invalidate ['achievements']). Loading: t('achv.loading'). Progress card: t('achv.progress_title') + t('achv.progress_value') with {done}/{total} replaced + big 'done / total' (amber-300 / zinc-600 / zinc-400). Star-repo card: Github icon, t('achv.star_repo_title'), t('achv.star_repo_hint') (line-clamp-2), button t('achv.star_cta') -> window.open('https://github.com/alexnightowl/tac-tic-tak', '_blank') then POST /achievements/star-confirm (trust-based, sets User.starredRepo) -> toasts + invalidate; when unlocked shows t('achv.starred') in sage, disabled. Categories rendered in order play, skill, streak, customize, social with header t('achv.cat.{cat}'), grid 1 col (2 on >=sm). AchievementCard: unlocked -> border amber-300/30, gradient bg amber-300 6% to transparent, 48px icon chip with gradient 135deg #fce898/#eca226/#d07c20 and icon 22px amber-950; title white; desc zinc-300; unlock date (10px uppercase amber-300/70) toLocaleDateString(uk-UA|en-US,{day:'numeric',month:'short',year:'numeric'}). Locked -> muted card, Lock icon 18px zinc-600, title zinc-400, desc zinc-500 (so the player knows what to chase). No progress bars toward thresholds. Catalogue (slug: criterion): customize - set-accent (accentColor != '#22c55e'), set-board (boardTheme != 'blue'), set-language (language != 'en'), set-avatar (avatarUrl set), set-bio (non-blank bio), set-country (country set); play - first-session (>=1 finished session), ten-sessions (>=10), hundred-sessions (>=100), solve-100 (>=100 correct attempts), solve-1000 (>=1000); skill - triple-style (finished bullet+blitz+rapid), calibration-done (any style calibrationSessionsLeft==0 && unlockedStartRating>0), peak-1500/1800/2000 (best session peakRating); streak - streak-3/7/30/100 (current streakDays); social - first-friend (>=1 accepted), five-friends (>=5), star-repo (starredRepo). evaluate(): loads a snapshot (user+settings, finished sessions style/peak, correct attempt count, style progressions, accepted friendship count) in one Promise.all, runs pure evaluators, inserts newly met slugs with createMany skipDuplicates, returns newly unlocked slugs. Called inline by: PATCH /users/me/settings, PATCH /users/me/profile, POST /users/me/avatar, POST /friends/:id/accept (both users), session finish/save paths in sessions.service (3 call sites), /achievements/evaluate, /achievements/star-confirm. Unlocks are never revoked (e.g., streak-7 stays after a reset).

**API**

- `GET /api/achievements -> [{slug, category, icon, unlocked, unlockedAt|null}] (23 items, registry order)`
- `POST /api/achievements/evaluate -> {newly: string[]}`
- `POST /api/achievements/star-confirm -> {newly: string[]}`

**State & persistence:** react-query key ['achievements']; local useState starring. DB UserAchievement(userId, slug, unlockedAt) PK(userId,slug), index(userId,unlockedAt); User.starredRepo. Names/descriptions live only in frontend i18n: 'achv.{slug}.name'/'achv.{slug}.desc' (46 keys per language) + 12 UI keys = 58 'achv.*' keys per language (en + uk).

**Web-only deps:** window.open -> expo-web-browser openBrowserAsync or Linking.openURL; lucide-react icon map -> lucide-react-native (same icon names); CSS linear-gradient backgrounds -> expo-linear-gradient; toLocaleDateString uk-UA -> Hermes Intl or date-fns/locale/uk

**Motion & sound:** Only transition-colors on the card (no visible animation in practice). No unlock animation in the grid.

**Mobile mapping:** Dedicated Achievements screen (not buried in analytics tab) using SectionList/FlashList with category sections, 2-column grid. Tap tile -> bottom sheet with large icon, description, unlock date, (future) progress toward threshold. Locked->unlocked reveal animation when an unlock happened since last visit (track 'seen' slugs in MMKV): scale+glow with Reanimated, shimmer on the gold gradient (Skia or masked LinearGradient), Haptics.notificationAsync(Success). Star repo via expo-web-browser; keep trust-based confirm after browser closes (await openBrowserAsync then POST). Consider exposing threshold progress (e.g., totalSolved/1000) from the backend for progress rings.

**Why M:** Data/logic is simple and backend is reusable as-is, but celebratory reveal animations, seen-state tracking and detail sheets are new native work.


## Achievement unlock toasts (cross-cutting)  ·  complexity S

**Where:** components/Toast.tsx (ToastContainer, ToastCard), lib/toast.ts (useToastStore), callers: friends/page.tsx accept, ProfileEditor save/avatar, AchievementsGrid evaluate/star, settings/page.tsx patch, play/[id]/page.tsx session finish

**Behaviour**

Callers push {tone:'achievement', title: t('achv.{slug}.name'), description: t('achv.{slug}.desc'), achievementSlug} per unlocked slug. Container fixed top-right (top-3 right-3, safe-area-inset-top padding, width min(360px, 100vw-1.5rem), z-200, stacked with gap 8px). Card: glass rounded-2xl, border rgba(166,66,65,0.35), icon tile 40px with gradient 160deg #b8524c -> #883536 and inset highlights, icon from ACHIEVEMENT_ICON_MAP (fallback Trophy) in #f5eee5; caption 'Achievement' / 'Notice' (hardcoded EN) 11px uppercase eos-rose; title truncated; description line-clamp-2; X dismiss. Auto-dismiss after AUTO_DISMISS_MS = 4500ms. Toast ids `${Date.now()}-${random4}`. Multiple unlocks stack simultaneously. Missed unlocks (e.g., requester's first-friend triggered by the other user accepting) only surface when that user later opens the achievements tab (evaluate returns [] then because they were already inserted - so they are effectively never toasted).

**State & persistence:** zustand useToastStore {toasts[], push, dismiss, clear}; in-memory only.

**Web-only deps:** CSS keyframes slideInRight (translateX 110% -> 0, opacity 0 -> 1) 220ms ease-out -> Reanimated entering animation; position fixed + env(safe-area-inset-top) -> absolute overlay + react-native-safe-area-context; line-clamp/truncate -> numberOfLines

**Motion & sound:** Enter: slideInRight 220ms ease-out. No exit animation (instant removal). Auto-dismiss 4500ms. No sound.

**Mobile mapping:** Top-anchored toast overlay (custom Reanimated or burnt/sonner-native) sliding down from the top (better thumb ergonomics than right on phones), swipe-up to dismiss (Gesture Pan), exit animation, queue/stack. Haptics.notificationAsync(Success) per achievement toast (throttle so multiple unlocks don't buzz repeatedly), optional achievement chime via expo-audio. Server should track 'notified' per UserAchievement (or add seenAt) so unlocks caused by others get delivered via push + in-app on next open.

**Why S:** Small store + overlay; library-backed on RN.


## Push notifications for social/streak/achievements (NEW - no existing infrastructure)  ·  complexity L

**Where:** (none exists) - would hook into friendship.service.ts sendRequest/accept, achievements.service.ts evaluate, sessions.service.ts tickStreak and rating updates

**Behaviour**

Currently nothing pushes: there is no device-token model, no notifications module, no scheduler in the files read, and no per-user timezone. Event hooks available today: FriendshipService.sendRequest (new pending row -> notify addressee; auto-accept branch -> notify original requester), FriendshipService.accept (notify requester; requester's newly unlocked achievements are computed but discarded), AchievementsService.evaluate (returns newly unlocked slugs - callers can fan out), tickStreak outcomes ('frozen', 'reset'), streakFreezeRegenAt date reached, leaderboard rank changes (no rank history stored - would need comparing ratings of friends before/after a session update).

**API**

- `(proposed) POST /api/devices {expoPushToken, platform, timezone, locale}`
- `(proposed) DELETE /api/devices/:token`
- `(proposed) PATCH /api/users/me/settings with notification preference flags`

**State & persistence:** Needs new Prisma models: Device/PushToken(userId, token, platform, tz, createdAt, lastSeenAt) and notification preferences on UserSetting (friendRequests, streakReminders, achievements, leaderboard). Server-side copy needs localization (settings.language exists; achievement names currently only in frontend i18n).

**Motion & sound:** Notification sound/category per type (Android channels: social, streak, achievements).

**Mobile mapping:** expo-notifications (getExpoPushTokenAsync, Android channels, iOS categories with actions e.g. 'Accept' / 'Decline' friend request directly from the notification), Expo Push Service or direct APNs/FCM from NestJS (expo-server-sdk-node). Streak-at-risk should be LOCAL scheduled notifications (device knows its TZ) with server fallback once tz is stored. Notification tap -> expo-router deep link (/friends, /profile/:nick, /achievements, /play). Badge count = pending incoming requests.

**Why L:** Greenfield backend module (tokens, preferences, fan-out, localization, possibly a job queue) plus client permission flows, channels, deep-link routing and actionable notifications.


## Shared-logic candidates

- `apps/backend/src/sessions/streak.ts` — STREAK_FREEZE_MAX, STREAK_FREEZE_REGEN_DAYS, StreakState type, isValidDay(), applyStreakOnPlay() — blockers: None - pure TS with no imports. Move to a packages/shared module consumed by backend and mobile (mobile could predict outcome optimistically / compute reminder schedules).
- `apps/frontend/src/lib/utils.ts` — streakState(), StreakState type, formatLocalDate(), fmtDuration(), fmtResponseTime() — blockers: cn() in the same file imports clsx + tailwind-merge (web styling) - split pure helpers out. Note naming clash: frontend StreakState ('secured'|'at_risk'|'broken'|'none') vs backend StreakState (storage shape).
- `apps/backend/src/achievements/registry.ts` — AchievementCategory, AchievementState, AchievementDef, ACHIEVEMENT_DEFS (slug/category/icon + pure evaluators), ACHIEVEMENT_SLUGS — blockers: Pure, no imports. Default constants (DEFAULT_ACCENT '#22c55e', DEFAULT_BOARD_THEME 'blue', DEFAULT_LANGUAGE 'en') mirror schema.prisma by hand. Sharing slug/category metadata (and thresholds for progress UI) with mobile is safe; evaluators can stay server-side.
- `apps/frontend/src/components/achievements/icons.tsx` — ACHIEVEMENT_ICON_MAP (slug -> lucide icon) — blockers: Imports lucide-react; RN needs the same map built from lucide-react-native (identical icon names) - share the slug->iconName string map, not the components.
- `apps/frontend/src/lib/creators.ts` — CREATOR_NICKNAMES, isCreatorNickname() — blockers: None (pure). Consider moving the flag server-side instead.
- `apps/frontend/src/components/Avatar.tsx (internal helpers)` — getInitials(), hashString() (not exported today) — blockers: Inline in a component file with 'use client' and DOM JSX - extract to a pure module.
- `apps/frontend/src/lib/i18n.ts` — en/uk dictionaries (Dict), useT(), useTn() (Intl.PluralRules) — blockers: Dicts are pure data but not exported; hooks read zustand useAppStore. 'use client' directive harmless in RN. Extract dicts to shared package (also lets the backend localize push copy). Relevant key counts per language: dashboard 9, profile 25, friends 12, leaderboard 5, achv 58, streak 2 (+ stats keys used on profile). Hermes supports Intl.PluralRules on recent RN, verify 'uk'.
- `apps/frontend/src/lib/toast.ts` — useToastStore, Toast, ToastTone — blockers: zustand works in RN unchanged; only the 'use client' directive (harmless).
- `apps/frontend/src/lib/store.ts` — useAppStore, UserSettings, Streak, AuthUser, Progression(s), ANIMATION_MS, defaults — blockers: setSettings touches document.documentElement and window.localStorage ('taktic.settings', 'taktic.lang') - replace with zustand persist + MMKV/AsyncStorage. Types are reusable verbatim.
- `apps/frontend/src/lib/api.ts` — http.get/post/patch/del, api(), assetUrl(), API_URL, API_HOST, getToken/setToken — blockers: API_URL derives from window.location; token in localStorage 'taktic.token'; 401 handler does window.location.replace('/login'). Port the fetch wrapper with expo-secure-store token, env-based API_URL (expo-constants), and router-based logout.
- `apps/frontend/src/lib/levels.ts` — TRAINING_STYLES, TrainingStyle, isTrainingStyle, DIFFICULTY_BANDS, bandFor, BAND_ICON — blockers: Mostly pure; BAND_ICON holds web public paths ('/design/icons/*.webp') - mobile needs require()'d assets. File says it must stay in sync with apps/backend/src/sessions/unlock.ts (candidate to unify).
- `Response types (inline in pages/components)` — PublicProfile, ThemeRow, TimelinePoint (profile page), Row (leaderboard), FriendsList/PendingList/UserCard (friends), SearchResult/FriendshipState (UserSearch, FriendActionButton, friendship.service FriendshipView), Achievement (AchievementCard), Overview (dashboard) — blockers: Duplicated ad hoc between frontend and backend; move into a shared types package (or generate from backend via OpenAPI/zod) so the mobile app does not copy them a third time.

## Haptics opportunities

- Primary 'Start session' CTA on home: impactAsync(Medium) on press.
- Pull-to-refresh threshold crossed on home/profile/friends/leaderboard: impactAsync(Light).
- Segmented style switch and Global/Friends scope toggle on leaderboard, and horizontal swipe between styles: selectionAsync on each change.
- Leaderboard: rigid/light tick when your own row scrolls into view or the sticky 'your rank' row docks.
- Friend request sent (Add): impactAsync(Light); request accepted: notificationAsync(Success); decline/cancel: impactAsync(Soft); unfriend confirm: notificationAsync(Warning).
- Swipe-to-accept/decline on request rows: selection tick when the swipe passes the action threshold.
- Achievement unlock toast / reveal: notificationAsync(Success) (throttled for multi-unlocks), optional heavier pattern for rare ones (peak-2000, streak-100).
- Streak outcome after a session: Success on 'continued'/'started', a distinct soft double-tap on 'frozen' (freeze used), Warning on 'reset'.
- Avatar cropper: soft impact when pinch zoom hits the 1x or 4x clamp; Success after upload completes.
- Profile editor: Success on save, Error + field shake on validation/server error, light tick when a counter hits its limit (40/280).
- Rating history chart scrubbing on profile: selectionAsync when the scrub crosses a data point.
- Long-press on a leaderboard/friend row to peek a profile preview: impactAsync(Medium).

## Push opportunities

- Incoming friend request (hook: FriendshipService.sendRequest after friendship.create) -> notify addressee, actionable buttons Accept/Decline, deep link /friends; also update app icon badge to pending incoming count.
- Friend request accepted (hook: FriendshipService.accept, and the auto-accept branch inside sendRequest) -> notify the original requester, deep link /profile/:nickname.
- Achievement unlocked asynchronously because of someone else's action (accept() computes requesterNew and discards it today) -> push to that user; generally fan out any evaluate() result when the user is not in the foreground.
- Streak at risk: user has streakDays>0 and lastDay == yesterday in their TZ -> evening reminder (best done as LOCAL scheduled notifications via expo-notifications since the server stores no timezone; server-side requires adding a tz column).
- Streak freeze auto-consumed (tickStreak outcome 'frozen') -> informative push/in-app note 'your freeze saved your N-day streak'; freeze regenerated (today >= streakFreezeRegenAt) -> 'freeze is back'.
- Streak broken (next play returns 'reset', or a nightly job detects a gap > 2 days) -> gentle win-back push.
- Streak milestones approaching (e.g. one day before streak-7/30/100) -> motivational reminder.
- Leaderboard overtakes: when a session updates currentPuzzleRating, compare with friends in that style and notify anyone the player just passed ('X overtook you in Blitz'); also 'you entered the global top 100'. Requires computing before/after positions (no rank history today).
- Friend milestones (friend unlocked peak-2000 or streak-30) -> optional social nudge, opt-in only.
- Weekly digest (sessions, rating change, friends' activity) as a lower-priority channel.

## Risks

- No push infrastructure at all: no device-token model, no notification module, no notification preferences, and no scheduler/job queue seen in these files - a backend work item that the mobile app depends on.
- Streak day is client-supplied 'YYYY-MM-DD' and the server stores no timezone: server-side 'streak at risk' pushes are impossible without adding a tz column; leaderboard streak badges compute other users' state against the viewer's local date (wrong across timezones).
- Server never lazily resets broken streaks (streakDays stays stale until next play). Dashboard intentionally shows the broken count; the profile hero shows the stale count with no state check; any new mobile surface must run streakState().
- Avatars are stored on the API host's local disk (process.cwd()/uploads/avatars) and served as static files; uploads are base64 data URLs in JSON (4MB decoded limit, 6mb body limit). Fine for web, but mobile images from modern cameras need client resize first; deploy durability of uploads/ (container redeploys) is unknown; avatarUrl is a relative path, so mobile must prefix API_HOST.
- Public profile endpoints (/users/by-nickname/:nickname, /themes, /timeline) are unauthenticated and use case-sensitive exact nickname lookup while search and isSelf are case-insensitive; deep links with different casing will 404 and also fragment the react-query cache.
- Bug: dashboard 'Sessions' tile shows recentSessions.length, capped at 20 by the backend; lifetime.sessions is already returned but unused.
- Bug: profile page passes onDelete={() => {}} to SessionList, which enables swipe-to-delete on other users' profiles (no-op) and on your own profile (does nothing).
- Bug: UserSearch 'Accept' calls POST /friends/request (server auto-accepts) then marks the row 'outgoing' ('Requested') instead of 'friends', and drops achievementsUnlocked; FriendActionButton accept also never toasts achievements.
- Friends page mutations have no error handling (unhandled promise rejections) and unfriend has no confirmation; UserSearch has no request cancellation, so a slow older response can overwrite newer results.
- Hardcoded English strings outside i18n: UserSearch ('No matches.', 'Friends', 'Requested', 'Accept', 'Add', default placeholder), AvatarCropper ('Crop avatar', 'Cancel', 'Save', error texts), Toast ('Achievement'/'Notice', 'Dismiss'), profile/leaderboard 'Loading…', StreakBadge aria-labels.
- Achievement names/descriptions exist only in the frontend i18n dictionaries; server-side push copy for achievements needs these strings shared or duplicated in the backend.
- Achievement 'customize' criteria compare against schema defaults ('#22c55e' accent, 'blue' board) while the web client defaults to accent '#c72a2f' / board 'stone' and states the accent is fixed by the theme - set-accent may be unreachable and set-board may unlock trivially depending on what the client writes; needs product review before porting the settings screen.
- icons.tsx comment claims a Trophy fallback, but AchievementCard renders a Lock when a slug has no icon even if unlocked (only Toast falls back to Trophy) - keep the registry and icon map in sync or share them.
- Leaderboard returns only top N (max 200) with no viewer rank outside it and no pagination; ranks don't share ties; global board includes every UserStyleProgression row (possibly default-1200 users who never played - unverified).
- N+1 queries: /users/search calls statusWith per hit (10 extra queries); acceptable now but mobile typing with fast debounce could increase load.
- Profile timeline returns up to 365 days of sessions in one payload; the heatmap and chart must render efficiently on mobile (Skia single-canvas rather than hundreds of Views).
- Intl/date formatting with 'uk-UA' (toLocaleDateString, Intl.PluralRules) must be verified on Hermes for both iOS and Android, or replaced with date-fns locale.
- Trust-based 'star the repo' achievement opens an external site from inside the app; App Store review is unlikely to object, but the confirm-without-verification flow may look odd on mobile.
- The stone visual language relies heavily on CSS box-shadow stacks, gradients, textures, text-shadow and Cinzel/Manrope fonts; reproducing it per-row natively can cost FPS in long lists unless baked into image assets.

## Open questions

- Does GET /sessions/:id (linked from public profile session rows) allow viewing other users' sessions, or does it 403/404 for non-owners? (sessions area not read)
- Are UserStyleProgression rows created for all three styles at registration (so never-played users appear in the global leaderboard at 1200)?
- Where is the backend deployed and is apps/backend/uploads on persistent storage? Is moving avatars to object storage (S3/R2) acceptable?
- Is there an existing job queue/scheduler (e.g., BullMQ on the Redis instance) usable for push fan-out and nightly streak checks? Not visible in the files read.
- Should streak reminders be purely local (device-scheduled) or should the server store the user's timezone and send them?
- Should the achievements screen stay as a tab inside analytics on mobile or become its own destination? (analytics/page.tsx belongs to another area)
- What does the web client actually write for accentColor/boardTheme on first settings save - i.e., are set-accent / set-board achievements reachable or trivial?
- Should the creator decoration remain a hardcoded nickname list in the client binary, or move to a server flag (e.g., User.isCreator)?
- Should profiles be shareable/deep-linkable publicly (universal links) given the profile endpoints are already unauthenticated?
- Is a friends-leaderboard 'overtake' notification desired at launch, given it needs before/after rank computation on every session finish?
- Keep the trust-based GitHub star achievement in the mobile app?
