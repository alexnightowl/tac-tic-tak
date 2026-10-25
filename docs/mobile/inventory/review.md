# Inventory: review

_Review (theme drills), sessions history (list, detail, session-mistakes review) and the read-only puzzle viewer, plus the backend review / puzzles / sessions endpoints behind them_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Review landing: theme (pattern) cards  ·  complexity M

**Where:** apps/frontend/src/app/(app)/review/page.tsx: ReviewList, ThemeCard, useStartUrl, lib/theme-labels.ts themeLabel, lib/theme-icons.ts themeIcon, components/nav.tsx tab entry '/review'

**Behaviour**

Header shows the title t('review.title') at 22px in eos-bone, with subtitle t('review.subtitle_themes'). While GET /review/themes loads, a centred Loader2 spinner (20px, animate-spin) shows. An empty array shows t('review.empty') ('No puzzles in review. Nice.'). Otherwise the cards are a 1-column grid (2 columns from sm up). Each card is a .glass rounded-2xl row: a 40x40 rounded-xl tile on --bg-softer holding the theme icon (20px, accent colour, Lichess glyph or lucide Puzzle fallback), the theme label (truncated), a meta line '{count} {plural puzzle_word} · from {minRating}' in tabular nums, and a ChevronRight. Server order is most-failed first, ties broken by slug ascending. Only tactical themes appear; the server drops META slugs. One puzzle can count in several theme buckets. Tapping a card goes to /review/{firstPuzzleId}?theme={slug}. To get that id, EVERY card fires its own GET /review?theme={slug} on mount (react-query, staleTime 30s), an N+1 prefetch. Until it resolves, the link points back to '/review', so a tap before it resolves does nothing useful. There is no error state: if the themes query fails, the page shows the header only.

**API**

- `GET /review/themes -> [{slug, count, minRating}] sorted count desc, slug asc; meta slugs excluded; only unresolved ReviewItems`
- `GET /review?theme={slug} -> [{id, puzzleId, createdAt, rating, fen, setupMove, themes[]}] sorted rating asc when a theme is given (one call per card)`

**State & persistence:** react-query keys: ['review-themes'] (default staleTime) and ['review-list', slug] (staleTime 30_000). zustand reads only settings.language. No localStorage of its own.

**Web-only deps:** next/link; Tailwind classes (glass, hover:border-[var(--accent)], sm:grid-cols-2); theme-icons.ts renders SVGs as CSS masks (WebkitMask with url(/design/themes/*.svg)), web-only; lucide-react icons

**Motion & sound:** Only CSS transition-colors on hover (border turns to the accent colour). Spinner uses animate-spin. No sounds.

**Mobile mapping:** FlashList (or FlatList), numColumns=1 on phone and 2 on tablet. Pressable cards with a Reanimated scale-to-0.97 press-in spring and Haptics.selectionAsync on press. Bundle the 43 Lichess SVG glyphs and render them with react-native-svg (react-native-svg-transformer) tinted by currentColor; lucide-react-native supplies the fallback Puzzle icon. Replace the N+1 prefetch: ask the backend to add firstPuzzleId to /review/themes, or fetch the theme list on press and navigate to the first item, with expo-router push('/review/[puzzleId]?theme='). Add RefreshControl for pull-to-refresh, plus skeleton cards instead of the spinner.

**Why M:** The UI is simple, but the theme-icon assets must be converted from CSS-mask SVGs to react-native-svg, and the start-URL prefetch pattern should be redesigned (ideally with a small backend change).


## Theme drill runner (review a pattern until empty)  ·  complexity L

**Where:** apps/frontend/src/app/(app)/review/[puzzleId]/page.tsx: ReviewPuzzle, components/board/Chessboard, components/board/TurnCard, components/ui/button, lib/puzzle.ts initPuzzle/uciFromMove/SOLVED_PAUSE_MS, lib/sound.ts playSound/sfx/moveSoundEvent

**Behaviour**

Route /review/{puzzleId}?theme={slug}; with no theme it runs the legacy global queue. The app layout treats this route as focus mode: no Nav, no PullToRefresh, html and body get the .play-locked class, and the page is h-dvh with safe-area padding of max(12px, inset). Startup: GET /review/{puzzleId} returns the ServerPuzzle. initPuzzle splits off the opponent's setup move (moves[0]). The board starts at preFen, the orientation is the side to move after the setup move (settings.fixedColor is NOT honoured here), and if sound is on a 'move' sound plays. After ANIMATION_MS[animationSpeed] + 20 ms (instant=0, fast=160, normal=280, slow=460) the board swaps to postFen and lastMove highlights the setup move. Moves: legality comes from chess.js. On a correct non-final move, sfx(moveSoundEvent) plays (move/capture/castle/promote...). The opponent's reply plays after max(animMs, 80) ms with a 'capture' or 'move' sound. No opponentBusy flag exists here, so the board stays interactive during that delay. Wrong move: a red feedbackSquare flashes on the target square, the 'fail' sound plays, the themes slot shows t('review.retry') ('Not quite — resetting…') in eos-rose, and after 520 ms the puzzle restarts from scratch, setup animation included. The hint button has 2 levels: level 1 highlights the from-square, level 2 adds the to-square. The button disables at level 2 and resets to 0 after a correct move. Final correct move: the click sound is skipped, a green feedbackSquare shows for 500 ms, the 'correct' sound plays, and the hint button morphs into a 'Solved!' badge (sage on rgba(175,192,169,0.15), .review-solved-pop 320 ms cubic-bezier(.2,1.3,.4,1), scale .9→1 with fade-in). After SOLVED_PAUSE_MS = 1000 ms, resolveAndAdvance runs: POST /review/{id}/resolve (errors swallowed), then a fresh GET of the list, then router.replace to the first item whose id differs from the current one, keeping ?theme. If nothing is left, a done screen shows: with a theme, t('review.theme_done_title') plus theme_done_hint filled with {theme}, {n}, {noun}; without a theme, done_title/done_hint. Its two buttons are 'Back to patterns' (/review) and 'Play again' (/play). The header shows a Back ghost button (always router.push('/review')) and a counter 'X / N · rating'. N is captured ONCE per theme key in sessionRef from the first list fetch, so it never shrinks or grows. X is the puzzle's index in the captured ids; if the current puzzle is not in the captured list, X is pinned to N. A fixed 18px themes slot shows up to 3 non-meta theme labels. The TurnCard shows whose turn it is ('opponent moving' after solve). Layout: on phone a stacked .board-top-slot (min-height 218px, so the board sits at the same y on every board screen), then the board (largest square via container query, min(100cqw,100cqh)), then a bottom CTA (h-12). On lg+ the board is on the left with a 320px aside. If GET /review/{id} 404s ('not in review queue') the promise rejection is unhandled and the board stays in loading forever.

**API**

- `GET /review/{puzzleId} -> ServerPuzzle {id, fen, moves[], rating, themes[], gameUrl}; 404 if no ReviewItem for user (resolved items still returned)`
- `POST /review/{puzzleId}/resolve -> {ok:true}; sets ReviewItem.resolvedAt=now (Prisma update throws -> 500 if missing)`
- `GET /review?theme={slug} | GET /review -> queue list (also re-fetched imperatively after each resolve)`

**State & persistence:** react-query ['review-list', theme ?? '__all__'] (staleTime 30s) for the counter. Local useState: puzzle, chess (a Chess instance re-created on every change to force a render), remaining (UCI list), orientation, lastMove, animateMove, feedbackSquare {square, correct, id}, hintLevel 0|1|2, solved, done. useRef: advanceTimer (cleared on unmount), sessionRef {ids, total, key}. zustand settings: animationSpeed, soundEnabled, soundPack, mirrorView, boardTheme, pieceSet, language, plus settingsReady (the board doesn't render until settings are hydrated). The URL carries state: puzzleId and ?theme. Nothing is persisted locally; progress lives in server ReviewItem.resolvedAt.

**Web-only deps:** next/navigation useParams/useRouter/useSearchParams; router.replace drives the next-puzzle navigation; document.documentElement/body classList 'play-locked' (iOS PWA viewport hack); CSS h-dvh, env(safe-area-inset-*), container queries (containerType:size, cqw/cqh), lg: breakpoint; .review-solved-pop CSS keyframes plus prefers-reduced-motion override; Web Audio via lib/sound (sfx/playSound); setTimeout chains for animation sequencing

**Motion & sound:** Setup move slide = animMs, swapped at animMs+20 ms. Opponent reply after max(animMs, 80) ms. Wrong-move flash, then reset at 520 ms. Correct flash cleared at 500 ms. Solved pause 1000 ms. Solved badge pop 320 ms cubic-bezier(.2,1.3,.4,1), disabled under reduced motion. Sounds: 'move' on setup, sfx(moveSoundEvent) on player moves except the winning one, 'capture'/'move' on the opponent reply, 'fail' (mapped to 'mistake') on a wrong move, 'correct' on solve. All gated on settings.soundEnabled; soundPack 'mute' silences them.

**Mobile mapping:** Build a single reusable <PuzzleRunner> native screen shared by this drill, the session review and the puzzle viewer, with route params via expo-router. The board should use react-native-gesture-handler Pan/Tap gestures and Reanimated shared values for piece drag and slide; withTiming(animMs) instead of setTimeout swaps; runOnJS for the chess.js commit. Haptics (expo-haptics): impactLight on piece pickup/drop, selectionAsync on a correct move, notificationError on a wrong move, notificationSuccess on solve, selection on hint taps. Animate the Solved badge with Reanimated (entering ZoomIn.springify(), respecting AccessibilityInfo.isReduceMotionEnabled / useReducedMotion). Sound: expo-av or expo-audio with preloaded short clips (or react-native-audio-api for low latency). Layout: SafeAreaView with a fixed top slot (218pt equivalent), a board sized min(width, availableHeight) via onLayout or useWindowDimensions, and a bottom CTA in the thumb zone. Next-puzzle navigation: swap state in place (do not push a new route per puzzle) to avoid the stack growing and to allow a cross-fade or slide transition. Prefetch the next puzzle (the list already carries fen and setupMove, but not the full moves) so the transition is instant. Optional: a swipe-down-to-dismiss modal presentation.

**Why L:** It depends on the native chessboard (drag, animation, highlights, feedback squares, hints), the timing state machine, sound and haptics. The board itself is shared work, but this runner's sequencing and edge cases (counter freeze, resolve-then-refetch ordering) must be reproduced exactly.


## Session detail screen  ·  complexity S

**Where:** apps/frontend/src/app/(app)/sessions/[id]/page.tsx: SessionDetail, SessionReviewCta, components/ui/card Card/CardTitle/CardValue, components/ui/button

**Behaviour**

Route /sessions/{id}, rendered inside the normal app layout with Nav and PullToRefresh. While loading or on error, the screen shows a bare '…' that never resolves on 404. Header: a Back ghost button (router.back()). The title is the localized date 'weekday, day month, HH:MM' (uk-UA or en-US), first letter capitalised. The subtitle is the theme label, or 'Mixed'/'Змішана', then ' · {round(durationSec/60)} min/хв'. A stat grid (2 columns on phone, 4 on md) shows Start (startRating), Peak (peakRating), Accuracy (round(accuracy*100)%) and Avg response (fmtResponseTime, e.g. '4.2s'). A 2-column row below holds Solved (eos-sage, 2xl) and Failed (eos-rose). SessionReviewCta fetches GET /sessions/{id}/review-items (staleTime 60s) and renders only if items exist. It shows the heading 'Review this session', the hint '{failed} missed · {slow} slow. Drill them now — no timer.' and an ember plate button 'Review mistakes' that links with a plain <a href> to /sessions/{id}/review (a full page reload). The Attempts list shows a count next to the heading. Each row links to /puzzles/{puzzleId} and shows the index, a 28px circle (Check on sage tint or X on rose tint), puzzleRating, the response time and a ChevronRight. BUG: the time uses fmtDuration(a.responseMs), but fmtDuration expects SECONDS, so 5000 ms renders '83:20'. Empty attempts show 'No attempts'. All strings on this page are hard-coded EN/UK ternaries rather than i18n keys, even though review.session_heading, session_hint and session_cta exist unused in i18n.ts. endRating and endedAt are returned but not displayed.

**API**

- `GET /sessions/{id} -> {id, startedAt, endedAt, mode, theme, durationSec, startRating, endRating, peakRating, solved, failed, accuracy, avgResponseMs, attempts:[{id,puzzleId,puzzleRating,correct,responseMs,createdAt}] asc}; 404 if not owner`
- `GET /sessions/{id}/review-items -> {items:[{puzzleId, reason:'failed'|'slow', responseMs, rating, fen, moves (space-joined string), themes[]}]}`

**State & persistence:** react-query ['session', id] and ['session-review-items', id] (staleTime 60_000). The ['session-review-items'] key is NOT shared with the session review runner, which uses a raw http.get. zustand: settings.language only.

**Web-only deps:** next/link, next/navigation router.back(); toLocaleDateString/toLocaleTimeString with uk-UA/en-US locales; Tailwind grid breakpoints; .btn-ember 9-slice border-image plate (/design/plates/ember.webp)

**Motion & sound:** Hover and active background transitions on rows only. No sounds.

**Mobile mapping:** ScrollView or FlashList with a header component and attempt rows as Pressables (haptic selection on press; optional Reanimated layout FadeIn stagger). The ember plate button needs a native equivalent: ImageBackground with capInsets (9-slice) on iOS, or a pre-rendered nine-patch / react-native-skia, or a simpler gradient. Use Intl via Hermes for the dates (check locale data) or date-fns with the uk locale. Add a skeleton or error state. Fix the fmtDuration/ms bug while porting. Move the strings to i18n keys. Use a native-stack push transition and keep the back gesture.

**Why S:** A static read-only screen with two queries. The only non-trivial piece is the ember plate button style.


## Session mistakes review runner  ·  complexity M

**Where:** apps/frontend/src/app/(app)/sessions/[id]/review/page.tsx: SessionReview, toServerPuzzle, Chessboard, TurnCard, lib/puzzle.ts, lib/sound.ts

**Behaviour**

Route /sessions/{id}/review, in focus mode (no nav). It does NOT add play-locked, unlike the other runners. On mount it does a raw GET /sessions/{id}/review-items (not react-query), with a full-screen spinner while loading. If totalCount is 0, it shows t('review.nothing_title') and nothing_hint with a Back ember button (router.back()). The queue is local and FIFO. The head is loaded by loadHead, which DOES honour settings.fixedColor (auto/white/black) for orientation, unlike the theme drill. The setup-move animation is the same as the theme drill. Wrong move: 'fail' sound, a red flash for 500 ms, failedTries++, and after 520 ms the SAME puzzle reloads (the code comment says rotate to the tail, but the implementation resets in place). Correct non-final move: the opponentBusy flag is set and the reply plays after max(animMs, 80) ms with sfx(moveSoundEvent). On the final move: 'correct' sound, green flash, solvedCount++, solved=true, a Solved badge in place of the hint button (fixed 120px wide slot, h-9, review-solved-pop), and after SOLVED_PAUSE_MS (1000 ms) the head is popped. An empty queue shows the done screen: t('review.done_title'), done_hint with {n} and {noun}, and two buttons, 'Back to session' (push /sessions/{id}) and 'Play again' (/play). The header has a Back glass button (router.back()) and a progress pill '{solved} / {total}'. A reason bar shows a chip 'Missed' (rose, XCircle icon) or 'Slow' (amber, Loader2 icon, static), the puzzle rating and the Hint button (2 levels as in the drill; disabled while animating, during opponentBusy or at level 2). The stats row below the board shows '✓ solved  ✗ failedTries · {queue.length} left'. Nothing is sent to the server: solving here does NOT resolve the global ReviewItem and does not affect rating. Backend item selection: all attempts of the session in createdAt order. Failed ones are always flagged; correct ones are flagged 'slow' if responseMs > max(1.5 × session avg responseMs, 5000 ms). Duplicates keep the worst reason (failed beats slow). The order is chronological by first flag.

**API**

- `GET /sessions/{id}/review-items (see detail feature); ownership checked; moves is a space-joined string here unlike ServerPuzzle.moves[]`

**State & persistence:** Local useState only: queue, loading, totalCount, solvedCount, failedTries, chess, remaining, orientation, lastMove, animateMove, opponentBusy, feedbackSquare, hintLevel, solved. Refs: currentPuzzle, advanceTimer. zustand settings: animationSpeed, fixedColor, soundEnabled, soundPack, mirrorView, boardTheme, pieceSet, plus settingsReady. Nothing persisted; leaving the screen loses progress.

**Web-only deps:** next/navigation; CSS h-dvh, env(safe-area-inset-*), container queries, lg breakpoint; .review-solved-pop, .btn-ember, .glass CSS; Web Audio (lib/sound); setTimeout sequencing

**Motion & sound:** Same timings as the theme drill: setup animMs+20, reply max(animMs,80), fail reset 520 ms, flash 500 ms, solved hold 1000 ms, badge pop 320 ms. Sounds: move, fail→mistake, correct, plus sfx events per move.

**Mobile mapping:** Reuse the shared <PuzzleRunner> with a 'session-review' data source (a queue adapter) and a reasonBar slot. Haptics as in the drill. Consider a progress bar (Reanimated width) instead of the text pill. On iOS, make the native-stack back gesture confirm or ignore loss of progress. Normalise moves parsing (string vs array) in a shared adapter.

**Why M:** Once the shared runner and board exist this is a thin queue adapter. Taken alone it would be L.


## Read-only puzzle viewer (re-solve or step through the solution)  ·  complexity M

**Where:** apps/frontend/src/app/(app)/puzzles/[puzzleId]/page.tsx: PuzzleView, parseUci, Chessboard, TurnCard (override prop), components/ui/button

**Behaviour**

Route /puzzles/{puzzleId}, opened from session attempt rows. It is NOT in the layout's focusMode list, so it renders inside Nav, PullToRefresh and the max-w-5xl main while itself being h-dvh with play-locked (a layout quirk). It fetches GET /puzzles/{id} (react-query ['puzzle', id], staleTime Infinity). On error it shows t('puzzle.not_found') with a Back outline button; while loading, a spinner. Solve mode (the default) works like the drill: the setup move animates to postFen, orientation follows the puzzle (fixedColor ignored), and the 2-level hint. A wrong move plays 'fail' and restarts after 520 ms. The final move shows Solved: the TurnCard override title 'Solved!' plus the badge, with a 'Try again' (RotateCcw) button next to 'Solution' (Eye). There is no auto-advance and nothing is sent to the server; the info slot shows t('puzzle.practice_note') ('Practice — rating unaffected') · themes. Solution mode: tapping 'Solution' precomputes fens[k] for every ply of the full line and jumps to ply 1 (the position after the setup move). Controls: Prev and Next buttons (h-12), a counter '{ply-1} / {moves.length-1}' and 'Try again' (back to solve mode). A single step forward slides the piece (animMs+20, sfx on the move); any other jump snaps. Desktop ArrowLeft/ArrowRight keys step the line (a window keydown listener). The TurnCard override shows the title 'Solution' and the subtitle t('puzzle.solution_step') 'Move {n} of {total} · ← → to step'. The header has Back (router.back()) and an external link '{rating} · Lichess ↗' to https://lichess.org/training/{id} (target _blank). All timers are tracked in timers.current and cleared on mode switch and on unmount. Backend: allowed only if the user has at least one TrainingAttempt on that puzzle (anti-spoiler); otherwise 404.

**API**

- `GET /puzzles/{puzzleId} -> ServerPuzzle {id, fen, moves[], rating, themes[], gameUrl}; 404 unless a TrainingAttempt exists for (user, puzzle)`

**State & persistence:** react-query ['puzzle', id] staleTime Infinity. Local: mode 'solve'|'solution', chess, remaining, orientation, lastMove, animateMove, opponentBusy, feedbackSquare, hintLevel, solved, ply (1..moves.length), timers ref, fens (useMemo). zustand settings as in the other runners.

**Web-only deps:** window keydown ArrowLeft/ArrowRight; <a target=_blank> external link; document classList play-locked; CSS h-dvh/safe-area/container queries; next/navigation

**Motion & sound:** Step-forward slide animMs, landing at animMs+20. Backward and multi-step jumps snap. Solve-mode timings as in the drill (520 / 500 / max(animMs,80)). No auto-advance. Badge pop 320 ms.

**Mobile mapping:** Reuse <PuzzleRunner> with a 'practice' mode and add a SolutionStepper. Replace arrow keys with horizontal swipe on the board area (Gesture.Pan with activeOffsetX, so it doesn't conflict with piece drag; maybe only outside the board or on a scrubber), with haptic selection per ply and long-press-to-repeat on the Prev/Next buttons. Also consider a ply scrubber (Slider) with a selection haptic per tick. The solution_step copy must drop '← → to step' on mobile (new i18n key). Open the external link with expo-web-browser openBrowserAsync or Linking.openURL. Present it as a modal or card stack from the session detail.

**Why M:** It shares the runner and board. The solution stepper with precomputed FENs is pure logic and easy to port. The extra work is the gesture design for stepping.


## Session history list with day grouping and swipe-to-delete  ·  complexity M

**Where:** apps/frontend/src/components/SessionList.tsx: SessionList, useGrouped, startOfDay, SessionRowCard, ConfirmDelete, Used by app/(app)/dashboard/page.tsx (onDelete → DELETE /sessions/{id}) and app/(app)/profile/[nickname]/page.tsx (onDelete={() => {}}), components/StyleIcon, lib/levels isTrainingStyle

**Behaviour**

Grouping: each session's startedAt is truncated to local midnight. Labels are 'Today'/'Сьогодні', 'Yesterday'/'Вчора', the weekday name when now - dayStart < 7 days, otherwise 'weekday, day month' (uk-UA or en-US), first letter capitalised. Groups keep the server order (startedAt desc, take 20). Group headers are uppercase xs zinc-500 with tracking. Row card (.glass, radius 16): an optional style icon tile (36px, eos-rise background, StyleIcon for bullet/blitz/rapid), a left column of 24h time (hour12:false), the solved count and a 'solved' label that is hard-coded English. The middle shows 'startRating › peakRating' with delta colouring (sage up / rose down / white flat), an ArrowUpRight/ArrowDownRight icon and a signed delta. A sub-line shows '{theme ?? mode} · {accuracy%} · {avg s} · {round(min)}m'; the raw theme slug or mode is shown, not themeLabel. The row taps through to /sessions/{id}. Swipe-to-delete (only when onDelete is given) uses pointer events. Axis lock happens after 6px of movement, horizontal if |dx| > |dy|. dx is clamped to [-88, 0] (REVEAL = 88px). On release it snaps open to -88 if dx < -44, otherwise closes, with a 200 ms ease transform. The card's right border-radius morphs 16 → 0 with progress, and the delete button's left radius does the same. The delete button (88px wide, eos-ember background, Trash2 icon plus 'Delete'/'Видалити') fades in with opacity |dx|/28 and is clickable only above 0.5 opacity. A click on an open card closes it instead of navigating. Tapping Delete opens a confirm modal, portalled to document.body: a black/60 backdrop, aligned to the bottom on phone and centred on md. It shows 'Delete this session?' and 'Stats will be recomputed. This cannot be undone.' with Cancel (closes and resets the swipe) and Delete (ember) buttons; tapping the backdrop cancels. The dashboard's onDelete calls DELETE /sessions/{id} (errors swallowed), then invalidates ['overview'], ['analytics'] and ['analytics-themes']; it does not update optimistically, so the row stays until the refetch. BUG: the profile page passes a no-op onDelete, so swipe-delete is shown on OTHER users' public profiles and does nothing (the server would 404 anyway). An empty list shows emptyLabel.

**API**

- `GET /analytics (dashboard overview) -> {recentSessions: SessionRow[] (endedAt != null, startedAt desc, take 20), allTimePeak, lifetime}`
- `GET /users/by-nickname/{nickname} -> {..., recentSessions: SessionRow[]} (profile)`
- `DELETE /sessions/{id} -> {ok:true}; ownership check; cascade deletes attempts; does NOT clear Redis buffer, does NOT delete ReviewItems, does NOT roll back progression rating`

**State & persistence:** Per-row useState dx, confirming, animating; refs startX, startY, axis. Parent react-query keys ['overview'] (dashboard) and ['profile', nickname]. Nothing persisted.

**Web-only deps:** React pointer events (onPointerDown/Move/Up/Cancel); CSS transform/transition, willChange; react-dom createPortal to document.body; next/link; toLocaleDateString/TimeString locales

**Motion & sound:** Live drag has no transition. Release snap: transform and border-radius 200 ms ease. Button opacity is linear 120 ms while dragging and 200 ms ease on release. The modal has no enter animation. No sounds.

**Mobile mapping:** SectionList or FlashList with sticky section headers built from a shared pure groupSessionsByDay(). Swipe: ReanimatedSwipeable from react-native-gesture-handler (renderRightActions, rightThreshold 44, friction) or a custom Gesture.Pan with activeOffsetX [-6, 6] and failOffsetY, with Reanimated interpolation of the radius and opacity and a withSpring snap. Haptic impactMedium when the swipe crosses the 44px threshold, notificationWarning on confirm delete. Confirm with Alert.alert (destructive style), ActionSheetIOS, or a @gorhom/bottom-sheet. Use optimistic removal (react-query setQueryData) plus a Reanimated LinearTransition / exiting FadeOut so the list collapses smoothly. Optionally an undo toast instead of the modal. Only enable delete when it is the viewer's own list (fixes the profile bug). Localise the 'solved' label and use themeLabel for the theme.

**Why M:** The grouping logic is trivial. Making the swipe-delete gesture feel native (thresholds, spring, haptics, list layout animation on removal) takes careful Reanimated and RNGH work.


## Pull-to-refresh (global, non-runner pages)  ·  complexity S

**Where:** apps/frontend/src/components/PullToRefresh.tsx, apps/frontend/src/app/(app)/layout.tsx (wraps <main>; onRefresh = queryClient.invalidateQueries() for ALL queries; skipped in focus mode)

**Behaviour**

Global window touch listeners. It engages only when window.scrollY is 0 and a single finger is down. Pull distance is dy × 0.45 (rubber band), capped at MAX = 110px; TRIGGER is 72px. A 36px glass circle indicator sits at top max(8px, safe-area-top), fades in when pull > 8px, translates by max(0, pull - 36) and rotates an ArrowDown 0→180° with progress. On release past the trigger it holds at 72px with a spinning Loader2 while it awaits onRefresh, then snaps back with a 180 ms ease transform. Content translates with the pull. Nav is deliberately outside the wrapper because a transformed ancestor would trap the position:fixed tab bar. The effect re-subscribes listeners on every pullY change (deps [pullY, refreshing, onRefresh]).

**API**

- `none directly (invalidates every react-query key)`

**State & persistence:** Local pullY, refreshing; refs startY, pulling.

**Web-only deps:** window touchstart/touchmove/touchend listeners; window.scrollY; CSS transforms/transition; env(safe-area-inset-top)

**Motion & sound:** Rubber band factor 0.45, trigger 72px, max 110px, snap-back 180 ms ease, arrow rotation proportional to progress, indicator opacity transition.

**Mobile mapping:** Drop it. Use the native RefreshControl on each ScrollView/FlashList (tintColor eos-ember #a64241, progressViewOffset for the header), or a custom Reanimated header if the branded indicator matters. Add Haptics.impactLight when the refresh triggers. Refresh only the screen's own query keys (refetch), not a global invalidateQueries().

**Why S:** Native RefreshControl replaces it for free.


## Theme labels and meta-theme filtering  ·  complexity S

**Where:** apps/frontend/src/lib/theme-labels.ts: EN (61 slugs), UK (61 slugs), META_THEME_SLUGS (15 incl. 'puzzle'), isMetaTheme, themeLabel(slug, lang), KNOWN_THEME_SLUGS (47 tactical slugs), Mirror: apps/backend/src/review/review.service.ts META_THEME_SLUGS (same 15) + primaryTheme()

**Behaviour**

themeLabel falls back from the requested language dict to EN, then to camelCase→spaced and capitalised. The meta set covers phase (opening/middlegame/endgame), length (oneMove/short/long/veryLong), source (master/masterVsMaster/superGM), outcome (advantage/crushing/equality), 'mate' and the catch-all 'puzzle'. It is used by the review cards, the runners' themes line (first 3 non-meta), session detail, analytics, the profile, ThemePicker and landing Motifs. The backend keeps a manual duplicate of the meta set.

**State & persistence:** Static constants.

**Motion & sound:** none

**Mobile mapping:** Move it verbatim into a shared workspace package (e.g. packages/shared/theme-labels.ts) consumed by the mobile app, the web app and the backend, so the backend's hand-copied META_THEME_SLUGS goes away.

**Why S:** Pure TypeScript with no dependencies.


## Backend: review queue, puzzle fetch, session detail/review-items/delete  ·  complexity S

**Where:** apps/backend/src/review/review.controller.ts + review.service.ts, apps/backend/src/puzzles/puzzles.controller.ts + puzzles.service.ts (+ puzzle-buffer.service.ts for play), apps/backend/src/sessions/sessions.controller.ts + sessions.service.ts (detail, reviewItems, remove)

**Behaviour**

All controllers use JwtAuthGuard and CurrentUser. ReviewItem has @@unique(userId, puzzleId) and @@index(userId, resolvedAt). It is created or un-resolved (resolvedAt = null) in sessions.attempt whenever dto.correct is false, and deleted for discarded sessions (createdAt >= session.startedAt). GET /review: unresolved items with the puzzle and its themes. With ?theme it filters on the theme relation and sorts rating asc. Without a theme it sorts by primaryTheme (first non-meta slug; meta-only items sort last via '￿') and then rating. setupMove = moves.split(' ')[0]. There is no pagination. GET /review/themes: buckets with count and minRating, sorted count desc. GET /review/{id}: requires a ReviewItem (resolved or not) and returns PuzzlesService.get. POST /review/{id}/resolve: Prisma update, which 500s on a missing item. GET /puzzles/{id}: getAttempted requires a TrainingAttempt. GET /sessions/{id}: owner only. endRating is the last attempt's puzzleRating if it was correct, else session.peakRating. GET /sessions/{id}/review-items: adaptive slow cutoff max(avg × 1.5, 5000 ms). DELETE /sessions/{id}: owner only, deletes the row; attempts cascade.

**API**

- `GET /review[?theme=]`
- `GET /review/themes`
- `GET /review/:puzzleId`
- `POST /review/:puzzleId/resolve`
- `GET /puzzles/:puzzleId`
- `GET /sessions/:id`
- `GET /sessions/:id/review-items`
- `DELETE /sessions/:id`
- `GET /analytics (recentSessions)`
- `GET /users/by-nickname/:nickname (recentSessions)`

**State & persistence:** Postgres via Prisma (ReviewItem, TrainingSession, TrainingAttempt, Puzzle, PuzzleTheme, Theme). Redis keys session:{sid}:queue, session:{sid}:seen and user:{uid}:recent (30-day TTL) are used by play only.

**Motion & sound:** n/a

**Mobile mapping:** The endpoints work as-is for mobile with a Bearer JWT. Recommended additions: firstPuzzleId (or a top-N preview) in /review/themes; pagination or a cursor for the session history (only take 20 today); an idempotent resolve (updateMany) that doesn't 500; DELETE /sessions should also call buffer.clearSession. Push support needs new endpoints (device token registration) that live outside this area.

**Why S:** No change is required to ship mobile parity; the improvements listed are small.


## Shared-logic candidates

- `apps/frontend/src/lib/theme-labels.ts` — META_THEME_SLUGS, isMetaTheme, themeLabel, KNOWN_THEME_SLUGS (EN/UK dicts, 61 slugs each) — blockers: None. Pure TS. Should also replace the duplicated META_THEME_SLUGS in apps/backend/src/review/review.service.ts.
- `apps/frontend/src/lib/puzzle.ts` — ServerPuzzle, InitResult, initPuzzle, uciFromMove, SOLVED_PAUSE_MS (1000) — blockers: Only depends on chess.js, which runs on Hermes. Verbatim.
- `apps/frontend/src/lib/utils.ts (partial)` — fmtResponseTime(ms), fmtDuration(seconds), formatLocalDate — blockers: cn() uses clsx and tailwind-merge (web styling), so split it out. Note fmtDuration takes seconds; sessions/[id] misuses it with ms.
- `apps/frontend/src/lib/store.ts (constant only)` — ANIMATION_MS {instant:0, fast:160, normal:280, slow:460}, AnimationSpeed/ColorMode/Language types — blockers: The file also builds the zustand store. Extract the constants and types into a shared module; the zustand store itself is portable, but its persistence layer (not read here) is probably localStorage.
- `apps/frontend/src/components/SessionList.tsx (useGrouped/startOfDay logic)` — Extract groupSessionsByDay(sessions, language, now) -> [label, rows][] and the SessionRow type — blockers: Currently embedded in a component and named like a hook. Relies on Intl toLocaleDateString with uk-UA, so Hermes Intl locale data must be verified.
- `apps/frontend/src/app/(app)/puzzles/[puzzleId]/page.tsx (fens + goToPly logic)` — Extract buildSolutionFens(puzzle) and parseUci(uci) as pure helpers — blockers: Inline in a page component today; trivial to lift.
- `apps/frontend/src/app/(app)/review/[puzzleId]/page.tsx + sessions/[id]/review/page.tsx + puzzles/[puzzleId]/page.tsx` — A shared usePuzzleRunner reducer/state machine (setup move, expected-move check, opponent reply, wrong→reset 520ms, solved→pause, hint levels) with timing constants — blockers: The three copies have diverged: fixedColor is honoured only in session review, opponentBusy is missing in the theme drill, play-locked is missing in session review. They are tied to setTimeout and setState; moving to Reanimated callbacks needs a clean pure core plus platform adapters.
- `apps/frontend/src/lib/i18n.ts` — Dictionaries (review.*: 28 EN / 29 UK keys incl. plural forms; puzzle.*: 5 keys), useT, useTn — blockers: Hooks read the zustand store. useTn uses Intl.PluralRules (Hermes support or a polyfill like @formatjs/intl-pluralrules needed). Several pages hard-code strings instead of keys (sessions/[id], SessionList).
- `apps/frontend/src/lib/sound.ts (partial)` — moveSoundEvent(move) -> SoundEvent, SoundKind/SoundEvent types — blockers: sfx/playSound are Web Audio based and need an expo-audio or react-native-audio-api reimplementation; moveSoundEvent itself is pure.
- `Response types in the page files` — ReviewTheme, ReviewItem (queue), SessionReviewItem, SessionDetail/Attempt, SessionRow — blockers: Declared ad hoc per page. Best moved to a shared API types package, ideally generated from the backend.

## Haptics opportunities

- Piece pickup and drop on the board: impactLight. Illegal drop: impactSoft or a short rigid tap.
- Correct move in multi-move puzzle: selectionAsync
- Wrong move (the red flash, before the 520 ms reset): notificationAsync(Error)
- Puzzle solved (Solved badge pop, 1000 ms hold): notificationAsync(Success)
- Hint button tap (level 1 and 2): selectionAsync; level 2 could use impactLight
- Theme drill / session review complete screen: notificationAsync(Success) or a custom double-tap pattern
- Solution stepper Prev/Next and each ply of a scrubber or swipe: selectionAsync
- Swipe-to-delete crossing the 44px snap threshold: impactMedium. Confirming delete: notificationAsync(Warning).
- Pull-to-refresh crossing the trigger: impactLight
- Pressing theme cards, attempt rows and session rows: selectionAsync on press-in
- Opponent reply landing (optional, very light) to give the board a tactile rhythm

## Push opportunities

- Review backlog reminder: 'You have N unresolved {top theme} puzzles' (data from /review/themes; most-failed theme first). Deep link to /review/{firstPuzzleId}?theme=
- Post-session nudge a few hours after a session that had failed or slow items: 'Drill your 3 mistakes from this morning' -> /sessions/{id}/review
- Spaced-repetition re-surfacing of failed puzzles. No SRS scheduling exists today (ReviewItem only has createdAt/resolvedAt), so a nextReviewAt column and a scheduler would be needed.
- Pattern weakness milestone: 'You cleared all Fork puzzles' (could be a local notification on the done screen or an achievement)
- Deep-link handling for all of the above needs expo-router URL schemes matching the routes /review/[puzzleId], /sessions/[id], /sessions/[id]/review and /puzzles/[puzzleId]

## Risks

- BUG to fix during the port: sessions/[id]/page.tsx renders attempt time with fmtDuration(a.responseMs), but fmtDuration expects seconds, so 5000 ms shows as '83:20'. Use fmtResponseTime.
- BUG: profile/[nickname]/page.tsx passes onDelete={() => {}} to SessionList, so swipe-to-delete appears on other users' public profiles and the confirm does nothing. Mobile should enable delete only for the user's own list.
- The theme drill runner (/review/[puzzleId]) has no opponentBusy guard, so the board accepts input during the max(animMs,80) ms opponent-reply delay (allowMoves only checks animateMove/solved). The other two runners guard it. Unify in the shared runner.
- The three runner implementations diverge: fixedColor is honoured only in session review; play-locked is missing in session review; the comment in session review says 'rotate to tail' but the code resets in place. The port must pick one behaviour on purpose.
- The /review landing does an N+1 prefetch: each theme card fires GET /review?theme= (full fen payloads). With many themes on mobile networks this is wasteful. Suggest a backend firstPuzzleId field.
- Unhandled errors: GET /review/{id} 404 leaves the runner spinning forever (unhandled rejection); session detail shows '…' forever on 404; review list has no error state; POST /review/{id}/resolve throws a 500 (Prisma P2025) if the item is missing.
- DELETE /sessions/{id} works on unfinished sessions too, does not call buffer.clearSession (Redis session queue/seen keys have no TTL and leak), does not delete ReviewItems, and does not roll back progression rating. After the attempts cascade away, GET /puzzles/{id} may 404 for those puzzles (getAttempted needs an attempt).
- Session-review solves do not resolve the global ReviewItem, so the user can drill the same mistake in a session review and still see it in the /review theme queue. Possibly intended; confirm.
- Hermes Intl: grouping and date labels rely on toLocaleDateString/TimeString with uk-UA and Intl.PluralRules (useTn). Verify Hermes ICU coverage on Android, or add @formatjs polyfills or date-fns with the uk locale.
- Theme icons are CSS-mask SVGs (theme-icons.ts) served from /public/design/themes; they must be re-bundled as react-native-svg components. The .btn-ember plate uses CSS border-image 9-slice on a webp, which needs a native nine-patch/capInsets or Skia replacement.
- Layout tricks that have no RN equivalent: container queries (min(100cqw,100cqh)) for the board, .board-top-slot min-height 218px for the same board y across screens, h-dvh, and play-locked iOS PWA hacks. Recreate with onLayout and safe-area insets.
- Animation sequencing uses JS setTimeout plus setState with a new Chess() per change. On RN that risks dropped frames; drive piece motion with Reanimated on the UI thread and keep chess.js commits off the animation path.
- The /puzzles/[puzzleId] page is not in the layout's focusMode list, so on web it renders inside Nav and PullToRefresh while also being h-dvh. Do not replicate this; on mobile present it as a full-screen runner or modal.
- Hard-coded strings: SessionList ('solved', Today/Yesterday, Delete dialog), sessions/[id] (all labels), plus raw theme slugs and mode shown in session rows instead of themeLabel. The i18n keys review.session_heading/hint/cta, review.next, review.replay and review.subtitle exist but are unused.
- The 'puzzle.solution_step' copy contains '← → to step', a keyboard hint that needs a mobile-specific string.
- Session history only shows the latest 20 (analytics take:20) and has no pagination or infinite scroll. A mobile history screen will likely need a new paginated endpoint.

## Open questions

- Should solving a puzzle in the session-mistakes review (/sessions/{id}/review) also POST /review/{id}/resolve so the global review queue clears? Today it doesn't.
- Should the runners honour settings.fixedColor consistently? Today only the session review does.
- Is the legacy unfiltered /review/{id} flow (no ?theme) still reachable anywhere, or can mobile drop it?
- Does the mobile app need a dedicated full-history screen with pagination (backend only returns the latest 20 recent sessions via /analytics and /users/by-nickname)?
- Should deleting a session also remove the ReviewItems and the Redis buffer keys it created, and should it be allowed on unfinished sessions?
- Should mobile deep-link to the Lichess puzzle page (external browser), or keep the user in the app?
- Not read: Chessboard.tsx internals (drag, feedbackSquare animation using the square-feedback keyframes, hint rendering), TurnCard full rendering, lib/api.ts token storage, and lib/sound.ts internals. These are needed to finish the shared-runner plan and are presumably covered by another area.
- Should there be spaced repetition (nextReviewAt) to power review reminder push notifications, or is a simple 'N unresolved' reminder enough?
- Is Hermes Intl (uk-UA date names, PluralRules few/many) acceptable on the target Android devices, or should polyfills be bundled?
