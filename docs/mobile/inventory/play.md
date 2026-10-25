# Inventory: play

_Core training loop: Play setup (/play), session runner (/play/[id]) with its summary and rank ceremony, the difficulty slider, turn card, style icons, theme picker, the level/unlock/puzzle helpers, and the backend sessions module (create / next / attempt / finish rules: calibration, unlock, demote, peak band, comfort zone, daily streak, early exit, discard)_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Play setup screen (New Session)  ·  complexity M

**Where:** app/(app)/play/page.tsx PlaySetup, StyleBlurb, NextUnlockPreview, CalibrationPreview, ThemePracticeNote, Requirement, MobileStartBar (portal), ui/Segmented, ui/Card, ui/Input, ui/Button, DifficultySlider, StyleIcon, ThemePicker

**Behaviour**

Title t('play.new_session'). Sections, top to bottom:
1) STYLE: a Segmented control over TRAINING_STYLES ['rapid','blitz','bullet'] (slowest to fastest). Each option shows StyleIcon(18) + t('style.<s>.name'). While a style is calibrating (progressions[s].calibrationSessionsLeft > 0) it shows a pill '?{done}/5' (done = 5 - left). On the active tab the pill is bg-black/20 text #f5eee5/85; otherwise bg rgba(215,183,119,0.15) text #d7b777. aria t('play.calibration_progress_aria') with {done}/{total}. Under it, StyleBlurb shows a 32px icon tile, t('style.<s>.desc') and 'min–max minutes' from STYLE_FORMULAS.
2) RATING: header t('style.<s>.rating_label'), the band icon (BAND_ICON for bandFor(startRating), 18px) with the band label, and the number in 22px extrabold with a gold '?' while provisional. While provisional AND mode=mixed, the slider is HIDDEN and replaced by t('play.calibration_per_style') ({done},{total},{style}); the server picks the rating. Otherwise the DifficultySlider gets value=startRating, cap=ratingCap, currentRating=currentPuzzleRating, and (mixed only) levelUpFrom=peakFloor=unlocked-50 and norm=unlocked. In mixed mode there is a legend: comfort swatch #6f6a6e and level-up swatch #a64241 with a gold ring, plus a hint line 'unlocked: X · cap: Y'. Theme mode shows t('play.theme_unrated_hint') instead.
   - ratingCap = theme ? 3000 : unlockedStartRating + 200.
   - Off-form card (amber) shows when mode!=theme && !provisional && weakSessionStreak>0 && startRating>=peakFloor. Text t('play.off_form_title'/'off_form_hint' {floor}). CTA t('play.off_form_cta' {rating}) sets the slider to offFormRating = max(400, floor((peakFloor-25)/25)*25). It is only a suggestion; the slider is never forced.
   - Comfort notice shows when mode!=theme && !provisional && startRating < peakFloor (t('play.comfort_notice' {floor})).
3) DURATION: a Segmented control with the style's durationPresetsSec as 'N min' plus 'custom'. Custom shows a numeric text input that accepts '' or 1–2 digits, with the range 'min–max' minutes. On blur it normalises ('' becomes minMinutes, otherwise the clamped value). The effective duration is the clamped custom minutes*60. customInvalid only fires when the field is '' (the number is already clamped to at least min).
4) MODE: a Segmented control 'mixed' | 'theme'. Theme mode reveals the ThemePicker (default theme 'fork').
5) Preview card: mixed+provisional shows CalibrationPreview (done/total plus an amber progress bar, width max(pct,2)%, transition width 300ms). mixed+stable shows NextUnlockPreview ('unlocked → unlocked+50'; three requirement tiles: solved ≥ solvedTarget(style,duration), accuracy ≥ round(acc*100)%, peak +peakDelta). theme shows ThemePracticeNote.
6) Error text (e.message), then the CTA 'Start' / 'Starting…' with a Play icon. Disabled when loading || customInvalid || (theme && !theme). On md+ the CTA sits inline in the card. On phones it is a fixed bottom bar portalled to body at bottom calc(58px + safe-area-inset-bottom) (above the tab bar), with a gradient built from color-mix of --accent and --bg-base.
Initial values: SSR-safe defaults first (DEFAULT_STYLE 'blitz', blitz presets[1]=600s). A layout effect then restores the stored style and that style's duration before first paint and sets `restored` (fix b25dbd3). initialStartRating(p) = calibrating ? currentPuzzleRating : min(max(startPuzzleRating, currentPuzzleRating), unlockedStartRating+200), so the slider follows the rating up but never drops below the last picked start. While the slider is untouched (ratingTouched ref) it re-syncs when progressions change (/users/me lands late). selectStyle runs in the click handler, not an effect, so style, rating and duration change in one render. It resets ratingTouched, sets the rating from the new style's progression, restores the stored duration for that style and writes LAST_STYLE_KEY. resolveDurationFor: a stored value outside [min,max] or not finite falls back to presets[1]; a value that matches a preset selects the preset; any other value selects custom with that value.
Start: POST /sessions {startRating, durationSec, mode, style, theme (theme mode only)}. If the response has firstPuzzle, stashFirstPuzzle(sessionId, firstPuzzle), then router.push('/play/'+sessionId).
Edge cases: switching mode theme→mixed does NOT clamp startRating to the new cap, so a value above unlocked+200 gets a server 400 'startRating exceeds unlocked cap'. In theme mode during calibration the slider is shown and any rating up to 3000 is allowed.

**API**

- `POST /sessions  body {startRating:int 400..3000, durationSec:int 60..3600, mode:'mixed'|'theme', style:'bullet'|'blitz'|'rapid', theme?:string} -> {sessionId, startedAt, durationSec, style, firstPuzzle: {puzzle, currentRating, session:{id,startedAt,durationSec,style,mode}} | null}`
- `GET /analytics/themes (via ThemePicker)`

**State & persistence:** Local useState: style, startRating (+ ratingTouched ref), duration, customDuration, customMinutes (string), mode, theme ('fork'), err, loading, restored. zustand useAppStore: progressions[style] {startPuzzleRating, currentPuzzleRating, unlockedStartRating, calibrationSessionsLeft, weakSessionStreak} and settings.language. localStorage: 'taktic.lastStyle' (TrainingStyle) and 'taktic.lastDurations' (JSON {[style]: seconds}, written in an effect only after restore). In-memory hand-off: pending-puzzle cache. Store defaults when /users/me has not landed: 1200/1200/1200, calibrationSessionsLeft 5, weakSessionStreak 0.

**Web-only deps:** localStorage (taktic.lastStyle, taktic.lastDurations) -> MMKV (react-native-mmkv), which is synchronous, so the hydration dance and useIsoLayoutEffect go away; useLayoutEffect/hydration workaround (Next SSR) -> not needed; createPortal to document.body for MobileStartBar -> absolutely positioned footer inside the screen / SafeAreaView bottom inset; env(safe-area-inset-bottom), color-mix() gradient -> react-native-safe-area-context + expo-linear-gradient with precomputed colours; next/navigation useRouter.push -> expo-router router.push('/play/[id]'); <img> band icons from /design/icons/*.webp -> require()d assets / expo-image; lucide-react -> lucide-react-native; Tailwind classes / CSS vars (--accent, --bg-base, --border-soft, --bg-softer, eos-* tokens) -> NativeWind or a theme token object; input inputMode numeric + pattern -> TextInput keyboardType='number-pad'; title= tooltips (provisional) -> long-press tooltip or drop

**Motion & sound:** Calibration preview bar: width transition 300ms. Segmented transitions are in the Segmented component (not read). No sounds on this screen.

**Mobile mapping:** One expo-router screen app/(tabs)/play/index.tsx. Segmented as a custom Reanimated pill with a sliding indicator (withSpring) and Haptics.selectionAsync() on change. Pin the CTA in a bottom footer above the tab bar via safe-area insets and use KeyboardAvoidingView for the custom-minutes input. Persist lastStyle/lastDurations in MMKV and read them synchronously when state initialises, so no flash. The theme picker can open in a bottom sheet (@gorhom/bottom-sheet) instead of inline. On start: press-in scale animation, Haptics.impactAsync(Medium), POST, then router.push with the first puzzle passed through a module cache or react-query setQueryData. Consider prefetching session creation assets (piece images) here.

**Why M:** Mostly form UI with Segmented controls. The rules (initialStartRating, resolveDurationFor, off-form/comfort flags) are pure and portable. The custom slider (separate feature) and the theme picker add the weight.


## DifficultySlider (piecewise band slider with magnet checkpoints)  ·  complexity M

**Where:** components/DifficultySlider.tsx

**Behaviour**

Track from min=400 to max=3000, step 25. Piecewise scale: bandEdges = [400,1000,1400,1800,2200,3000], so each of the 5 DIFFICULTY_BANDS gets an equal 20% slice and the thumb always sits above its band eye. Layers: a carved track (h 6px, bg eos-well, inset shadow); in zone mode (levelUpFrom set and levelUpFrom < cap) a gold level-up band from pct(levelUpFrom) to pct(cap) (rgba(215,183,119,0.28) with a 1px rgba(215,183,119,0.35) ring); a fill from 0 to value that is muted (#4a4549→#6f6a6e) in the comfort zone and ember (#753132→#a64241) once value >= levelUpFrom; checkpoint ticks (3px gold #d7b777, drawn only for checkpoints other than cap and norm, so in practice the levelUpFrom tick); a locked region beyond the cap (45° repeating stripes rgba(17,15,17,.55/.25)) with a 20px lock disc at the cap; a 'you are here' 3px bone marker at currentRating when it is more than 1% away from the thumb; and a 24px radial-gradient thumb (#f5eee5→#cbc5bf→#938e90) whose halo is a red 4px ring rgba(166,66,65,0.3) in the level-up zone and grey rgba(161,157,163,0.2) in the comfort zone, with left transition 90ms ease-out.
Interaction: pointerdown (with setPointerCapture) and pointermove compute ratio = (clientX - rect.left)/width. MAGNET: if the pointer is within SNAP_PX=14px of any checkpoint (checkpoints = unique [max(min,levelUpFrom), norm, cap] within [min,cap], only in zone mode), the value snaps exactly to it. Otherwise value = round(pctToValue/25)*25, clamped to [min,cap]. onChange fires only when the value changes. Keyboard: arrows ±25, Home=min, End=cap, PageUp/PageDown jump to the next/previous checkpoint.
Band eyes row: 5 equal columns of 32px buttons with 24px BAND_ICON images. Active band: opacity 1 and scale 1.15. Inactive: 0.5. Locked (band.min > cap): 0.25 and disabled. Transition opacity/transform 150ms. Tapping an eye sets the value to the band midpoint rounded to step, clamped to cap.
Anchor labels under the track: min, the levelUpFrom value in gold (only if it is more than 9% from both min and cap), and cap; each is positioned at pct with translateX(-pct%).

**State & persistence:** Stateless (controlled). Refs: trackRef and a dragging flag. Internal pure helpers: clampPct, bandEdges, valueToPct, pctToValue, anchorLabels (not exported).

**Web-only deps:** Pointer events + setPointerCapture + getBoundingClientRect -> react-native-gesture-handler Gesture.Pan()/Tap() with onLayout width; CSS gradients/box-shadows/repeating-linear-gradient -> expo-linear-gradient / react-native-svg pattern or Skia; CSS transition left 90ms -> Reanimated shared value driven on the UI thread; role=slider/aria-* -> accessibilityRole='adjustable' with onAccessibilityAction increment/decrement; Keyboard handlers -> drop (accessibility actions instead); <img> band icons -> expo-image

**Motion & sound:** Thumb left 90ms ease-out. Band eye opacity/scale 150ms. No sound.

**Mobile mapping:** Rebuild with GestureDetector (Pan + Tap racing) and a Reanimated shared value for the thumb x, run entirely on the UI thread with worklet versions of valueToPct/pctToValue. Snap logic stays in the worklet. Call runOnJS(onChange) only when the stepped value changes. Haptics: Haptics.selectionAsync() on every 25-step tick (or throttle to band changes), a stronger impactAsync(Light/Medium) when the magnet snaps to levelUpFrom/norm/cap, and notificationAsync(Warning) when the user drags into the locked cap. Optionally render the track with @shopify/react-native-skia for crisp gradients and hatching at 120Hz.

**Why M:** The custom gesture plus worklet math plus haptic detents is moderate. The math is pure and already isolated.


## ThemePicker (theme-mode drill selection)  ·  complexity S

**Where:** components/ThemePicker.tsx, ThemeRow

**Behaviour**

Tabs 'weakest' (default), 'popular', 'all' (t('play.themes_tab_*')). A search input (t('play.search_themes')) filters the active tab by the localised label (themeLabel(slug, language)) with a case-insensitive substring match. Data comes from GET /analytics/themes with meta themes removed (isMetaTheme). Weakest: sorted by weakness desc. Popular: sorted by attempts desc. All: KNOWN_THEME_SLUGS sorted by localised label (localeCompare), merged with stats where they exist. Empty state: Weakest/Popular with no stats show t('play.themes_no_stats'); no search match shows t('play.no_themes_match'). Each row is a 48px button with a theme icon (themeIcon(slug), 16px), the label and a stat chip whose content depends on the tab: weakest shows XCircle + failure% (≥50 rose, ≥25 amber #d7b777, else sage); popular shows Repeat + attempts; all shows Target + rating (only if rating > 0). The active row gets bg rgba(166,66,65,0.16) with an inset ring rgba(166,66,65,0.55) and an ember icon tile. The list scrolls at max-h 360px.

**API**

- `GET /analytics/themes -> ThemeRow[] {slug, attempts, failureRate, weakness, rating}`

**State & persistence:** react-query key ['analytics-themes','all']. Local state: tab, query. zustand: settings.language. Static: KNOWN_THEME_SLUGS, themeLabel, isMetaTheme (lib/theme-labels), themeIcon (lib/theme-icons, lucide icons).

**Web-only deps:** @tanstack/react-query (works in RN as-is); lucide-react -> lucide-react-native; overflow-y-auto list -> FlashList inside a bottom sheet (BottomSheetFlashList); input -> TextInput

**Motion & sound:** Colour transitions only. No sound.

**Mobile mapping:** Present it as a @gorhom/bottom-sheet with a sticky segmented tab header and search, and a FlashList of rows. Haptics.selectionAsync on pick. Use the same query key so the cache is shared with the analytics screens.

**Why S:** A plain list with sorting and filtering. Logic is pure; the only dependencies are theme label and icon maps.


## Session runner: puzzle loop state machine  ·  complexity XL

**Where:** app/(app)/play/[id]/page.tsx PlayRunner, components/board/Chessboard (external), TurnCard, StatPill, RatingPill, UnlockProgressBar, CalibrationProgressBar, CriterionTick

**Behaviour**

BOOT: takeFirstPuzzle(sessionId) (the stash from setup). If present, applyNextResponse runs synchronously. Otherwise (hard refresh/deep link) it calls POST /sessions/:id/next. If that fails (400 'session ended'), it calls GET /sessions/:id and renders the Summary with those aggregates (zeros if that also fails). applyNextResponse sets durationSec, endsAt = Date.now() + durationSec*1000 (the CLIENT clock is the anchor so no seconds are lost to RTT), sessionStartRating = peakRating = currentRating, sessionStyle and sessionMode from the response, then loadPuzzle(...) and loadingFirst=false.
loadPuzzle(p, currentRating): initPuzzle(p) gives preFen, postFen, setupMove (= moves[0], the opponent's setup move), remaining (moves[1..]) and playerColor (side to move after setup). It sets chess = new Chess(preFen). Orientation = playerColor, unless settings.fixedColor overrides it to white/black. It clears lastMove, sets animateMove={from,to of setup}, and calls patchStyleProgression(sessionStyle, {currentPuzzleRating: currentRating}). It plays sfx('move') immediately. If ANIMATION_MS[animationSpeed] (instant 0 / fast 160 / normal 280 / slow 460) is 0, it swaps to postFen at once. Otherwise after animMs+20ms it swaps to postFen, sets lastMove=setup, sets animateMove=null and starts attemptStart = Date.now() (thinking time starts AFTER the setup animation). allowMoves on the board = !animateMove && !loadingFirst && !paused.
handleMove({from,to,promotion}) returns a boolean to the board. It rejects if there is no chess/puzzle, if opponentBusy, or if remaining is empty. chess.move() mutates the CURRENT Chess instance; an illegal move returns false. It sets lastMove. Sound: when the move does not resolve the puzzle it plays sfx(moveSoundEvent(move)) (promote/castle/check/capture/move); a winning move skips the click so the 'correct' sting plays alone. Branches:
  (a) candidate != expected: if chess.isCheckmate() it is accepted as correct (Lichess puzzles list only one mate, alternatives are fine) and calls afterAttempt(true, to); otherwise afterAttempt(false, to). The wrong move stays on the board until the next puzzle loads.
  (b) candidate == expected and it was the last move: afterAttempt(true, to).
  (c) candidate == expected with more moves: opponentBusy=true. After max(animMs, 80)ms the opponent's reply is played (chess.move), the board is replaced with new Chess(fen), lastMove is set, sfx(moveSoundEvent(reply)) plays, remaining = afterExpected.slice(1) and opponentBusy=false. Immediately (before the timeout) it calls setChess(new Chess(chess.fen())) to re-render with the player's move.
afterAttempt(correct, square): responseMs = now - attemptStart; totalResponseMs += responseMs. On correct, solved++ and peakRating = max(peak, puzzle.rating); otherwise failed++. Plays sfx('correct'|'mistake'). feedbackSquare = {square, correct, id: Date.now()} (id forces a CSS animation restart) and is cleared after 500ms. Streak (in-session run of correct answers): if a wrong move comes while streak >= 2, streakBroken = old streak, cleared after 700ms. Optimistically sets streak = correct ? prev+1 : 0. Then it AWAITS POST /sessions/:id/attempt {puzzleId, correct, responseMs}, patches the progression with currentPuzzleRating=newRating, and reconciles streak = r.streak (errors are swallowed). After the response, setTimeout(nextPuzzle, correct ? 220 : 360). The total gap between puzzles is therefore attempt RTT + 220/360ms + next RTT.
nextPuzzle(): guarded by a loading ref. POST /sessions/:id/next then loadPuzzle. On failure it retries once after 1500ms (covers rolling deploys); if the retry fails it calls finish() (save, which will usually be an early exit).
Timer: a setInterval(250ms) updates `now`, which re-renders the whole runner 4x/s. An effect calls finish() when now >= endsAt && !paused && !finishing. remainingSec = paused ? round(pausedRemainingMs/1000) : max(0, round((endsAt-now)/1000)). Display is fmtDuration (m:ss), or '--:--' while loadingFirst. warnThreshold = min(30, max(10, round(durationSec*0.1))). warning = !loadingFirst && !paused && 0 < remainingSec <= threshold: the pill turns red bg rgba(166,66,65,0.16), border rgba(166,66,65,0.6), text eos-rose, with .pulse-red (1.2s infinite box-shadow pulse). Paused pill: glass with ash text.
isPlayerTurn = orientation colour == chess.turn() (see risk with fixedColor). TurnCard props: orientation, isPlayerTurn, loading=loadingFirst, opponentBusy, streak, streakBroken.
Progress slot under the TurnCard: if calibrating (store progression calibrationSessionsLeft > 0) and mode != theme, CalibrationProgressBar (t('calibration.bar_label'), done/5, ember bar, t('calibration.bar_hint' {style})). Else if sessionEligibleForUnlock (mode != theme && !calibrating && sessionStartRating >= unlockedStartRating - 50) and unlockProgress exists, UnlockProgressBar: the label is t('unlock.progress') or, with a Sparkles icon, t('unlock.met'); 'ceiling → ceiling+50'; a bar at width max(round(ratio*100),2)% (ratio = MIN of the three criteria ratios), sage rgba(148,165,142,0.8) or accent when met, transition width/bg 300ms; three CriterionTick chips (solved/accuracy/peak with their % ratio, sage when met). Else nothing. unlockProgress = computeUnlockProgress(style, {solved, accuracy=solved/attempts, peakRating, startRating}, durationSec), recomputed live.
Stats row: StatPill solved (Check, sage) | RatingPill (theme: t('play.drill') + sessionStartRating; rated: t('play.rating') + store currentPuzzleRating) | StatPill failed (XCircle, rose).
Layout: phones/tablets stack .board-top-slot (min-height 218px, so the board lands at the same y on every board screen) [exit | timer | pause row, TurnCard, progress bar], then the board as the largest square that fits (container-type:size; width=min(100cqw,100cqh)), then stats. lg+ shows the board left and a 320px right panel. Root is h-dvh with padding max(12px, safe-area-top/bottom). On mount html/body get the .play-locked class (overflow hidden, overscroll none, strips app-shell safe-area padding). settings.mirrorView flips the board orientation visually only. While loadingFirst or !settingsReady a centred glass spinner (Loader2 spin) shows. The board renders only when settingsReady.
Focus mode (settings.focusMode): adds body.focus-mode and calls requestFullscreen; on unmount it exits fullscreen.

**API**

- `POST /sessions/:id/next -> {puzzle:{id,fen,moves[],rating,themes[],gameUrl}, currentRating, session:{id,startedAt,durationSec,style,mode}} (400 if ended, 404 if no puzzles)`
- `POST /sessions/:id/attempt body {puzzleId, correct, responseMs:int 0..600000} -> {newRating, step, streak}`
- `GET /sessions/:id -> detail incl. solved, failed, accuracy, avgResponseMs, peakRating (used as fallback summary)`

**State & persistence:** All runner state is local useState: puzzle, chess (Chess instance), loadingFirst, remaining (UCI[]), orientation, lastMove, animateMove, endsAt, durationSec, now, summary, confirmExit, solvedCount, failedCount, opponentBusy, sessionStartRating, sessionStyle, sessionMode, peakRating, totalResponseMs, streak, streakBroken, feedbackSquare, paused, pausedRemainingMs. Refs: attemptStart, loading (next in-flight), finishing, ceilingAtFinish, pauseStartedAt. zustand reads: settings (focusMode, fixedColor, animationSpeed, mirrorView, boardTheme, pieceSet, language), settingsReady, progressions. zustand writes: patchStyleProgression(style, {currentPuzzleRating}), setStreak (daily). Nothing persists across a reload: client counters/streak reset, and the timer restarts at the full duration (the server startedAt is not reset after the first attempt).

**Web-only deps:** setInterval 250ms driving React re-render -> isolate the timer in its own component; use a Reanimated/derived clock or a 1s-aligned interval; never re-render the board on ticks; document.documentElement/body classList (play-locked, focus-mode) -> not needed; fixed-layout screen with no ScrollView; requestFullscreen/exitFullscreen -> expo-status-bar hidden + expo-navigation-bar immersive (Android); also expo-keep-awake activateKeepAwakeAsync during the session; CSS container queries (cqw/cqh), aspect-ratio, h-dvh, env(safe-area-*) -> onLayout measurement: boardSize = min(width, height) of the flex slot; react-native-safe-area-context; CSS .square-feedback 500ms keyframes -> Reanimated opacity animation on an overlay square; CSS .pulse-red infinite box-shadow -> Reanimated withRepeat on a shadow/scale or a ring view; useParams/useRouter (next/navigation) -> expo-router useLocalSearchParams / router.replace; Web Audio sfx (lib/sound.ts) -> react-native-audio-api or expo-audio with preloaded players for low latency; backdrop-blur overlays -> expo-blur BlurView; chess.js (pure JS, works in RN)

**Motion & sound:** Setup move: board piece slide = ANIMATION_MS (0/160/280/460ms); swap to postFen at animMs+20ms. Opponent reply delay max(animMs,80)ms. Destination-square feedback: 500ms ease-out keyframes (opacity 0 → 1 by 15%, hold to 70%, → 0), green rgba(94,218,137,0.7) / red rgba(223,78,77,0.7), drawn above the piece. Next puzzle after attempt response + 220ms (correct) / 360ms (wrong). Timer warning pulse-red 1.2s ease-in-out infinite (box-shadow 0 → 10px rgba(223,78,77,0.55→0)). Unlock bar width 300ms. Spinner Loader2 animate-spin. Sounds: 'move' on the setup move; moveSoundEvent per move ('promote'|'castle'|'check'|'capture'|'move'); 'correct' / 'mistake' on resolution (the winning move's click is suppressed).

**Mobile mapping:** Build the runner as a pure reducer/state machine (e.g. useReducer or a zustand slice with XState-like phases: booting → setupAnimating → playerTurn → opponentReplying → resolving → loadingNext → finished, plus a paused overlay flag), separate from the view, so it is testable and the board re-renders only on FEN/lastMove changes. Board: a Skia or Reanimated + gesture-handler chessboard (drag with Pan, tap-to-move with Tap), piece slides as UI-thread withTiming(ANIMATION_MS). Feedback square and haptics fire in the same frame as the drop. Prefetch the next puzzle: POST /next can only follow /attempt (the server serves at the post-attempt rating), but the UI can show the feedback while both run, and the 220/360ms delays can overlap the RTT instead of adding to it. Use AppState to auto-pause when the app goes to background, which web does not do (see risks). Lock the gesture-back / Android hardware back to requestExit(). Keep the screen awake. Use react-native-safe-area-context for insets. Haptics (expo-haptics): impactLight on piece pickup, impactMedium on drop, notificationSuccess on a correct solve, notificationError on a mistake, and light ticks in the last 10s of the timer.

**Why XL:** This is the heart of the app: a native chessboard with drag/tap/animations/promotion at 60–120fps, a timing-sensitive state machine with several timeouts, sound sync, haptics, pause/background handling and network retries. The current code relies on stale-closure quirks and in-place Chess mutation that must be redesigned, not transliterated.


## TurnCard + in-session streak chip  ·  complexity S

**Where:** components/board/TurnCard.tsx

**Behaviour**

A glass card with a 44px round tile (sq-marble for white / sq-slate for black, inset shadows) holding a 36px king image from pieceUrl(pieceSet, 'w'|'b', 'k'). Title and subtitle priority: override (used by the review/puzzle viewers) > loading: t('play.loading_puzzle') > opponentBusy || !isPlayerTurn: t('play.opponent_moving') > your turn: t('play.your_turn') + t('play.find_best_white'|'play.find_best_black'). Title is a 15px bold serif and truncates. Streak chip: shown when streak >= 2 ('🔥 N', bg rgba(166,66,65,0.16), text #d8847c) or when streakBroken != null ('🔥 N' with line-through, text eos-rose, shown for 700ms). Its React key ('broken-N' / 'alive-N') remounts it on each change. The 'transition-opacity duration-500' has no effect because both states use opacity-100, so in practice it pops with no animation. Shared with the review runners, which omit the streak.

**State & persistence:** Props only. zustand settings.pieceSet (normalizePieceSet).

**Web-only deps:** <img> piece SVG/PNG URLs from lib/pieces pieceUrl -> bundled piece assets (react-native-svg or expo-image); CSS classes sq-marble/sq-slate textures -> image backgrounds or Skia shaders; emoji 🔥 -> fine in RN (or replace with an icon)

**Motion & sound:** Effectively none today (instant swap). Opportunity: a spring scale-pop on increment and a shake/fade on break (the CSS file has an unused-looking streak-breath keyframe; not verified).

**Mobile mapping:** A plain View with Reanimated entering/exiting layout animations for the chip (ZoomIn on increment, a FadeOut + horizontal shake on break). Haptics: light impact per streak increment ≥2, a stronger impact at milestones (5/10), notificationWarning on break.

**Why S:** Small presentational component. Only the piece asset pipeline is shared work.


## Pause / resume  ·  complexity S

**Where:** PlayRunner pause()/resume(), PauseOverlay

**Behaviour**

The pause button (glass, Pause/Play icon) is disabled while loadingFirst. pause() is a no-op if already paused, if !endsAt or loadingFirst, or if finishing. It stores pausedRemainingMs = max(0, endsAt - now) and pauseStartedAt, and sets paused=true. While paused: the timer effect skips finish, the pill shows the frozen remaining time, warning styling is off, and the board's allowMoves is false. A full-screen overlay (z 60, bg-black/70, backdrop-blur-md, which hides the position) shows the remaining m:ss in 48px extrabold, t('play.paused') in serif, t('play.paused_hint') and a Resume button. resume() adds the pause duration to attemptStart.current (so responseMs counts only active time), sets endsAt = now + pausedRemainingMs and clears the pause. Pause does NOT cancel in-flight timeouts (setup-move swap, opponent reply, next-puzzle load), so those still land under the overlay. There is no auto-pause on tab hide/visibilitychange. The server knows nothing about pauses: its early-exit check uses wall-clock elapsed vs durationSec, and since pausing only delays the client's natural finish, it never causes a false early exit.

**State & persistence:** Local: paused, pausedRemainingMs, pauseStartedAt ref, plus the endsAt and attemptStart adjustments. Not persisted.

**Web-only deps:** fixed overlay with backdrop-filter blur -> expo-blur BlurView (intensity ~40, tint dark) in an absolute View or a transparentModal route

**Motion & sound:** No transition today (overlay mounts instantly). No sound.

**Mobile mapping:** Same logic in the runner reducer. Add an AppState 'background'/'inactive' listener that auto-pauses (important on phones: calls, notifications, app switch). Optionally auto-pause on incoming push banners. Fade in the BlurView over 150–200ms with Reanimated. Haptics.impactAsync(Light) on pause/resume.

**Why S:** Simple timestamp arithmetic. The main new work is AppState integration and the policy decision for background.


## Exit flow: save vs discard (early exit)  ·  complexity S

**Where:** PlayRunner requestExit(), ExitDialog, finish()

**Behaviour**

The Exit button (glass, X + t('play.exit')) calls requestExit. With 0 attempts it calls finish({save:false}) straight away; the server deletes the session and the client router.replace('/dashboard'). With ≥1 attempt it opens ExitDialog: a bottom-aligned sheet on mobile (centred on md+) over a bg-black/70 backdrop-blur-sm backdrop. Tapping the backdrop cancels. Copy is HARDCODED en/uk (not i18n): title 'End session?' / 'Завершити сесію?'; body explaining that Save records stats but won't count toward level-up. Buttons: Save (btn-ember, serif uppercase) calls finish({save:true}); Discard (rose outline) calls finish({save:false}); Keep playing (neutral) closes. The timer keeps running while the dialog is open. Server side, save=true before durationSec-3s returns early:true with stats saved, the daily streak ticked, achievements evaluated and NO unlock/demote/calibration change. Discard: restores currentPuzzleRating/startPuzzleRating to session.startRating (rated modes), deletes ReviewItems created during this session for failed puzzles (createdAt >= session.startedAt; a previously-resolved item that was un-resolved stays un-resolved), clears the puzzle buffer, deletes the session (attempts cascade) and returns {discarded:true}. UserPuzzleHistory upserts are NOT rolled back on discard.

**API**

- `POST /sessions/:id/finish?save=false&localDate=YYYY-MM-DD -> {discarded:true}`
- `POST /sessions/:id/finish?localDate=YYYY-MM-DD -> FinishResponse (see summary feature)`

**State & persistence:** Local confirmExit. finishing ref guards double-finish. Server: TrainingSession, TrainingAttempt, ReviewItem, UserStyleProgression, User streak fields.

**Web-only deps:** fixed overlay dialog -> @gorhom/bottom-sheet modal or a native Alert/ActionSheetIOS (three actions); router.replace('/dashboard') -> expo-router router.replace('/(tabs)')

**Motion & sound:** None today.

**Mobile mapping:** Use a bottom sheet with three large buttons (thumb reach), or ActionSheetIOS on iOS with Discard as destructiveButtonIndex. Intercept the Android hardware back (BackHandler) and the iOS swipe-back (gestureEnabled:false on the runner route, or a beforeRemove listener) and route both to requestExit. Move the hardcoded strings into i18n. Haptics: notificationWarning when the sheet opens.

**Why S:** Straightforward UI. The rules live on the server.


## Session finish & summary screen (outcome cards)  ·  complexity M

**Where:** SessionSummary, EarlyExitNote, LevelUpExplainer, ComfortSessionNote, UnlockOutcome, DemoteOutcome, CriterionRow, Stat, ReviewThisSession, CountTo, FillCount

**Behaviour**

finish(opts): guarded by the finishing ref. Sends localDate = formatLocalDate(new Date()) (the device's local YYYY-MM-DD) and save=false when discarding. On {discarded} it calls router.replace('/dashboard'). Otherwise: if r.streak, it updates the store's daily streak {days, freezes, lastDay, freezeRegenAt}; for each r.achievementsUnlocked slug it pushes a toast {tone:'achievement', title t('achv.<slug>.name'), description t('achv.<slug>.desc'), achievementSlug}; then setSummary(r). If the network fails, it builds the summary from client counters (solved, failed, accuracy, avg = totalResponseMs/attempts, peakRating).
The summary is rendered by the same runner route, with paddingTop calc(2.5rem + safe-area-top). Title t('play.session_complete'). Outcome area:
 - early: EarlyExitNote (t('play.early_exit_title'/'early_exit_hint')).
 - calibration active: only on the FINAL calibration session (sessionsLeftAfter===0), LevelUpExplainer (accent card with Sparkles, t('calibration.complete_title'), 'complete_summary' {ceiling=ceilingAfter}, bullets '+50 intro_unlock {floor=ceiling-50}' and '−25 intro_demote'). Non-final calibration sessions show nothing (calibration is meant to be invisible).
 - stable + demoteCheck.atPeak===false: ComfortSessionNote (t('play.comfort_summary_title'/'comfort_summary_hint' {floor})).
 - stable at peak: UnlockOutcome when unlockCheck exists. If unlocked, a .norm-rise accent card with Sparkles (.norm-icon-rise), t('unlock.summary_success') and a hint with {reward} counting 0→50. If not, a neutral card 'summary_near' + 'summary_near_hint' + CriterionRow list (check/X, label, current/target formatted: accuracy %, peak +N, solved count). Then DemoteOutcome (only if !unlocked): renders nothing when !weak && !demoted. If demoted, a .norm-drop rose card with TrendingDown (.norm-icon-drop), t('demote.summary_demoted' {penalty}) and a hint with {ceiling} counting from unlockedStartRating+penalty to unlockedStartRating. If weak but not yet demoted, an amber card t('demote.summary_weak') with t('demote.summary_weak_hint' {remaining = threshold - streakAfter}).
Stats grid (2 columns): solved, failed, accuracy %, avg (fmtResponseTime: seconds with 1 decimal), peak.
ReviewThisSession: GET /sessions/:id/review-items, counts failed and slow. If either > 0, a card links to /sessions/:id/review (t('review.session_heading'/'session_hint' {failed}{slow}/'session_cta')). Server slow cutoff = max(1.5 × session avg responseMs, 5000ms); failures always count; a duplicate puzzle keeps the worse reason.
Buttons: 'Home' (hardcoded English) → <a href='/dashboard'>, and t('play.play_again') → <a href='/play'>. Both are full page loads, which is what re-fetches /users/me and refreshes progressions (see risks).
Rank change: rankChange is null if early, calibration active or ceilingBefore null. after = ceilingBefore+50 if unlocked, else demoteCheck.unlockedStartRating if demoted. It is null if after === before. from/to = bandFor(...).key; crossed = from != to; up = band index increased OR (same band && after > before). If crossed, the RankCeremony shows first (state initialised from crossed) and the summary appears after Continue. If not crossed, the summary plays sfx('gate') (up) or sfx('rankDown') on mount, and the effect cleanup calls stopLongClip(400). ceilingAtFinish holds the store's unlockedStartRating, captured on every render until finishing starts.

**API**

- `POST /sessions/:id/finish?localDate=YYYY-MM-DD[&save=false] -> {sessionId, solved, failed, accuracy, avgResponseMs, peakRating, durationSec, style, unlocked?, early?, unlockCheck?{met, style, solvedTarget, criteria[{id,met,current,target}]}, demoted?, demoteCheck?{atPeak,weak,criteriaMet,streakAfter,threshold,penalty,unlockedStartRating}|null, calibration?{active,sessionsLeftBefore,sessionsLeftAfter,ceilingBefore,ceilingAfter,delta}|null, streak?{days,freezes,lastDay,freezeRegenAt,outcome}|null, achievementsUnlocked?: string[]} (idempotent: an already-ended session returns the plain summary)`
- `GET /sessions/:id/review-items -> {items:[{puzzleId, reason:'failed'|'slow', responseMs, rating, fen, moves, themes}]}`

**State & persistence:** summary (local), ceremony (local, initialised from rankChange.crossed), ReviewThisSession count (local; a react-query candidate). zustand: setStreak (daily streak), toast store push. Progressions are NOT patched from the finish response (unlockedStartRating, calibrationSessionsLeft, weakSessionStreak go stale until /users/me is refetched).

**Web-only deps:** <a href> full reloads -> router.replace + explicit invalidate/refetch of /users/me (or return updated progression in the finish response); CSS keyframes norm-rise (900ms cubic-bezier(.2,1.25,.4,1): opacity 0, scale .92, y+10 → glow 22px rgba(215,183,119,.45) at 40% → rest), norm-icon-rise (1100ms, 200ms delay, scale .3 rotate -90° → 1/0°), norm-drop (900ms cubic-bezier(.2,.8,.3,1): drop from y-14, horizontal shake -7/6/-4/2px, rose ring expanding to 14px), norm-icon-drop (900ms, 250ms delay, y-10 → 0) -> Reanimated keyframes (Keyframe API) or withSequence; CountTo uses requestAnimationFrame + performance.now + matchMedia(prefers-reduced-motion) -> Reanimated withDelay(350, withTiming(to, {duration:900, easing: Easing.out(Easing.cubic)})) + AnimateableText/ReText; AccessibilityInfo.isReduceMotionEnabled / useReducedMotion(); toast store (web component) -> native toast (burnt / sonner-native) or a custom Reanimated toast

**Motion & sound:** Outcome card animations as listed (900–1100ms with springy cubic-beziers). Number count-up: ease-out cubic, 900ms, 350ms delay; skipped under reduced motion. Sounds: 'gate' (in-band norm up) / 'rankDown' (in-band norm down); a long clip is stopped with a 400ms fade on unmount. Under prefers-reduced-motion all norm-* animations are disabled.

**Mobile mapping:** A separate expo-router route (e.g. /play/[id]/summary) or a phase of the runner screen. Use router.replace so back doesn't return into a finished runner. Invalidate react-query ['me'] / refresh the progressions store after finish. Haptics: notificationSuccess on unlock, notificationError on demote, notificationWarning on the weak-session heads-up, a soft impact per achievement toast. Schedule local/push follow-ups here (streak, review reminders). Use FlashList or a ScrollView for the summary. Render ReviewThisSession through react-query.

**Why M:** Several conditional cards and animations, but all data comes from one response. The main subtlety is the store refresh, which the web gets for free from full reloads.


## RankCeremony (full-screen band change)  ·  complexity M

**Where:** components/RankCeremony.tsx

**Behaviour**

Full-screen dialog (portal to body, z 50, bg eos-ink) shown when the norm crosses a difficulty band boundary. Props: direction up/down, from/to band keys, normFrom/normTo, styleLabel, onClose. Timeline: on mount the sound plays (up: to==='expert' → 'rankFinal', to==='advanced' → 'rankMangekyo', else 'rankTomoe'; down: 'rankDown'). At 40ms stage 1: the old band eye (200px) spins with .rank-spin (1000ms cubic-bezier(.5,0,.2,1): rotate 0 → 900° with scale 1.08 at 80% → 1080° with scale 1.15 and opacity 0). At 950ms (up) / 750ms (down) / 200ms (reduced motion) stage 2: the new eye pops with .rank-pop (900ms cubic-bezier(.2,1.3,.4,1): scale .6 rotate -120° → 1/0°). Up adds a drop-shadow 26px glow: expert rgba(149,98,206,0.6), otherwise rgba(201,81,70,0.55). Down applies grayscale(0.85) brightness(0.75). Up also gets a white .rank-flash overlay (700ms: opacity 0 → 0.55 at 15% → 0). The norm number counts from normFrom to normTo in 14 setTimeout steps over 600ms. Background radial glow rgba(176,58,58,glow) with glow up 0.08 → 0.22 → 0.34 per stage and down 0.14 → 0.04, transition 500ms. The text block (t('rank.up'|'rank.down') in tracking-0.25em, h2 t('levels.<to>') serif 36px, t('rank.norm' {style}) 'from → n', and the flavour line t('rank.line_final'|'line_mangekyo'|'line_tomoe'|'line_down')) fades and slides up from y+14px over 500ms with a 150ms delay. The Continue button (btn-ember 52px, t('rank.continue'), autoFocus) fades in over 500ms with a 500ms delay. Close calls stopLongClip(500) then onClose. The ceremony is never shown for calibration sessions or early exits.

**State & persistence:** Local stage 0|1|2, norm counter, mounted flag, timers ref (all cleared on unmount).

**Web-only deps:** createPortal(document.body) -> RN Modal (presentationStyle overFullScreen, animationType none) or a fullScreenModal route; CSS keyframes rank-spin/rank-pop/rank-flash, CSS filter drop-shadow/grayscale/brightness -> Reanimated transforms; glow via Skia (Shadow/BlurMask) or a pre-rendered glow PNG; grayscale via Skia ColorMatrix or a desaturated asset variant; radial-gradient background -> Skia RadialGradient or react-native-svg RadialGradient; window.matchMedia reduced-motion -> Reanimated useReducedMotion(); setTimeout-based number count -> Reanimated derived text

**Motion & sound:** As above. Sound clips: rankTomoe, rankMangekyo, rankFinal, rankDown (long clips, faded out with stopLongClip(500) on close).

**Mobile mapping:** The signature moment for the native app. Reanimated withSequence/withDelay on the UI thread, with Skia for the glow and flash at 120Hz. Haptics choreography: a light ticking rhythm during the spin (e.g. 3–4 impactLight spaced over 900ms), a heavy impact + notificationSuccess at the pop/flash (up), a long soft impact for down. Sync sound start with the animation start (preload clips before showing). Optional expo-av/expo-audio ducking.

**Why M:** Self-contained, but the visual effects (glow, flash, grayscale) need Skia or asset work and careful sync of audio and haptics.


## Backend session rules (create / next / attempt / finish)  ·  complexity S

**Where:** apps/backend/src/sessions/sessions.service.ts, rating.ts, unlock.ts, streak.ts, sessions.controller.ts, dto.ts

**Behaviour**

All routes use JwtAuthGuard under /sessions.
CREATE: loads or creates the UserStyleProgression for (user, style). calibrating = mode!=='theme' && calibrationSessionsLeft > 0. In that case startRating = progression.currentPuzzleRating and the client value is IGNORED. In stable mixed mode it throws 400 if startRating > unlockedStartRating + 200. Inserts TrainingSession {mode, style, theme, startRating, durationSec}. For rated modes it sets progression.currentPuzzleRating = startPuzzleRating = startRating (so startPuzzleRating now means 'last rated session's start'). Pops the first puzzle synchronously from PuzzleBufferService.getNext({sessionId, userId, rating: startRating, theme}) (an error is logged and firstPuzzle becomes null). Resets startedAt = now and returns it.
NEXT: 400 if the session has ended. If the attempt count is 0, startedAt is reset to now. servingRating = theme ? session.startRating : progression.currentPuzzleRating. 404 'no puzzles available' if the buffer is empty.
ATTEMPT: 400 if ended, 404 if the puzzle is unknown. Inserts a TrainingAttempt {puzzleRating, correct, responseMs}. Upserts UserPuzzleHistory (lastSeenAt, seenCount++). If wrong, upserts a ReviewItem (resolvedAt=null). The in-session streak is the count of consecutive correct answers from the last 50 attempts. Theme mode returns {newRating: startRating, step 0, streak}. Rated mode: computeRatingStep(currentPuzzleRating, last WINDOW=4 attempts, streak). Per attempt: sign ±1 × base 12 × speedFactor × diffAdj. speedFactor clamps ms to [4000,12000] with norm 1 at fast → 0 at slow; correct = 0.5+norm (0.5..1.5); wrong = 0.8-0.3·norm (0.5..0.8). difficultyFactor = 1 + clamp(puzzleRating-current, ±200)/400 (0.5..1.5); for a wrong answer diffAdj = 2-diff. Step = average over the window; if step > 0 and streak > 1, step × (1 + min(streak-1, 9) × 0.04) (max 1.36×); rounded. New rating clamped to [400, 3000] and persisted. Returns {newRating, step, streak}.
FINISH(save, localDate): an already-ended session returns its summary (idempotent). Discard path as described in the exit feature. Save: deriveSessionStats (solved, failed, accuracy, avgResponseMs rounded, peakRating = max puzzleRating of correct attempts, floored at startRating), session marked ended, tickStreak(localDate). Then:
 - theme: clears the buffer, evaluates achievements, returns summary + unlocked:false + streak + achievementsUnlocked.
 - early exit: elapsed = now - startedAt; early if elapsed < durationSec - 3s. Same as theme plus early:true. No progression change.
 - calibration (calibrationSessionsLeft > 0): evaluateUnlock gives the criteria; criteriaMet 0..3 maps to step [-125, -50, 0, +50] applied to session.startRating; raw = max(startPuzzleRating, startRating+step), snapped to the 50-grid (round(raw/50)*50); ceilingAfter = that value; sessionsLeft--; weakSessionStreak reset to 0. delta = after - previous unlocked. delta > 0 maps to unlocked=true; delta < 0 maps to demoted=true with a synthetic demoteCheck {atPeak true, weak true, threshold 1, penalty -delta}. (The frontend summary ignores these flags during calibration.)
 - stable: atPeak = startRating >= unlocked - DEMOTE_PEAK_BAND(50). unlocked = check.met && atPeak gives unlocked+50 and weak streak 0. evaluateDemote: weak = atPeak && criteriaMet <= 1. Streak transitions: unlock resets to 0; not at peak leaves it unchanged (comfort zone doesn't punish); at peak and weak adds 1; at peak and not weak resets to 0. demoted = streakAfter >= WEAK_STREAK_THRESHOLD(2), after which the streak resets to 0. On demote, nextUnlocked = max(startPuzzleRating, unlocked - DEMOTE_PENALTY 25). demoteCheck carries threshold 2.
 - the progression is persisted if anything changed, the buffer cleared, achievements evaluated.
Unlock criteria per style (STYLE_FORMULAS, duplicated in the frontend levels.ts): bullet solvedPerMin 6.5 / floor 3 / acc 0.65 / peakDelta 75 / presets 60,120,180s / range 60–600s; blitz 4.2 / 5 / 0.70 / 100 / 300,600,900 / 60–1800; rapid 1.9 / 5 / 0.80 / 120 / 600,1200,1800 / 300–3600. solvedTarget = max(floor, round(minutes × solvedPerMin)). peak criterion = peakRating - startRating >= peakDelta. Note the server does NOT validate durationSec against the per-style min/max (DTO allows 60..3600 for all styles).
DAILY STREAK (streak.ts, applyStreakOnPlay): runs for any saved session (theme, calibration, early, full); skipped if localDate is missing or invalid (isValidDay round-trip check). Freeze max 1, regenerates 7 days after use (checked before streak logic). Outcomes: same day → 'same-day'; first play or days==0 → 'started' (1); a negative gap (clock skew) is refused as 'same-day'; gap 1 → 'continued' (+1); gap 2 with a freeze → 'frozen' (+1, freeze consumed, regenAt = today+7); otherwise 'reset' to 1. ('skipped' exists in the response type but is never produced here.)
REVIEW ITEMS and DETAIL as described elsewhere. DELETE /sessions/:id is used by swipe-to-delete in the sessions list.

**API**

- `POST /sessions`
- `POST /sessions/:id/next`
- `POST /sessions/:id/attempt`
- `POST /sessions/:id/finish?save&localDate`
- `GET /sessions/:id`
- `GET /sessions/:id/review-items`
- `DELETE /sessions/:id`

**State & persistence:** Prisma models: TrainingSession (mode, style, theme, startRating, durationSec, startedAt, endedAt, solvedCount, failedCount, accuracy, avgResponseMs, peakRating), TrainingAttempt, UserPuzzleHistory, ReviewItem, UserStyleProgression (startPuzzleRating, currentPuzzleRating, unlockedStartRating, calibrationSessionsLeft, weakSessionStreak), User (streakDays, streakFreezes, streakLastDay, streakFreezeRegenAt). PuzzleBufferService (Redis-backed per-session queue; not read) getNext/clearSession. AchievementsService.evaluate.

**Motion & sound:** n/a

**Mobile mapping:** The backend stays as is for mobile. Changes that help mobile: (1) return the updated progression for the style in the /finish response (and maybe /attempt) so the app needs no /users/me refetch; (2) store the user's IANA timezone (expo-localization) so the server can schedule streak-at-risk pushes; (3) add a push-token registration endpoint plus a scheduler; (4) optionally let /attempt return the next puzzle in the same round-trip to cut latency.

**Why S:** No port needed. The rules are documented here, and only small API additions are suggested for mobile.


## StyleIcon + style catalog  ·  complexity S

**Where:** components/StyleIcon.tsx

**Behaviour**

Time-control glyphs: rapid = hourglass (/design/icons/mode-rapid.png), blitz = lightning (mode-blitz.png), bullet = kunai (mode-bullet.png). Each is a single-colour CSS mask filled with currentColor, so it follows the text colour of its context. Also exports STYLE_ORDER ['rapid','blitz','bullet'] and STYLE_COLORS (all 'text-eos-bone', legacy). The `colored` prop is accepted but unused.

**State & persistence:** None.

**Web-only deps:** CSS mask/-webkit-mask with bg-current -> <Image source={require(...)} style={{tintColor}} /> (expo-image tintColor) or convert to SVG icons

**Motion & sound:** None.

**Mobile mapping:** expo-image with tintColor from the theme, or convert the PNGs to SVG components via react-native-svg-transformer.

**Why S:** Trivial asset mapping.


## First-puzzle hand-off (pending-puzzle)  ·  complexity S

**Where:** lib/pending-puzzle.ts

**Behaviour**

A module-level Map<sessionId, FirstPuzzlePayload>. stashFirstPuzzle on setup and takeFirstPuzzle (read once, then deleted) in the runner. This avoids a second /next round-trip, so the board appears with no extra request. If the entry is missing (reload/deep link), the runner falls back to /next.

**State & persistence:** In-memory module state only.

**Motion & sound:** n/a

**Mobile mapping:** Works verbatim in RN (module state survives navigation in one JS runtime). Alternatively use queryClient.setQueryData(['session', id, 'first'], payload). Also prefetch the puzzle's piece images in setup.

**Why S:** Pure TS, copy as-is.


## creators.ts (founder nickname badge)  ·  complexity S

**Where:** lib/creators.ts

**Behaviour**

CREATOR_NICKNAMES = Set(['lazynightowl']). isCreatorNickname(nick) does a case-insensitive check. It is used by Avatar (ring + crown) and UserBadges. Not used in the training loop itself.

**State & persistence:** Static constant.

**Motion & sound:** n/a

**Mobile mapping:** Copy verbatim into the shared package.

**Why S:** Two lines of pure TS.


## Shared-logic candidates

- `apps/frontend/src/lib/levels.ts` — Band, DIFFICULTY_BANDS, bandFor, TrainingStyle, TRAINING_STYLES, DEFAULT_STYLE, StyleFormula, STYLE_FORMULAS, UNLOCK_REWARD, CALIBRATION_SESSIONS, solvedTarget, UnlockStats, CriterionId, CriterionProgress, computeUnlockProgress, isTrainingStyle — blockers: BAND_ICON holds web URL paths (/design/icons/*.webp): move it out to a per-platform asset map (RN needs require()). It duplicates backend unlock.ts (STYLE_FORMULAS, UNLOCK_REWARD, CALIBRATION_SESSIONS, solvedTarget), so make one packages/shared module used by backend, web and mobile. Note that TRAINING_STYLES order differs (frontend rapid,blitz,bullet; backend bullet,blitz,rapid); keep an explicit UI order constant.
- `apps/backend/src/sessions/unlock.ts` — UNLOCK_REWARD, DEMOTE_PENALTY, DEMOTE_PEAK_BAND, DEMOTE_MAX_CRITERIA, WEAK_STREAK_THRESHOLD, CALIBRATION_SESSIONS, CALIBRATION_STEP_BY_CRITERIA, STYLE_FORMULAS, solvedTarget, evaluateUnlock, evaluateCalibration, evaluateDemote, isTrainingStyle — blockers: None (pure). The frontend hardcodes PEAK_BAND=50 in 4 places (play/page.tsx, play/[id]/page.tsx x3); import DEMOTE_PEAK_BAND instead.
- `apps/backend/src/sessions/rating.ts` — computeRatingStep, deriveSessionStats, AttemptWindow — blockers: None (pure). Useful for optimistic client-side rating preview.
- `apps/backend/src/sessions/streak.ts` — STREAK_FREEZE_MAX, STREAK_FREEZE_REGEN_DAYS, StreakState, isValidDay, applyStreakOnPlay — blockers: None (pure). Useful on mobile for computing local 'streak at risk' notifications.
- `apps/frontend/src/lib/puzzle.ts` — ServerPuzzle, PuzzleState, InitResult, initPuzzle, SOLVED_PAUSE_MS, uciFromMove — blockers: Depends on chess.js, which is pure JS and runs in Hermes. Check that the chess.js version is compatible with Hermes (it is ESM).
- `apps/frontend/src/lib/pending-puzzle.ts` — FirstPuzzlePayload, stashFirstPuzzle, takeFirstPuzzle — blockers: None.
- `apps/frontend/src/lib/creators.ts` — CREATOR_NICKNAMES, isCreatorNickname — blockers: None.
- `apps/frontend/src/lib/utils.ts (partial)` — fmtDuration, fmtResponseTime, formatLocalDate — blockers: The same file exports cn() using clsx + tailwind-merge (web-only styling). Split the formatters into a pure module.
- `apps/frontend/src/components/DifficultySlider.tsx (internal helpers)` — bandEdges, valueToPct, pctToValue, clampPct, anchorLabels, SNAP_PX, checkpoint construction — blockers: Not exported today and embedded in a DOM component. Extract to a pure module; on mobile they must also be marked 'worklet' for Reanimated (or kept as a duplicate worklet version).
- `apps/frontend/src/app/(app)/play/page.tsx (internal helpers)` — initialStartRating(p), defaultDurationFor/resolveDurationFor (minus storage), offFormRating formula, showComfortNotice/showOffForm predicates, ratingCap rule — blockers: Coupled to localStorage reads (readStoredDurations). Refactor to take the stored map as a parameter.
- `apps/frontend/src/app/(app)/play/[id]/page.tsx (internal helpers)` — FinishResponse/NextResponse types, rankChange computation, formatCriterion, warnThreshold formula, sessionEligibleForUnlock predicate, summary branch selection (early / final calibration / comfort / unlock / demote) — blockers: Inline in components. Extract into a pure 'session-outcome' module plus a runner reducer so web (while it lives) and mobile share them.
- `apps/frontend/src/lib/store.ts (partial)` — ANIMATION_MS, Progression, Progressions, EMPTY_PROGRESSION, AnimationSpeed, ColorMode — blockers: The zustand store itself uses localStorage (taktic.settings, taktic.lang); the constants and types are pure. Mobile should create its own store with MMKV persistence.
- `apps/frontend/src/lib/sound.ts (partial)` — moveSoundEvent (pure mapping of a chess.js move to an event), SoundEvent names — blockers: The rest is Web Audio. Only the event mapping and names are shareable.

## Haptics opportunities

- Piece pickup (drag start / first tap select): impactLight
- Piece drop on a legal square: impactMedium; illegal drop / snap back: notificationWarning (pairs with the existing piece-shake CSS idea)
- Correct solve: notificationSuccess, fired on the same frame as the green square flash and the 'correct' sfx
- Mistake: notificationError with the red flash and the 'mistake' sfx
- Opponent reply landing: a very soft impactLight (optional, setting-gated)
- Streak chip increment at >=2: impactLight; milestones 5/10/15: impactMedium/Heavy
- Streak broken (streakBroken set, 700ms chip): notificationWarning
- Timer warning threshold crossed (min(30,max(10,10% of duration)) s): notificationWarning once; then selection ticks each second for the last 5–10s
- Time's up / session finish: notificationSuccess or a heavy impact
- Pause / resume: impactLight
- Exit dialog opens: notificationWarning; Discard confirm: impactHeavy
- DifficultySlider: selection tick per 25-step change (throttled), stronger detent impact when the magnet snaps to levelUpFrom / norm / cap, warning when pushing into the locked region past the cap, a tick when crossing a band boundary
- Segmented controls (style/duration/mode) and ThemePicker row pick: selectionAsync
- Off-form CTA tap (sets the suggested rating): impactLight
- Start session CTA: impactMedium
- Summary: unlock card (norm-rise) notificationSuccess; demote card (norm-drop) notificationError synced to the shake keyframes; weak-session amber card notificationWarning
- RankCeremony: rhythmic light impacts during the 1000ms spin, heavy impact + success at the pop/flash (up), long soft rumble for rank down
- Achievement toast arrival: impactMedium
- Calibration complete (LevelUpExplainer): notificationSuccess

## Push opportunities

- Daily streak at risk: the user played yesterday (streakLastDay = yesterday) and not today, so remind them in the local evening. Needs the user's timezone stored server-side (today only the client-sent localDate exists, with no TZ on User), or schedule it as a LOCAL notification on device after each finish using streak.ts logic and expo-notifications.
- Freeze consumed: finish outcome 'frozen' gives 'Your freeze saved your N-day streak' (local or immediate push).
- Freeze regenerated: at streakFreezeRegenAt (YYYY-MM-DD, 7 days after use), schedule a local notification.
- Streak reset warning: gap 2 with no freeze means tomorrow the streak resets. Send an earlier/stronger reminder when freezes=0.
- Calibration progress: 'N of 5 calibration sessions left for <style>' nudges until calibrationSessionsLeft hits 0.
- Off-form / weak streak: weakSessionStreak > 0 means one more weak at-peak session drops the norm. A gentle 'try a warm-up session' push (the setup's offFormRating).
- Close to level-up: when the last session met 2 of 3 criteria, send 'You were one criterion away from +50' the next day.
- Review queue: failed/slow items exist from a session (GET /sessions/:id/review-items or ReviewItem table), so remind them to drill the mistakes.
- Achievements unlocked server-side (achievementsUnlocked on finish) can also be push-delivered if earned via other paths.
- Session interrupted: if the app was backgrounded mid-session (AppState), a local notification 'Your session is paused — resume' (only if auto-pause is adopted).

## Risks

- Stale-closure bug on the first puzzle: applyNextResponse calls setSessionStyle(...) and then loadPuzzle() synchronously, but loadPuzzle reads the OLD `sessionStyle` state (DEFAULT_STYLE 'blitz'). So patchStyleProgression writes the rapid/bullet session's currentRating into the BLITZ progression in the client store until /users/me is refetched. The mobile reducer must take the style from the response, not from state.
- Theme sessions pollute the client store: loadPuzzle and afterAttempt patch progressions[style].currentPuzzleRating with the theme's fixed startRating (server returns newRating=session.startRating), even though theme sessions are unrated server-side. This skews the setup slider's initialStartRating until a reload.
- Progressions are never patched from /finish (unlockedStartRating, calibrationSessionsLeft, weakSessionStreak). The web only looks right because the summary's Home / Play again are <a href> full page loads that re-run the /users/me boot fetch. With in-app navigation on mobile this breaks unless the app refetches explicitly or the API returns the updated progression.
- Possible backend logic conflict: create() sets startPuzzleRating = startRating on EVERY rated session (recent commits repurposed it as 'last picked start rating'). But unlock.ts/finish still use startPuzzleRating as the entry FLOOR: demote nextUnlocked = max(startPuzzleRating, unlocked-25) and calibration raw = max(startPuzzleRating, startRating+step). With the session started at >= unlocked-25, a demote clamps to no change, yet demoted=true and the rose 'demoted' card shows wrong numbers. In calibration the -125/-50 steps are neutralised relative to startRating. Verify with the owner before porting the rules; tests not checked.
- Pause does not cancel pending timeouts (setup-move swap at animMs+20, opponent reply, next-puzzle setTimeout and fetch), so state changes land under the pause overlay. There is no auto-pause when the app is hidden. On mobile, backgrounding mid-session would silently burn the timer unless AppState auto-pause is added.
- Reload or deep-link mid-session: the client restarts the timer at the FULL duration (endsAt = now + durationSec) and zeroes its counters/streak, while the server's startedAt is unchanged. Elapsed time is preserved server-side, so the client may finish 'on time' while the server also considers it not early. The UX is inconsistent. With mobile app kills (OOM) this becomes common, so persist runner state (MMKV) or have the server return remaining time.
- AttemptDto caps responseMs at 600000 (10 min). A rapid session (up to 60 min) with one puzzle taking >10 min of active time makes /attempt 400. The client swallows it, so the attempt is lost server-side while local counters include it.
- Server does not validate durationSec against the per-style min/max (DTO 60..3600 for all styles), so the client is the only guard.
- Mode switch theme→mixed does not clamp startRating to unlocked+200, which gives a server 400 shown as raw e.message.
- settings.fixedColor overrides `orientation`, but isPlayerTurn compares orientation to chess.turn(). When the fixed colour differs from the solver's side, TurnCard shows 'Opponent is moving' during the player's turn (the Chessboard still allows moving the side to move). Clarify fixedColor semantics.
- The wrong move is applied to the live Chess instance and stays on the board, and handleMove mutates the Chess object stored in React state in place, relying on new Chess(fen) copies. This is fragile and a mobile port should use immutable FEN-based state.
- Latency between puzzles = attempt RTT + 220/360ms + next RTT, all serial. On cellular networks this will feel sluggish. Consider a combined attempt+next endpoint or optimistic prefetch.
- Timer re-renders the whole runner (including the board) every 250ms. On RN this will drop frames during drags unless the timer is isolated.
- Hardcoded strings bypass i18n: ExitDialog (en/uk inline) and summary 'Home'. i18n lives in one 836-line lib/i18n.ts with en (lines 7–405) and uk (406–805) dicts. Approximate key counts across both languages: play.* 114, unlock.* 22, calibration.* 16, demote.* 8, rank.* 16, style.* 18, levels.* 10, review.session* 6 (halve for per-language counts).
- Sound timing is tightly coupled to visuals (setup 'move' click at t=0, winning click suppressed so 'correct' plays alone, long ceremony clips with fade-outs). An RN audio stack with poor latency (plain expo-av) will feel off; it needs preloaded, low-latency players.
- PEAK_BAND=50 is duplicated as a literal in the frontend in 4 places, and STYLE_FORMULAS/CALIBRATION_SESSIONS are duplicated between frontend and backend ('keep in sync' comments). A third copy in mobile multiplies drift, so create a shared package first.
- Discard does not roll back UserPuzzleHistory (seenCount/lastSeenAt) or a ReviewItem that was resolved before and un-resolved in this session. That is fine but should be documented if analytics/review on mobile depend on it.
- The ceremony shows only when the band changes. Rank-up from calibration is never celebrated (rankChange is null when calibration is active), which may or may not be intended on mobile.

## Open questions

- Is startPuzzleRating meant to be the 'last picked start' (as the setup's initialStartRating and create() now treat it) or the progression's entry floor (as evaluateDemote/evaluateCalibration clamp on)? This decides whether demotion and calibration step-downs currently work.
- Should mobile auto-pause on AppState background, and should time spent backgrounded without pause count? (Web has no such handling.)
- Should the server expose remaining time / pause state so a killed-and-restored app can resume a session accurately?
- Intended semantics of settings.fixedColor: show the board from a fixed side only, or something else? Current TurnCard logic misreports the turn when it mismatches.
- Chessboard component internals (drag/tap, promotion picker, piece-shake, ember-spark, feedbackSquare rendering, premove?) were not read in this area. They need their own inventory for the native board.
- PuzzleBufferService (Redis queue, preload strategy, de-duplication with UserPuzzleHistory) not read. What latency does /next have on a warm vs cold queue?
- lib/sound.ts was not read fully. Exact clip files, trimming, loudness levelling, sound packs (SoundPack), the LEVELLED set, and stopLongClip fade behaviour are needed to port the audio.
- Segmented, Button (variants glass/outline/btn-ember), Card and the glass/eos-* design tokens were not read. The design-token source is needed for the RN theme.
- Toast store (lib/toast) and achievement toast visuals were not read.
- Are there backend unit tests for unlock.ts/rating.ts/streak.ts that can move into a shared package's test suite?
- Should mobile keep the desktop two-column layout for tablets (lg breakpoint, 320px side panel), or is phone portrait the only target?
- Should the first-puzzle stash also cover the summary's 'Play again' (restart with the same settings in one tap) on mobile?
