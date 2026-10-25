# Inventory: backend

_Backend (NestJS + Prisma + Redis) as the API for a native Expo/React Native client: full route inventory, auth, data model, infra, and the backend work mobile needs (push, refresh tokens, versioning, rate limiting, uploads, account deletion)_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Global API bootstrap (main.ts / app.module.ts)  ·  complexity S

**Where:** apps/backend/src/main.ts, apps/backend/src/app.module.ts

**Behaviour**

NestFactory.create<NestExpressApplication>(AppModule, { cors: true }) reflects any Origin. Global prefix 'api', so every route is /api/... except static files. Global ValidationPipe({ whitelist: true, transform: true }): unknown body fields are dropped silently with no error (forbidNonWhitelisted is not set), and query strings are transformed. JSON body limit is 6mb (for base64 avatars). Static assets come from process.cwd()/uploads at prefix /uploads/ (outside /api). PORT defaults to 4000. Modules: ConfigModule(global), Prisma, Redis, Puzzles, Auth, Users, Sessions, Review, Analytics, Achievements, Admin. Missing today: helmet, compression, rate limiting, versioning, a health endpoint, 'trust proxy', request logging/Sentry, shutdown hooks. Errors use the Nest default shape { statusCode, message: string | string[], error }. ValidationPipe returns message as an ARRAY of strings; the web client JSON.stringifies non-string messages.

**State & persistence:** Stateless HTTP. No cookies or server sessions anywhere: auth is Authorization: Bearer only, which works as-is on native.

**Web-only deps:** cors: true (has no effect on native clients; keep it while the web app lives); Relative static path /uploads/ that only resolves against the web origin

**Motion & sound:** N/A (backend)

**Mobile mapping:** Add app.enableVersioning({ type: VersioningType.URI, defaultVersion: ['1', VERSION_NEUTRAL] }) so /api/v1/* and the legacy /api/* both work. Add app.set('trust proxy', 1) (needed behind nginx for per-IP throttling), app.enableShutdownHooks(), compression (or gzip in nginx), helmet, and GET /api/health. Consider forbidNonWhitelisted: false (the current default) so newer app builds that send extra settings fields still work against an older backend.

**Why S:** Configuration-only changes in one file plus small dependencies.


## Auth: register / login / me / change-password (JWT, no refresh)  ·  complexity M

**Where:** auth/auth.controller.ts, auth/auth.service.ts, auth/dto.ts, auth/jwt.strategy.ts, auth/auth.module.ts, auth/current-user.decorator.ts, auth/jwt-auth.guard.ts

**Behaviour**

POST /api/auth/register (public) takes RegisterDto { nickname, password, repeatPassword, language? }. Nickname rules: 3-20 chars, /^[A-Za-z0-9_-]+$/, no consecutive _ or - (/^(?!.*[-_]{2}).+$/). Password rules: 8-128 chars, at least one letter, at least one digit. repeatPassword must be 8-128 and equal to password (else 400 'passwords do not match'). language is 'en'|'uk' (optional). A taken nickname gives 400 'nickname already taken'. Nickname uniqueness is CASE-SENSITIVE (Prisma @unique, no lowercasing), so 'Alex' and 'alex' can both exist. Register creates User, UserSetting (with language), UserProgression, and UserStyleProgression rows for bullet/blitz/rapid. bcryptjs cost is 10. It returns { token, user: { id, nickname } }. POST /api/auth/login (public) takes LoginDto { nickname, password } and returns the same shape. Wrong user or password gives 401 'invalid credentials'. Login is case-sensitive. GET /api/auth/me (JwtAuthGuard) returns { id, nickname } decoded from the token with NO DB hit, so it still returns 200 for a deleted user until the token expires. POST /api/auth/change-password (JwtAuthGuard) takes ChangePasswordDto { currentPassword, newPassword (same rules) }. A wrong current password gives 401 'current password is incorrect'. A new password equal to the current one gives 400. Returns { ok: true }. Changing the password does NOT invalidate existing tokens. JWT payload is { sub: userId, nickname }, signed HS256 with JWT_SECRET. It falls back to 'dev-secret' if the env var is missing, both in auth.module.ts and jwt.strategy.ts. expiresIn is JWT_EXPIRES_IN (docker-compose default '7d'). There is no refresh token, logout, revocation, email, password reset (only the admin set-password route and scripts/reset-password.ts), account deletion for users, or OAuth/Apple/Google sign-in. On the web, any 401 with a token in flight clears localStorage 'taktic.token' and runs window.location.replace('/login'), so users are hard-logged-out every 7 days.

**API**

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

**State & persistence:** Web keeps the token in localStorage key 'taktic.token' (apps/frontend/src/lib/api.ts). Server side is stateless.

**Web-only deps:** localStorage token storage; window.location.replace('/login') on 401

**Motion & sound:** N/A (backend). Mobile: success and error haptics on the auth forms.

**Mobile mapping:** Keep the access token in memory and the refresh token in expo-secure-store (Keychain/Keystore). Use a single-flight refresh interceptor in the shared API client: on 401, call POST /auth/refresh once and retry the queued requests; if refresh fails, clear secure-store and reset navigation to the auth stack (no hard reload). Optionally add biometric unlock via expo-local-authentication. A redesigned auth backend is described under 'Refresh tokens / long-lived sessions'.

**Why M:** The endpoints are trivial, but mobile needs a new token lifecycle (refresh, rotation, revocation) and client interceptor logic.


## Users: own profile, settings, profile edit, avatar, reset progress, search, public profile  ·  complexity M

**Where:** users/users.controller.ts, users/users.service.ts

**Behaviour**

GET /api/users/me (JWT) returns { id, nickname, displayName, avatarUrl, bio, country, createdAt, verified, isAdmin, settings: UserSetting row (userId, focusMode, accentColor, boardTheme, pieceSet, soundEnabled, soundPack, language, fixedColor, animationSpeed, knightArrow, showStreak, reviewAutoAdvance, mirrorView, onboardingCompleted), progression: legacy UserProgression row, progressions: { bullet|blitz|rapid: { startPuzzleRating, currentPuzzleRating, unlockedStartRating, calibrationSessionsLeft, weakSessionStreak } } (a missing row is synthesised as 1200/1200/1200/5/0), streak: { days, freezes, lastDay, freezeRegenAt } }. PATCH /api/users/me/settings (JWT) takes UpdateSettingsDto, all fields optional: focusMode bool, accentColor IsHexColor, boardTheme/pieceSet/soundPack free strings, soundEnabled bool, language en|uk, fixedColor auto|white|black, animationSpeed instant|fast|normal|slow, knightArrow bent|straight, showStreak/reviewAutoAdvance/mirrorView/onboardingCompleted bool. It returns the full UserSetting row plus achievementsUnlocked: string[]. Achievement evaluation is awaited, not fire-and-forget as the comment says. PATCH /api/users/me/profile (JWT) takes { displayName? max 40, bio? max 280, country? /^([a-z]{2})?$/i }. An empty string means null, the country is lowercased, and it returns { id, displayName, bio, country, avatarUrl, nickname, achievementsUnlocked }. POST /api/users/me/avatar (JWT) takes { dataUrl } matching /^data:image\/(png|jpeg|webp);base64,/, decoded max 4 MB (MAX_AVATAR_BYTES). It is written to uploads/avatars/{userId}.{png|jpg|webp}, deletes other-extension siblings, and stores avatarUrl = '/uploads/avatars/{file}?v={Date.now()}' (RELATIVE). Returns { avatarUrl, achievementsUnlocked }. There are no magic-byte checks, no resize/strip-EXIF, and no avatar delete route. POST /api/users/me/reset-progress (JWT) runs one transaction that deletes attempts, sessions, puzzle history and review items, resets style progressions to 1200/1200/1200 with weak 0 and calibration 5, resets the legacy progression, and returns { ok: true }. It keeps settings, achievements and streak. GET /api/users/search?q= (JWT) does a case-insensitive prefix search, needs q.trim() of at least 2 chars, returns at most 10, excludes self, orders by nickname. Each row is { id, nickname, displayName, avatarUrl, country, verified, friendship: { state: none|self|outgoing|incoming|friends, friendshipId } }. This costs N+1 statusWith queries. GET /api/users/by-nickname/:nickname is PUBLIC (no guard; the comment's 'optional auth' is not implemented and it returns no friendship state). It returns { id, nickname, displayName, avatarUrl, bio, country, createdAt, verified, progressions, allTimePeak, streak: { days, freezes, lastDay }, recentSessions[10]: { id, startedAt, durationSec, solved, failed, accuracy, avgResponseMs, peakRating, startRating, mode, style, theme } }. An unknown nickname gives 404 'user not found'. GET /api/users/by-nickname/:nickname/themes is PUBLIC and returns ThemeRow[] (all styles). GET /api/users/by-nickname/:nickname/timeline is PUBLIC and returns 365 days of timeline rows. GET /api/users/by-nickname/:nickname/friendship (JWT) returns { state, friendshipId }.

**API**

- `GET /api/users/me`
- `PATCH /api/users/me/settings`
- `PATCH /api/users/me/profile`
- `POST /api/users/me/avatar`
- `POST /api/users/me/reset-progress`
- `GET /api/users/search?q=`
- `GET /api/users/by-nickname/:nickname`
- `GET /api/users/by-nickname/:nickname/themes`
- `GET /api/users/by-nickname/:nickname/timeline`
- `GET /api/users/by-nickname/:nickname/friendship`

**State & persistence:** Server: User, UserSetting, UserStyleProgression; files on the docker volume 'uploads' mounted at /app/apps/backend/uploads. Web mirrors settings in localStorage 'taktic.settings' and 'taktic.lang'.

**Web-only deps:** Relative avatarUrl '/uploads/...' resolved on the web by assetUrl() using API_HOST; Data-URL upload built from a browser FileReader/canvas

**Motion & sound:** N/A (backend). achievementsUnlocked in the responses drives unlock toasts, which are good spots for success haptics.

**Mobile mapping:** Avatar: expo-image-picker, then expo-image-manipulator to resize to 512x512 JPEG at quality 0.8 (well under 4 MB). Either keep the existing data-URL JSON endpoint (base64: true) or, preferably, add POST /api/v1/users/me/avatar as multipart/form-data using Nest FileInterceptor (multer ships with @nestjs/platform-express) and upload with expo-file-system uploadAsync or fetch FormData. Server should validate magic bytes and re-encode with sharp. Return ABSOLUTE avatar URLs (or keep the client-side assetUrl helper with an absolute API host) and render with expo-image (disk cache; ?v= busts it). Settings: add mobile-only fields such as hapticsEnabled, hapticsIntensity and notification preferences (needs a migration and DTO). Optimistic updates via react-query.

**Why M:** Mostly reusable as-is. The avatar pipeline, absolute URLs and new mobile settings columns need small backend changes.


## Friends  ·  complexity S

**Where:** users/friends.controller.ts, users/friendship.service.ts

**Behaviour**

All routes are behind JwtAuthGuard. GET /api/friends returns [{ friendshipId, since: acceptedAt, user: card }] ordered by acceptedAt desc. A card is { id, nickname, displayName, avatarUrl, country, verified }. GET /api/friends/pending returns { incoming: [{ id, createdAt, user }], outgoing: [{ id, createdAt, user }] }. POST /api/friends/request takes { nickname: 3-20 chars, [A-Za-z0-9_-] }. Unknown nickname gives 404, self gives 400, already friends gives 409 'already friends', an outgoing pending request gives 409 'request already pending'. If the target already sent YOU a request, the route auto-accepts it and returns the accept shape. Otherwise it returns { id, status: 'pending', user }. POST /api/friends/:id/accept works only for the addressee; it evaluates achievements for both users and returns { id, status, user: requester card, achievementsUnlocked, _requesterAchievements: number }. The requester's new unlocks are persisted but never surfaced to them until they load the achievements page; a push should cover that. DELETE /api/friends/:id declines an incoming request or cancels an outgoing one (pending only), returns { ok: true }. DELETE /api/friends/by-user/:otherId removes an accepted friendship. There is no realtime channel (no websockets or SSE), so incoming requests appear only on refetch.

**API**

- `GET /api/friends`
- `GET /api/friends/pending`
- `POST /api/friends/request`
- `POST /api/friends/:id/accept`
- `DELETE /api/friends/:id`
- `DELETE /api/friends/by-user/:otherId`

**State & persistence:** Friendship table (status pending|accepted, @@unique(requesterId, addresseeId)).

**Motion & sound:** N/A (backend). Mobile: haptics on send, accept and swipe-to-decline.

**Mobile mapping:** Reuse unchanged. Add push triggers: friend_request_received (on create, to the addressee) and friend_request_accepted (on accept, to the requester, including requesterNew achievements). Push data should carry a deep link (tactictak://friends) and the app should invalidate the react-query friends keys when a notification arrives in the foreground.

**Why S:** The API is already sufficient. Only the push hooks are new.


## Leaderboard  ·  complexity S

**Where:** users/leaderboard.controller.ts, users/leaderboard.service.ts

**Behaviour**

GET /api/leaderboard?style=bullet|blitz|rapid&scope=global|friends&limit= (JWT). An invalid style falls back to blitz. limit is clamped to 1..200, default 100. The friends scope includes the viewer. Ordering is currentPuzzleRating desc, then updatedAt asc. Each row is { rank, rating, unlocked, isSelf, streakDays, streakLastDay, user: { id, nickname, displayName, avatarUrl, country, verified } }. There is no pagination cursor, and the viewer's own rank is not returned if outside the top N.

**API**

- `GET /api/leaderboard?style=&scope=&limit=`

**State & persistence:** Reads UserStyleProgression joined with User.

**Motion & sound:** N/A (backend)

**Mobile mapping:** Reuse unchanged. Render with FlashList. Optionally add a 'myRank' field so the viewer row can be pinned even outside the top 100. A possible push is 'friend overtook you', which needs tracking of previous ranks.

**Why S:** Reusable as-is.


## Training sessions API (create / next / attempt / finish / detail / review-items / delete)  ·  complexity M

**Where:** sessions/sessions.controller.ts, sessions/sessions.service.ts, sessions/dto.ts, sessions/rating.ts, sessions/unlock.ts, sessions/streak.ts

**Behaviour**

All routes are behind JwtAuthGuard and are owner-checked: another user's session gives 404 'session not found'.

POST /api/sessions takes CreateSessionDto { startRating int 400-3000, durationSec int 60-3600, mode 'mixed'|'theme', style 'bullet'|'blitz'|'rapid', theme? }. If mode != theme and calibrationSessionsLeft > 0, the client's startRating is IGNORED and currentPuzzleRating is used instead. In stable mode, startRating > unlockedStartRating + 200 gives 400. Rated sessions set currentPuzzleRating = startPuzzleRating = startRating. The first puzzle is popped synchronously and startedAt is reset to NOW. Returns { sessionId, startedAt, durationSec, style, firstPuzzle: { puzzle: CachedPuzzle, currentRating, session: { id, startedAt, durationSec, style, mode } } | null }. If firstPuzzle is null, the client falls back to /next.

POST /api/sessions/:id/next gives 400 if the session has ended. If there are 0 attempts it resets startedAt again. It serves at session.startRating for theme mode, else at currentPuzzleRating. Returns { puzzle: { id, fen, moves: string[], rating, themes: string[], gameUrl }, currentRating, session }. An empty pool gives 404 'no puzzles available'. It is NOT idempotent: each call RPOPs a puzzle, so a retried request skips one.

POST /api/sessions/:id/attempt takes AttemptDto { puzzleId, correct bool, responseMs 0-600000 }. It records a TrainingAttempt, upserts UserPuzzleHistory, upserts a ReviewItem (resolvedAt null) if wrong, and counts the current correct streak (last 50). Theme mode returns { newRating: startRating, step: 0, streak }. Rated mode computes computeRatingStep over the last WINDOW=4 attempts, clamps the new rating to 400-3000, and returns { newRating, step, streak }. There is no idempotency key, so a mobile retry double-records the attempt. The solution moves are trusted to the client, which validates locally.

POST /api/sessions/:id/finish?save=true|false&localDate=YYYY-MM-DD. If the session already ended it returns the summary. save=false (discard) restores the style rating to session.startRating, deletes ReviewItems created during the session, clears Redis, deletes the session, and returns { discarded: true }. save=true derives stats (solved, failed, accuracy, avgResponseMs, peakRating), sets endedAt, and ticks the streak via applyStreakOnPlay if localDate is valid (else streak: null). Theme mode returns summary + { unlocked: false, streak, achievementsUnlocked, style }. Early exit (server elapsed < durationSec - 3s grace) returns summary + { unlocked: false, early: true, streak, achievementsUnlocked, style }. Calibration (calibrationSessionsLeft > 0) uses evaluateCalibration with step ladder [-125, -50, 0, +50] by criteria met, snapped to 50, floored at startPuzzleRating; delta > 0 gives unlocked, delta < 0 gives demoted with demoteCheck { atPeak: true, weak: true, threshold: 1, ... }. Stable mode: unlocked = all 3 criteria met AND startRating >= ceiling - 50 (DEMOTE_PEAK_BAND), reward +50 (UNLOCK_REWARD). Demote: 2 weak at-peak sessions (<=1 criterion met) cost -25, clamped at startPuzzleRating. The full response is summary { sessionId, solved, failed, accuracy, avgResponseMs, peakRating, durationSec, style } + { unlocked, unlockCheck: { met, style, solvedTarget, criteria[{ id: solved|accuracy|peak, met, current, target }] }, demoted, demoteCheck, calibration: { active, sessionsLeftBefore, sessionsLeftAfter, ceilingBefore, ceilingAfter, delta } | null, streak: { days, freezes, lastDay, freezeRegenAt, outcome: same-day|continued|frozen|reset|started } | null, achievementsUnlocked: string[], style }.

GET /api/sessions/:id returns { id, startedAt, endedAt, mode, theme, durationSec, startRating, endRating, peakRating, solved, failed, accuracy, avgResponseMs, attempts: [{ id, puzzleId, puzzleRating, correct, responseMs, createdAt }] }. GET /api/sessions/:id/review-items flags failed attempts, plus slow solves where responseMs > max(1.5 x session avg, 5000ms). It returns { items: [{ puzzleId, reason: failed|slow, responseMs, rating, fen, moves: STRING (space-joined; inconsistent with the array elsewhere), themes }] }. DELETE /api/sessions/:id deletes with cascade and returns { ok: true }.

There is NO paginated session-list endpoint: history comes only from /analytics recentSessions (last 20) and the public profile (last 10). Abandoned sessions (app killed, never finished) stay with endedAt null forever, their Redis keys never expire, and the streak is not ticked.

**API**

- `POST /api/sessions`
- `POST /api/sessions/:id/next`
- `POST /api/sessions/:id/attempt`
- `POST /api/sessions/:id/finish?save=&localDate=`
- `GET /api/sessions/:id`
- `GET /api/sessions/:id/review-items`
- `DELETE /api/sessions/:id`

**State & persistence:** Postgres: TrainingSession, TrainingAttempt, UserPuzzleHistory, ReviewItem, UserStyleProgression, User streak columns. Redis: session:{sid}:queue, session:{sid}:seen, user:{uid}:recent. Web localStorage: 'taktic.lastStyle', 'taktic.lastDurations' (play setup).

**Web-only deps:** The client computes localDate itself (formatLocalDate in play/[id]/page.tsx)

**Motion & sound:** N/A (backend). The response fields drive the key haptic moments: attempt.correct / step / streak (light or success impact per move, escalating on streak), finish.unlocked (celebration notification haptic), demoted (warning), streak.outcome 'frozen' or 'continued'.

**Mobile mapping:** Keep the shapes. Mobile hardening: (1) add an optional client attemptId (cuid) to AttemptDto with a unique constraint, so a retry is a no-op; (2) handle AppState background: the timer is server-anchored on startedAt, so on resume the client computes the remaining time and calls finish if expired; (3) add EXPIRE on session:{sid}:queue and :seen (durationSec + 1h) plus a cron sweeper that finalises or deletes sessions with endedAt null older than durationSec + grace; (4) add GET /api/v1/sessions?cursor=&style= for a paginated history list (FlashList infinite scroll); (5) make review-items moves an array in v1. Prefetch: the client can call /next while the current puzzle animates, to hide latency.

**Why M:** Contract reusable, but mobile needs idempotency, an abandoned-session lifecycle, pagination and background handling. The rating, unlock and streak logic is pure and stays.


## Puzzle buffer (Redis-backed selector)  ·  complexity S

**Where:** puzzles/puzzle-buffer.service.ts, redis/redis.service.ts, redis/redis.module.ts

**Behaviour**

TARGET_SIZE=12, REFILL_BELOW=6, RECENT_TTL_S=30 days. Buckets per preload: 60% normal (7 puzzles, rating-40..rating+60; the comment says +-40), 25% easier (3, rating-120..rating-40), 15% harder (2, rating+60..rating+180). Quality filter is popularity >= 95 AND nbPlays >= 1000 (about 535k of 4.4M puzzles). It uses ORDER BY random() LIMIT count*4 per bucket, optionally joined to Theme by slug. Exclusions come from the session seen set plus the user's recent zset (no trimming beyond TTL; the zset grows for 30 days and is fetched whole with zrange 0 -1 on each preload). Hydration is one findMany. The queue holds full JSON (LPUSH, then RPOP), so getNext is O(1) once warm. A cold queue triggers a synchronous preload, and a background refill runs when len-1 <= 6. Keys: session:{sid}:queue (list), session:{sid}:seen (set), user:{uid}:recent (zset, EXPIRE 30d refreshed per serve). clearSession deletes queue and seen on finish. RedisService uses ioredis with REDIS_URL (default redis://localhost:6379; .env.example uses 6380), lazyConnect: false, maxRetriesPerRequest: null. The Redis client is only used here, not for caching or rate limits yet.

**State & persistence:** Redis keys listed above. The session queue and seen keys have NO TTL.

**Motion & sound:** N/A

**Mobile mapping:** No client change. The same Redis can back @nestjs/throttler storage, BullMQ queues for push jobs, refresh-token reuse detection, and push dedupe keys. Add TTLs to the session keys. Consider ZREMRANGEBYSCORE on user:{uid}:recent to bound its size for heavy mobile users.

**Why S:** Works for mobile unchanged. Only TTL hygiene is needed.


## Review queue  ·  complexity S

**Where:** review/review.controller.ts, review/review.service.ts

**Behaviour**

All routes are behind JwtAuthGuard. GET /api/review?theme= returns the unresolved items [{ id, puzzleId, createdAt, rating, fen, setupMove: moves[0], themes }]. With a theme filter they are sorted by rating asc. Without one they are grouped by primaryTheme (the first non-meta slug; meta-only items sort last via '￿') and then by rating. GET /api/review/themes returns [{ slug, count, minRating }], skipping 15 META_THEME_SLUGS (opening, middlegame, endgame, oneMove, short, long, veryLong, master, masterVsMaster, superGM, advantage, crushing, equality, mate, puzzle), sorted by count desc then slug. GET /api/review/:puzzleId returns the full puzzle { id, fen, moves[], rating, themes, gameUrl } only if it is in the user's queue (else 404 'not in review queue'). POST /api/review/:puzzleId/resolve sets resolvedAt and returns { ok: true }. A missing item makes it throw a Prisma P2025 error, giving a 500, not a 404.

**API**

- `GET /api/review?theme=`
- `GET /api/review/themes`
- `GET /api/review/:puzzleId`
- `POST /api/review/:puzzleId/resolve`

**State & persistence:** ReviewItem (@@unique userId+puzzleId, resolvedAt nullable).

**Motion & sound:** N/A (backend)

**Mobile mapping:** Reuse. Map P2025 to 404 on resolve. A good push candidate is a daily or weekly 'N puzzles waiting in review' reminder.

**Why S:** Reusable as-is.


## Analytics  ·  complexity S

**Where:** analytics/analytics.controller.ts, analytics/analytics.service.ts

**Behaviour**

All routes are behind JwtAuthGuard. They take an optional ?style= (an invalid value means all styles). GET /api/analytics returns { recentSessions[20]: { id, startedAt, solved, failed, accuracy, avgResponseMs, peakRating, startRating, durationSec, mode, style, theme }, allTimePeak, lifetime: { solved, attempts, accuracy, peakRating, sessions } }. GET /api/analytics/themes returns ThemeRow[] { slug, attempts, failures, avgResponseMs, failureRate, weakness = 0.7*failureRate + 0.3*(avgMs/maxAvg), rating = P90 of solved puzzleRating }, only for themes with at least 3 attempts (raw SQL). GET /api/analytics/recommendations returns { theme: slug|null, reason: English string } (not i18n-ready). GET /api/analytics/timeline?days= (1..730, default 365) returns [{ id, endedAt, style, startRating, peakRating, solved, durationSec }] ordered by endedAt asc. The client buckets these by local day for the heatmap.

**API**

- `GET /api/analytics?style=`
- `GET /api/analytics/themes?style=`
- `GET /api/analytics/recommendations?style=`
- `GET /api/analytics/timeline?style=&days=`

**State & persistence:** Read-only aggregates over TrainingSession and TrainingAttempt.

**Motion & sound:** N/A (backend)

**Mobile mapping:** Reuse unchanged. Charts go to victory-native, react-native-skia or react-native-svg. The recommendations 'reason' is hard-coded English; return structured fields (weakness, failureRate, avgMs) so mobile can localise. Timeline payloads can be up to 730 days, so gzip matters on cellular.

**Why S:** Reusable. Only a small i18n-friendly tweak is suggested.


## Achievements  ·  complexity S

**Where:** achievements/achievements.controller.ts, achievements/achievements.service.ts, achievements/registry.ts

**Behaviour**

All routes are behind JwtAuthGuard. GET /api/achievements returns the catalogue of 23 defs [{ slug, category: customize|play|skill|streak|social, icon (lucide-react icon name), unlocked, unlockedAt }]. POST /api/achievements/evaluate returns { newly: string[] }; the web calls it on achievements page mount as a catch-all. POST /api/achievements/star-confirm sets User.starredRepo = true (trust-based) and returns { newly }. The 23 slugs: set-accent, set-board, set-language, set-avatar, set-bio, set-country, first-session, ten-sessions, hundred-sessions, solve-100, solve-1000, triple-style, calibration-done, peak-1500, peak-1800, peak-2000, streak-3, streak-7, streak-30, streak-100, first-friend, five-friends, star-repo. Defaults used for detection: accent '#22c55e', board 'blue', language 'en'. evaluate() runs inline from sessions.finish, users.updateSettings, updateProfile, setAvatar, and friendship.accept (for both users).

**API**

- `GET /api/achievements`
- `POST /api/achievements/evaluate`
- `POST /api/achievements/star-confirm`

**State & persistence:** UserAchievement (userId, slug, unlockedAt).

**Web-only deps:** Icon names are lucide-react; mobile needs lucide-react-native, which uses the same names

**Motion & sound:** N/A (backend). Unlocks are celebration moments (success haptic plus animation).

**Mobile mapping:** Reuse. Use lucide-react-native for icons. The star-repo achievement opens GitHub via Linking or expo-web-browser. Send a push for achievements unlocked off-device (e.g. the requester's first-friend on accept). App Store review may question 'star our repo' rewards, so treat it as a risk.

**Why S:** Reusable as-is.


## Puzzle read-only view  ·  complexity S

**Where:** puzzles/puzzles.controller.ts, puzzles/puzzles.service.ts

**Behaviour**

GET /api/puzzles/:puzzleId (JWT) returns { id, fen, moves[], rating, themes, gameUrl } only if the user has a TrainingAttempt for that puzzle (else 404). This prevents leaking solutions of puzzles still ahead of the user. It is used when re-solving or stepping through a session's attempt.

**API**

- `GET /api/puzzles/:puzzleId`

**State & persistence:** None.

**Motion & sound:** N/A

**Mobile mapping:** Reuse. The response is small and immutable, so cache it aggressively in react-query (staleTime Infinity) and optionally persist it via MMKV.

**Why S:** Reusable as-is.


## Admin  ·  complexity S

**Where:** admin/admin.controller.ts, admin/admin.guard.ts, admin/admin.service.ts

**Behaviour**

AdminGuard extends AuthGuard('jwt'), then re-reads User.isAdmin from the DB on every request (403 if false). GET /api/admin/me returns { id, nickname, isAdmin: true }. GET /api/admin/users?q=&limit=(<=100, default 50)&offset= returns { total, limit, offset, users: [{ id, nickname, displayName, avatarUrl, country, createdAt, isAdmin, verified, sessionCount, attemptCount, lastSessionAt }] }. DELETE /api/admin/users/:id refuses self-delete (403) and returns 404 if missing, else { ok: true }. POST /api/admin/users/:id/password takes { password min 8 } (only length is checked, unlike register) and returns { ok, nickname }. GET /api/admin/activity?days=(<=365, default 30) returns { days, totals: { totalUsers, sessionsToday (uses the server's local midnight), dau7, mau30 }, daily: [{ day, signups, sessions, activeUsers }], recent[20] }. isAdmin and verified are flipped manually in the DB.

**API**

- `GET /api/admin/me`
- `GET /api/admin/users?q=&limit=&offset=`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/password`
- `GET /api/admin/activity?days=`

**State & persistence:** Reads User, TrainingSession.

**Motion & sound:** N/A

**Mobile mapping:** Optional on mobile: either a hidden admin stack in the app, or keep a tiny web admin. A natural extension is an admin 'send test push' and a 'broadcast notification' endpoint.

**Why S:** Low priority. Reusable as-is.


## Data model (Prisma schema)  ·  complexity M

**Where:** apps/backend/prisma/schema.prisma, 27 migrations under apps/backend/prisma/migrations

**Behaviour**

The schema has 13 models. User: id cuid, nickname unique, passwordHash, displayName?, avatarUrl?, bio?, country? (ISO alpha-2, stored lowercase), createdAt/updatedAt, streakDays (0), streakFreezes (1), streakLastDay? (YYYY-MM-DD), streakFreezeRegenAt?, verified, isAdmin, starredRepo. UserSetting: 1:1 with the defaults focusMode false, accentColor #22c55e, boardTheme blue, pieceSet maestro, soundEnabled true, soundPack wood, language en, fixedColor auto, animationSpeed normal, knightArrow bent, showStreak true, reviewAutoAdvance false, mirrorView false, onboardingCompleted false. UserStyleProgression: PK userId+style, start/current/unlocked default 1200, weakSessionStreak 0, calibrationSessionsLeft 5. UserProgression is legacy. Puzzle: Lichess id, fen, moves (space-separated UCI), rating, ratingDeviation, popularity, nbPlays, gameUrl; indexes on rating and (rating, popularity). Theme: slug unique. PuzzleTheme: join table. TrainingSession: mode, style, theme?, startRating, durationSec, startedAt, endedAt?, aggregates; indexes (userId, startedAt) and (userId, style, startedAt). TrainingAttempt. UserPuzzleHistory. Friendship. UserAchievement. ReviewItem. All child relations use onDelete Cascade from User, so account deletion is a single delete. NO timezone, email, device, push-token, refresh-token or notification-preference columns exist.

**State & persistence:** PostgreSQL 16 on the docker volume pgdata. Migrations apply on container start (npx prisma migrate deploy).

**Motion & sound:** N/A

**Mobile mapping:** New models needed (see the push and auth features): PushDevice, RefreshToken (or Session), NotificationPreference (or columns on UserSetting), NotificationLog, plus User.timezone (IANA string) and User.tokenVersion. All should be additive migrations, which are safe for the live web app.

**Why M:** Additive migrations only, but several new tables with indexes.


## NEW: Push device registration (model + endpoints)  ·  complexity M

**Where:** new: apps/backend/src/notifications/devices.controller.ts, new: PushDevice Prisma model

**Behaviour**

Proposed model: PushDevice { id cuid, userId FK cascade, expoPushToken String @unique ('ExponentPushToken[...]'), platform 'ios'|'android', deviceId? (expo-application id, for one-row-per-install), appVersion, buildNumber, osVersion?, locale ('en'|'uk'), timezone (IANA, from expo-localization getCalendars()[0].timeZone), enabled Boolean, lastSeenAt, createdAt, invalidatedAt? } with @@index([userId]). Endpoints: POST /api/v1/devices (JWT) upserts by token; if the token belonged to another user it is re-assigned, which handles shared phones and account switches. It is called after login, on app start when the token changes (Notifications.addPushTokenListener), and when permission is granted. DELETE /api/v1/devices/:token (JWT) is called on logout BEFORE dropping the access token. PATCH /api/v1/devices/:token updates timezone, locale and appVersion on foreground. Also: GET and PATCH /api/v1/users/me/notifications for preferences { streakReminder: bool, streakReminderHour: 0-23 (default about 19-20 local), friendRequests: bool, friendAccepted: bool, achievements: bool, reviewReminder: bool, weeklySummary: bool, quietHoursStart/End? }. User.timezone should also be stored (last reported) so streak and day logic does not depend only on the client's localDate.

**API**

- `POST /api/v1/devices`
- `PATCH /api/v1/devices/:token`
- `DELETE /api/v1/devices/:token`
- `GET /api/v1/users/me/notifications`
- `PATCH /api/v1/users/me/notifications`

**State & persistence:** Postgres PushDevice and NotificationPreference (or columns on UserSetting). The client keeps the last-registered token in MMKV or secure-store to avoid re-posting.

**Motion & sound:** N/A (backend)

**Mobile mapping:** expo-notifications (getExpoPushTokenAsync({ projectId }) and the permission flow with a soft pre-prompt screen; on iOS ask only after the first finished session for a higher opt-in rate), expo-device (skip on simulators), expo-localization (tz and locale), expo-application (version and build). Android notification channels: 'streak', 'social', 'achievements'.

**Why M:** New module, model, migration and 4-5 endpoints. Straightforward, but token-ownership edge cases (shared device, logout, reinstall) need care.


## NEW: Notification scheduler and sender (Expo Push Service)  ·  complexity L

**Where:** new: apps/backend/src/notifications/push.service.ts, new: notifications/scheduler.service.ts, new: NotificationLog model

**Behaviour**

Sender: use the Expo Push Service via expo-server-sdk (Node). It handles APNs and FCM v1 behind one token type, chunks up to 100 per request, and returns tickets. A receipts poll job (about 15 min later) checks tickets, and a 'DeviceNotRegistered' result marks the PushDevice invalid or deletes it. Credentials (APNs .p8 key, FCM v1 service-account JSON) are uploaded to EAS and the backend only needs an optional EXPO_ACCESS_TOKEN (enable 'enhanced push security'). Talking to FCM/APNs directly (firebase-admin plus node-apn) only makes sense if you leave Expo or need rich iOS features unsupported by Expo; not recommended now. Triggers: (1) event-driven, sent inline or via a queue: friend_request_received (friendship.sendRequest create path), friend_request_accepted (friendship.accept, to the requester, including requesterNew achievements), achievement_unlocked when it happened off-device; (2) scheduled: streak_at_risk — every 15 min a cron selects users with streakDays > 0 where the local date in User.timezone != streakLastDay and local time is at least the preferred reminder hour (default about 19:00-20:00) and before 22:00, deduped by Redis SETNX key push:streak:{uid}:{localDate} with a 48h TTL; streak_freeze_used (the next app-open shows it, or a push when the freeze auto-consumes; note that freezes are applied lazily at the next play, so 'freeze consumed' is only known then — a push at local midnight+1 would need server-side simulation of applyStreakOnPlay); freeze_regenerated (local date >= streakFreezeRegenAt); review_backlog (weekly, when unresolved ReviewItem count >= N); weekly_summary; inactivity win-back (3/7/14 days). Implementation: @nestjs/schedule for cron (single backend container today), plus BullMQ on the existing Redis for delayed and retried sends if more than one instance is ever run (otherwise cron runs N times; use a Redis lock). Payload: { title, body (localised server-side from User/Device locale en|uk; needs a small server i18n table), data: { type, url: 'tactictak://...', ids }, sound: 'default', channelId, badge? }. Respect quiet hours and preferences, and log to NotificationLog { userId, type, sentAt, ticketId, status } for rate capping (for example at most 1 streak push per day and at most 3 pushes per day total).

**API**

- `(internal) Expo Push API https://exp.host/--/api/v2/push/send via expo-server-sdk`
- `(internal) receipts https://exp.host/--/api/v2/push/getReceipts`
- `optional: POST /api/v1/admin/push/test`

**State & persistence:** Postgres NotificationLog. Redis dedupe keys push:{type}:{uid}:{localDate}, a cron lock, and BullMQ queues.

**Motion & sound:** Push sound 'default' or a custom bundled sound (requires the expo-notifications plugin 'sounds' config). Foreground notifications get an in-app toast plus light haptic instead of a system banner.

**Mobile mapping:** Client: Notifications.setNotificationHandler for the foreground, addNotificationResponseReceivedListener to deep-link (expo-router Linking), and getLastNotificationResponseAsync for cold start. Optional local notifications (Notifications.scheduleNotificationAsync) for the streak reminder as an offline fallback: schedule at 20:00 local each day and cancel when today's session finishes. This gives reminders without any server work and is a cheap phase-1 option.

**Why L:** New subsystem: sender, receipts handling, timezone-aware cron, dedupe, preferences, server-side i18n, and deep-link contracts.


## NEW: Refresh tokens / long-lived sessions + secure storage  ·  complexity L

**Where:** auth/auth.service.ts (extend), auth/auth.controller.ts (extend), new: RefreshToken Prisma model

**Behaviour**

Today there is only a 7d access JWT and no refresh, so mobile users would be logged out weekly, which is unacceptable. Proposal: access JWT 15-60 min (payload { sub, nickname, tv: tokenVersion }). Refresh token: opaque 256-bit random string, stored as a SHA-256 hash in RefreshToken { id, userId, familyId, tokenHash unique, deviceId?/pushDeviceId?, userAgent/platform, createdAt, lastUsedAt, expiresAt (sliding 60-90 days), revokedAt?, replacedById? }. POST /api/v1/auth/refresh { refreshToken } rotates it (issues a new pair, revokes the old one). Reuse of a revoked token revokes the whole family (theft detection). POST /api/v1/auth/logout { refreshToken } revokes it (plus the device unregister). POST /api/v1/auth/logout-all bumps User.tokenVersion and revokes all refresh tokens; change-password should also do this, except for the current session. Login and register return { token, refreshToken, expiresIn, user } (keep 'token' for the web app). JwtStrategy.validate should check tokenVersion; that is one DB or Redis lookup per request, and can be cached in Redis. Also: fail fast at boot if JWT_SECRET is missing instead of falling back to 'dev-secret'. Optional: Sign in with Apple and Google (expo-apple-authentication, @react-native-google-signin); Apple requires Sign in with Apple only if third-party login is offered, and nickname/password alone does not trigger that.

**API**

- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `(changed) POST /api/v1/auth/login`
- `(changed) POST /api/v1/auth/register`
- `(changed) POST /api/v1/auth/change-password`

**State & persistence:** Postgres RefreshToken and User.tokenVersion. Client: refresh token in expo-secure-store (keychainAccessible AFTER_FIRST_UNLOCK so background fetches work), access token in memory or zustand (not persisted).

**Web-only deps:** localStorage 'taktic.token' (web only, to be retired)

**Motion & sound:** N/A

**Mobile mapping:** Shared API client with a single-flight refresh mutex, a pre-emptive refresh when exp is within 60s, and a retry of the original request. On refresh failure, clear SecureStore and router.replace('/(auth)/login'). Secure-store calls are async, so hydrate auth at the splash screen (expo-splash-screen preventAutoHideAsync).

**Why L:** Security-sensitive: rotation, reuse detection, tokenVersion invalidation, migration, a client interceptor, and backwards compatibility with the web.


## NEW: Absolute API base URL, asset URLs, deep links (web-only assumptions)  ·  complexity S

**Where:** apps/frontend/src/lib/api.ts (reference), deploy/nginx.conf, users/users.service.ts setAvatar

**Behaviour**

The web build bakes NEXT_PUBLIC_API_URL='/api' (relative, same-origin through nginx). In local dev the URL is derived from window.location.hostname:4000. Avatar URLs are stored RELATIVE ('/uploads/avatars/{id}.jpg?v=ts') and resolved with assetUrl() against API_HOST. Native has no origin, so the app must use an absolute base URL https://tactictak.online/api (v1) from app.config.ts extra or EXPO_PUBLIC_API_URL per EAS profile (dev: LAN IP, preview, prod). Server-side option: return absolute URLs by adding a PUBLIC_ASSET_BASE env and mapping avatarUrl in serializers; or keep relative URLs and share an assetUrl(base, path) helper. nginx: /api/ and /uploads/ proxy to the backend; / goes to the Next frontend. When the web app is retired, / still needs a minimal landing page, plus /.well-known/apple-app-site-association and /.well-known/assetlinks.json (today /.well-known/ only serves acme-challenge) for universal and app links, so shared links like https://tactictak.online/profile/{nickname} open the app. There is no gzip in nginx.conf: add gzip on with gzip_types application/json, which matters for timeline and analytics payloads on cellular. HSTS is set. client_max_body_size is 8m.

**State & persistence:** Config only.

**Web-only deps:** NEXT_PUBLIC_API_URL relative '/api'; window.location-derived API host; Relative /uploads paths; Next.js frontend served at / by nginx

**Motion & sound:** N/A

**Mobile mapping:** expo-constants or EXPO_PUBLIC_API_URL per EAS build profile. expo-router deep-link scheme 'tactictak' plus associatedDomains (iOS) and intentFilters (Android) in app.config. In development, use a tunnel or LAN IP; Android blocks cleartext http unless usesCleartextTraffic is set for the dev build.

**Why S:** Mostly config: nginx additions, an env var, and one serializer change.


## NEW: API versioning + app-config / force-update  ·  complexity M

**Where:** main.ts, new: apps/backend/src/app-config/app-config.controller.ts

**Behaviour**

App binaries live for months, so breaking changes must not break old builds. Use Nest URI versioning with /api/v1 for mobile while keeping the unversioned /api for the web via VERSION_NEUTRAL or defaultVersion. Rules: only additive changes within v1; breaking changes go to v2 controllers side by side. The client sends headers X-App-Version, X-App-Build, X-Platform (ios|android) and optionally X-Device-Id, logged with middleware for analytics. GET /api/v1/app-config (public) returns { minSupportedBuild: { ios, android }, latestBuild, forceUpdate: bool, storeUrls, featureFlags: {...}, maintenance?: { message } }. The app checks it at launch and on foreground and shows a blocking 'update required' screen when needed. A 426 Upgrade Required response from a middleware for builds below the minimum is the belt-and-braces path. Pair this with expo-updates (EAS Update) using runtimeVersion policy 'fingerprint' or 'appVersion', so JS-only fixes ship OTA without store review.

**API**

- `GET /api/v1/app-config`
- `(all routes) /api/v1/*`

**State & persistence:** app-config values in env or a small DB or Redis table. The client caches the last config in MMKV.

**Motion & sound:** N/A

**Mobile mapping:** expo-application for nativeBuildVersion, expo-updates for OTA, Linking.openURL to the store.

**Why M:** A small amount of code, but it establishes a contract discipline that every later change depends on.


## NEW: Rate limiting and hardening  ·  complexity M

**Where:** main.ts, app.module.ts, auth/*, deploy/nginx.conf

**Behaviour**

Nothing is throttled today: bcrypt login is brute-forceable, /auth/register can be spammed (no captcha or email), /users/search is open to enumeration, and the public /users/by-nickname/* routes are scrapeable. Add @nestjs/throttler with Redis storage (@nest-lab/throttler-storage-redis or a custom ioredis store). Suggested limits: global about 120 requests/min per user or IP; /auth/login 5/min per IP and 10/hour per nickname with exponential backoff; /auth/register 3/hour per IP; /auth/refresh 30/min; /users/search 30/min; /users/me/avatar 10/hour; /friends/request 30/hour. This requires app.set('trust proxy', 1) because nginx sets X-Forwarded-For; otherwise every request looks like it comes from the nginx container IP. Optionally add nginx limit_req_zone for /api/auth/. Other items: helmet, a JWT_SECRET required check at boot, avatar magic-byte validation with sharp re-encode, P2025 mapped to 404 by a global Prisma exception filter (it currently surfaces as 500 on review resolve), and Sentry (@sentry/nestjs on the backend, @sentry/react-native on mobile).

**State & persistence:** Redis throttler counters.

**Motion & sound:** N/A

**Mobile mapping:** The client handles 429 with a Retry-After header: a friendly toast plus a warning haptic, and no automatic retry storm. Mobile IPs are carrier-NAT shared, so prefer per-user or per-nickname keys over pure IP keys for authenticated routes.

**Why M:** Library-driven, but needs a proxy-trust fix, per-route tuning and an exception-filter cleanup.


## NEW: In-app account deletion + data export (store requirements)  ·  complexity S

**Where:** new route in users.controller.ts

**Behaviour**

The App Store (guideline 5.1.1(v)) and Google Play require in-app account deletion. Today only an admin can delete (DELETE /api/admin/users/:id). Add DELETE /api/v1/users/me with { password } confirmation: delete the User (all relations cascade), delete the avatar files uploads/avatars/{id}.*, revoke refresh tokens and push devices, and return 204. The Play Store also requires a web URL for deletion requests, which can be a minimal page that stays on the retired web domain. Optional: GET /api/v1/users/me/export for GDPR.

**API**

- `DELETE /api/v1/users/me`
- `optional GET /api/v1/users/me/export`

**State & persistence:** Cascade deletes, plus avatar file removal from the uploads volume.

**Motion & sound:** Mobile: a destructive confirm with a long-press or typed confirmation and a heavy haptic.

**Mobile mapping:** Settings, then a Danger zone screen. Clear SecureStore, MMKV and the react-query cache afterwards.

**Why S:** The schema already cascades. This is one endpoint plus file cleanup, but it blocks store release.


## NEW: Session-lifecycle robustness for mobile networks  ·  complexity M

**Where:** sessions/sessions.service.ts, puzzles/puzzle-buffer.service.ts

**Behaviour**

Mobile adds flaky networks, backgrounding and app kills. Gaps: (1) /attempt has no idempotency, so a retry after a timeout double-records the attempt and double-steps the rating; add attemptId with a unique constraint or an Idempotency-Key header with a Redis cache of the response for 24h. (2) /next is a destructive RPOP, so a retry loses a puzzle. This is acceptable, but an optional clientRequestId could return the same puzzle. (3) Abandoned sessions have endedAt null forever and their Redis queue and seen keys have no TTL. Add EXPIRE and a cron that auto-finishes (save=true, early) or deletes stale sessions; decide how the streak is handled in that case. (4) The finish streak tick depends on the client's localDate; also accept the device timezone as a fallback to compute it server-side. (5) The early-exit check uses server elapsed time with a 3s grace, so a backgrounded app that returns after the timer correctly gets a full-duration finish. (6) An offline queue (persist pending attempts in MMKV and flush on reconnect) needs the attempt endpoint to accept a client-side createdAt or ordering, because the rating window ordering uses server createdAt.

**API**

- `POST /api/sessions/:id/attempt (add attemptId)`
- `POST /api/sessions/:id/finish (add tz fallback)`
- `new GET /api/v1/sessions?cursor=`

**State & persistence:** A new unique column TrainingAttempt.clientAttemptId (nullable), and Redis idempotency keys.

**Motion & sound:** N/A

**Mobile mapping:** @react-native-community/netinfo for connectivity, the react-query onlineManager, and AppState listeners for background and foreground transitions.

**Why M:** Touches the core rating path. Changes must preserve the exact rating semantics.


## CI / deploy / monorepo impact of adding apps/mobile  ·  complexity M

**Where:** .github/workflows/ci.yml, docker-compose.yml, apps/backend/Dockerfile, pnpm-workspace.yaml

**Behaviour**

CI build job (ubuntu, pnpm 9.12.0, node 20): pnpm install --frozen-lockfile || pnpm install (the fallback hides lockfile drift), then prisma generate, pnpm -r run typecheck, pnpm -r run build. The deploy job (main only) uses appleboy/ssh-action to SSH to the VPS at /opt/tac-tic-tak, runs git fetch and reset --hard, docker compose --profile app build, up -d, force-recreates nginx, and prunes images. The workspace globs are apps/* and packages/*, so apps/mobile is picked up automatically by -r typecheck and build; the mobile package must not define a heavy 'build' script, or CI should use --filter. Expo with pnpm needs node-linker=hoisted in .npmrc (there is NO .npmrc today) or careful Metro config; switching the linker affects the backend and frontend installs too. The backend Dockerfile copies only apps/backend (and its package.json in the deps stage), so a new packages/shared imported by the backend would require Dockerfile changes (copy packages/shared and its package.json in deps and build). docker-compose: postgres 16 (5432 exposed publicly on the host), redis 7 (host port 6380), backend 4000, frontend 3000, nginx 80/443, volumes pgdata, redisdata, uploads. JWT_SECRET is required by compose (:? guard); JWT_EXPIRES_IN defaults to 7d. New env vars needed: EXPO_ACCESS_TOKEN, PUBLIC_ASSET_BASE, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, MIN_SUPPORTED_BUILD_*. Mobile builds go through EAS Build and Submit (a separate workflow: expo/expo-github-action, eas build --profile preview on PR, eas update on main for OTA).

**State & persistence:** N/A

**Web-only deps:** The frontend container and Next build in compose and CI (to be retired eventually; keep a minimal landing / .well-known server)

**Motion & sound:** N/A

**Mobile mapping:** Add .npmrc (node-linker=hoisted), apps/mobile with eas.json profiles (development, preview, production), a GitHub workflow for EAS, and a --filter so the backend deploy is not triggered by mobile-only changes (paths filter).

**Why M:** Monorepo tooling friction (pnpm with Metro), the Dockerfile copying shared packages, and a new EAS pipeline.


## Shared-logic candidates

- `apps/backend/src/sessions/unlock.ts` — TrainingStyle, TRAINING_STYLES, DEFAULT_STYLE, UNLOCK_REWARD(50), DEMOTE_PENALTY(25), DEMOTE_PEAK_BAND(50), DEMOTE_MAX_CRITERIA(1), WEAK_STREAK_THRESHOLD(2), CALIBRATION_SESSIONS(5), CALIBRATION_STEP_BY_CRITERIA[-125,-50,0,50], STYLE_FORMULAS, solvedTarget, evaluateUnlock, isTrainingStyle, evaluateCalibration, evaluateDemote, UnlockCheck/CalibrationCheck/DemoteCheck types — blockers: None: pure TS with no Node or Nest imports. It is currently duplicated by hand in apps/frontend/src/lib/levels.ts ('must stay in sync'), so move it to packages/shared. The backend Dockerfile must then copy packages/shared, and the backend tsconfig (CommonJS, rootDir ./src) needs a path or build step for workspace packages.
- `apps/backend/src/sessions/streak.ts` — STREAK_FREEZE_MAX, STREAK_FREEZE_REGEN_DAYS, StreakState, isValidDay, applyStreakOnPlay (daysBetween and addDays are internal) — blockers: None: pure TS. Also useful on mobile to predict 'streak at risk' and the freeze state for local notifications, and on the backend scheduler.
- `apps/backend/src/sessions/rating.ts` — AttemptWindow, computeRatingStep, deriveSessionStats (FAST_MS 4000, SLOW_MS 12000, base 12, streak bonus +4% per step capped at 9) — blockers: None: pure TS. Lets the client show an optimistic rating delta before the /attempt response arrives.
- `apps/backend/src/achievements/registry.ts` — AchievementCategory, AchievementState, AchievementDef, ACHIEVEMENT_DEFS (23 slugs), ACHIEVEMENT_SLUGS — blockers: Pure TS, but evaluators reference a Set in the state. The mobile app likely only needs the slug, category and icon catalogue plus the i18n keys; the evaluators can stay server-side.
- `apps/backend/src/review/review.service.ts (META_THEME_SLUGS + primaryTheme)` — META_THEME_SLUGS set (15 slugs), primaryTheme() — blockers: Embedded in a Nest service file; extract it to shared. It is duplicated in apps/frontend/src/lib/theme-labels.ts.
- `apps/backend/src/sessions/dto.ts, auth/dto.ts, users/users.controller.ts DTO classes` — Request contracts (CreateSessionDto, AttemptDto, RegisterDto, LoginDto, ChangePasswordDto, UpdateSettingsDto, UpdateProfileDto, UploadAvatarDto, SendFriendRequestDto) — blockers: These are class-validator decorated classes and not suitable for RN. Generate plain TS types or zod schemas in packages/shared (or produce an OpenAPI spec via @nestjs/swagger and run openapi-typescript) so mobile gets typed responses. Response types are currently implicit (inferred return values) and duplicated by hand on the web.
- `apps/frontend/src/lib/api.ts (reference for the new client)` — API_URL, API_HOST, assetUrl, getToken/setToken, api(), http.{get,post,patch,del} — blockers: Uses window.localStorage and window.location. Rewrite as a platform-agnostic client in packages/shared with injected baseUrl, token getter and onUnauthorized; only assetUrl and the error-message parsing carry over verbatim.

## Haptics opportunities

- POST /sessions/:id/attempt response: correct gives Haptics.impactAsync(Light), wrong gives notificationAsync(Error), and a rising streak (response.streak >= 3, 5, 10) gives escalating impacts (Medium, then Heavy)
- POST /sessions/:id/finish: unlocked=true or calibration.delta>0 gives notificationAsync(Success) plus the ceremony animation; demoted=true gives notificationAsync(Warning); streak.outcome 'continued' or 'started' gives a soft success; 'frozen' gives a distinct double-tap pattern
- achievementsUnlocked non-empty in any response (finish, settings, profile, avatar, friend accept, star-confirm) gives a success haptic on the unlock toast
- Friend request sent or accepted gives a light or success haptic; swipe-to-decline crossing the threshold gives selectionAsync
- Leaderboard pull-to-refresh threshold gives selectionAsync
- 429 rate-limited or validation error on auth forms gives notificationAsync(Warning)
- Account delete or reset-progress confirm gives Heavy impact on long-press completion

## Push opportunities

- streak_at_risk: streakDays>0, local date (User.timezone) != streakLastDay, at the user's reminder hour (default about 19-20 local), deduped once per local day via Redis key push:streak:{uid}:{localDate}
- streak_freeze_regenerated: local date >= streakFreezeRegenAt (STREAK_FREEZE_REGEN_DAYS=7 after consumption)
- streak_lost or freeze_used: computed by simulating applyStreakOnPlay at local day rollover (freezes are otherwise applied lazily at the next play)
- friend_request_received: on Friendship create in FriendshipService.sendRequest (to the addressee)
- friend_request_accepted: on FriendshipService.accept (to the requester), including the requester's newly unlocked achievements, which today are only counted in _requesterAchievements and never surfaced
- achievement_unlocked: for unlocks that happen off-device (the friend-accept path)
- review_backlog: weekly reminder when the unresolved ReviewItem count >= N, deep-linking to the top theme from GET /review/themes
- calibration_reminder: user with calibrationSessionsLeft between 1 and 4 who has been inactive for 2+ days
- leaderboard: a friend overtook you in the friends-scope leaderboard (needs a rank snapshot job)
- weekly_summary: sessions, solved, peak change from /analytics/timeline data
- win-back after 3, 7 and 14 days of inactivity (capped, respects preferences)
- Local (on-device) fallback: expo-notifications scheduled daily streak reminder at 20:00, cancelled after today's session finish; needs no backend work and can ship in phase 1

## Risks

- No refresh tokens: the 7d JWT means mobile users get logged out weekly, and password change does not revoke existing tokens. This must be solved before launch.
- JWT_SECRET falls back to 'dev-secret' in both auth.module.ts and jwt.strategy.ts if the env var is missing (compose guards it, but a direct `node dist/main.js` would not).
- No rate limiting anywhere: brute-forcing bcrypt login, register spam, and search enumeration are all possible. Adding throttling also requires app.set('trust proxy') because nginx fronts everything.
- No in-app account deletion: an App Store and Play Store rejection risk.
- There is no push, timezone or device data model yet. Streak reminders need the user's IANA timezone, which the server never stores (it relies only on the per-request localDate).
- Abandoned sessions (app killed or backgrounded) are never finalised: TrainingSession.endedAt stays null and the Redis session:{sid}:queue and :seen keys have no TTL, a memory leak that grows with mobile usage.
- /sessions/:id/attempt is non-idempotent: a mobile retry after a timeout double-records the attempt and double-applies the rating step. /next RPOPs destructively, so retries skip puzzles.
- Avatar URLs are stored relative ('/uploads/...'). Avatars are on a single-VPS docker volume with no CDN, no re-encoding or EXIF stripping, and no magic-byte check (only a data-URL prefix regex). Base64 JSON upload inflates the payload by about 33% and loads the whole body into memory (6mb JSON limit).
- Nickname uniqueness and login are case-sensitive ('Alex' and 'alex' are distinct accounts), which is confusing on mobile keyboards with auto-capitalisation. Set autoCapitalize='none' and consider normalising.
- GET /auth/me returns the token payload without a DB lookup: deleted or renamed users still pass until expiry. AdminGuard is the only guard that re-reads the DB.
- Public routes /users/by-nickname/* are unauthenticated and the comment claims 'optional auth' that does not exist. A mobile profile screen must call /friendship separately.
- Response inconsistency: puzzle moves is string[] from /next, /puzzles and /review/:id, but a space-joined string from /sessions/:id/review-items.
- ValidationPipe error `message` can be string[]. The mobile client must normalise it. The analytics recommendations 'reason' is hard-coded English (not i18n), and server-side push text will need its own en/uk strings.
- Unhandled Prisma P2025 (e.g. POST /review/:id/resolve for a missing item) surfaces as 500, not 404.
- No API versioning: any response-shape change breaks installed app builds that cannot be force-updated. Versioning plus an app-config min-build gate must be in place before the first store release.
- nginx has no gzip and no limit_req; the Postgres port 5432 is published on the host in docker-compose.yml (security exposure on the VPS unless firewalled).
- Single backend instance: a @nestjs/schedule cron is fine now but would double-send pushes if the service is ever scaled out without a Redis lock or BullMQ.
- Monorepo: there is no .npmrc. Expo with pnpm typically needs node-linker=hoisted, which changes the install layout for the backend and frontend too. CI's `pnpm -r run build` will try to build apps/mobile, and the backend Dockerfile does not copy packages/* (shared logic would break the image build).
- Retiring the web app: nginx routes / to the Next frontend. A minimal site must remain for /.well-known/apple-app-site-association, assetlinks.json, the privacy policy, and the account-deletion URL required by Google Play.
- The 'star-repo' achievement rewards an external action (GitHub star); App Store review could object to incentivised actions.

## Open questions

- Do you want to keep nickname+password only, or add Sign in with Apple / Google (and email for password recovery) for mobile? Adding any third-party login makes Sign in with Apple mandatory on iOS.
- Will the web app keep running in parallel during the transition (affecting whether /api stays unversioned and whether the login response must stay backwards-compatible), or be switched off at mobile launch?
- Preferred streak-reminder time and caps (default 19:00 or 20:00 local? max pushes per day?), and should the reminder be server push, local notification, or both?
- Should abandoned sessions be auto-saved (counting toward streak and stats) or auto-discarded by the sweeper?
- Is horizontal scaling of the backend planned (this decides @nestjs/schedule plus a Redis lock vs BullMQ)?
- Move avatar storage to object storage/CDN (S3/R2) now, or keep the VPS volume?
- Should admin functionality exist in the mobile app, or remain a small web tool?
- Contents of docker-compose.override.yml and the docs/ folder were not read; they may contain additional local or prod config.
- Does an OpenAPI/Swagger spec or shared type package exist that is planned? Response types are currently implicit, and the mobile client will need typed contracts (openapi-typescript or zod in packages/shared).
