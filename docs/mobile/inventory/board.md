# Inventory: board

_Chessboard rendering and interaction (Chessboard, Arrows, PromotionPicker, BoardThumbnail, LandingBoard, TurnCard, pieces/themes/theme-icons libs, board CSS animations, /public/design assets)_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Board grid rendering (squares, textures, coordinates, frame)  ·  complexity M

**Where:** components/board/Chessboard.tsx (Chessboard), globals.css .sq-marble / .sq-slate / .board-square, lib/themes.ts BOARD_THEMES.stone

**Behaviour**

8x8 CSS grid (grid-cols-8 grid-rows-8) inside a root div: relative, w-full, aspect-square, select-none, touch-none, overflow-hidden, rounded 6px, box-shadow '0 0 0 1px rgba(255,255,254,0.08), 0 24px 60px rgba(17,15,17,0.5)', contextmenu prevented. Square colour parity: isLight = (file+rank)%2===1 (a1 dark). Each square = backgroundColor fill (stone light #cdcfd5 / dark #505059) plus a full baked glass tile image stretched 100%x100% (.sq-marble -> /design/board/tile-light.jpg?v=1, .sq-slate -> /design/board/tile-dark.jpg?v=1; both 512x512 JPEG, ~24KB/~22KB, fade/temperature baked by scripts/bake-board.py). Every square shows the same tile (no per-square variation). Coordinates: rank numbers in the left visible file (top-0.5 left-1), file letters on the bottom visible rank (bottom-0.5 right-1), 10px bold, colour is the opposite square colour (light square -> #505059, dark -> #cdcfd5), zIndex 2; fixed 10px regardless of board size. The theme prop is accepted but ignored (`void _theme`): BOARD_THEMES.stone always wins. Layer z-order inside a square: check glow z0, highlight fill z0, drop-target ring z1, piece z2 (z50 while dragging), coords z2, legal indicator z3, hint pulse z4, feedback wash z4, sparks z5; board-level overlays: sliding piece z3, arrows SVG z20, promotion backdrop z30, picker z40.

**State & persistence:** Pure props. size from ResizeObserver (contentRect.width) into useState; sq = size/8. settings.boardTheme ('stone' default) persisted via user settings but has no visual effect.

**Web-only deps:** CSS grid + Tailwind classes; CSS background-image textures with ?v= cache-busting; ResizeObserver; box-shadow; onContextMenu

**Motion & sound:** None for static grid.

**Mobile mapping:** Recommended: a single @shopify/react-native-skia <Canvas> for the static layer (64 rects with Image tiles via useImage on bundled require() assets, coordinates via Skia Text with a bundled font, scaled to sq*0.2 rather than fixed 10px) — one draw tree, no 64 Views to layout. Alternative with plain Views: 64 absolutely-positioned <View>/<Image> (expo-image) memoised per square; acceptable but heavier to re-render. Size from onLayout of a parent sized with Math.min(width,height) (replaces cqw/cqh). Frame shadow: View shadow props (iOS) / elevation (Android) or Skia Shadow. Drop the ignored theme prop entirely or ship only 'stone'.

**Why M:** Straightforward drawing, but the Skia vs Views choice sets the architecture for every other layer; texture tiles and coordinate scaling need care.


## Piece rendering and per-set fit (Ember / Classic)  ·  complexity S

**Where:** lib/pieces.ts (pieceUrl, pieceTransform, normalizePieceSet, EMBER_FIT, CLASSIC_FIT, APP_PIECE_SETS), Chessboard <img> per square, BoardThumbnail, TurnCard, LandingBoard

**Behaviour**

Pieces are 256x256 RGBA PNGs. Sets: 'classic' (default, /design/pieces-classic/{wK..bP}.png, ~30-55KB each, 540KB total) and 'ember' (/design/pieces/*.png, ~24-47KB, 468KB total). normalizePieceSet maps anything not in ['classic','ember'] (e.g. legacy DB default 'maestro' or any Lichess set) to 'classic'. pieceUrl has a Lichess CDN fallback (https://lichess1.org/assets/piece/<set>/<pc>.svg) which is effectively dead because every caller normalises first. Each piece img is w-full h-full with transformOrigin '50% 94%' (scale grows upward from the base) and a per-type fit transform: EMBER_FIT p{1.10,y-3} n{1.05,-2} b{1.02,0} r{1.05,-2} q{1.05,-1} k{1.05,-1}; CLASSIC_FIT p{1.10,-1} n{1.05,-3,x-1} b{1.05,-1} r{1.10,-2} q{1.08,-1} k{1.04,-1}; y/x are % of the square; output 'translateY(y%) scale(s)' or 'translate(x%, y%) scale(s)'. themes.ts also exports legacy PIECE_SETS (11 Lichess names incl. 'ember') and PIECE_SET_LABELS — not used by the board.

**State & persistence:** settings.pieceSet (zustand useAppStore, default 'classic'; persisted by the settings layer, not in this area). BoardThumbnail and TurnCard read it from the store directly; Chessboard gets it as a prop.

**Web-only deps:** <img> with URL paths under /public; CSS transform strings with % units; transform-origin

**Motion & sound:** None.

**Mobile mapping:** Bundle all 24 PNGs via require() (static map keyed `${set}/${color}${TYPE}`), preload with expo-asset / Skia useImage at app start so the first board never flashes. Port EMBER_FIT/CLASSIC_FIT verbatim; replace pieceTransform's CSS string with a numeric helper returning {scale, dx, dy} (dx/dy = pct*sq/100) and compensate the 94% origin manually (origin is 0.44*sq below centre: translateY += (1-scale)*0.44*sq). For Skia draw with a matrix; for Views use transform [{translateX},{translateY},{scale}] with the origin compensation. Use Skia linear filtering + mipmaps (or pre-scaled 128/192px variants) for crisp downscaling.

**Why S:** Static assets and a small numeric table; only the transform-origin compensation needs care.


## Tap-to-move and selection with legal-move indicators  ·  complexity M

**Where:** Chessboard onSquareMouseDown / tryMove / legalForSquare

**Behaviour**

Interaction is on pointerdown (not pointerup/click). Left-button pointerdown on a square: (1) clears user highlights and arrows; (2) if a piece is selected and this square is in its legal set -> tryMove(selected, s) immediately; (3) else if the square has a piece of chess.turn() colour -> select it, compute legal targets via chess.moves({square, verbose:true}), and start a drag (see drag feature); (4) else deselect. Tapping the already-selected piece re-selects it (no toggle-off). Tapping another own piece switches selection. Releasing on the same square keeps the selection, so tap then tap on a target = tap-to-move. Selected square: fill rgba(47,95,158,0.45) + inset 3px ring rgb(47,95,158). Legal target empty square: centred dot 26% x 26% of square, rgba(144,143,142,0.32). Legal capture: ring inset 4% with inset box-shadow 6px rgba(144,143,142,0.32) (fixed 6px, not scaled). tryMove returns early if !allowMoves; a pawn reaching rank 8/1 opens the promotion picker; otherwise onMove({from,to}); if onMove returns anything but false, selection and dots clear. State is reset (selected, legal, highlights, arrows, arrowDrag, promotion) on every fen change. Edge case: when allowMoves=false (opponent moving, animation, paused, solved) the user can still select pieces of the side to move and see legal dots; only the move is blocked. Only the side to move can be selected. Cursor: grab / grabbing / not-allowed / default (desktop only). Parent onMove handlers call chess.move themselves.

**State & persistence:** Local useState: selected, legal (Set<Square>). chess = useMemo(new Chess(fen)). No persistence.

**Web-only deps:** PointerEvent (button, clientX/Y); getBoundingClientRect for pointToSquare; CSS cursor

**Motion & sound:** No animation on dots/selection (they pop). No sound in the board itself; parents call sfx(moveSoundEvent(move)) on move.

**Mobile mapping:** react-native-gesture-handler Gesture.Tap composed with the Pan used for drag; hit-testing on the UI thread (worklet port of pointToSquare with orientation flip). Keep selection/legal in Reanimated shared values so dots render in Skia without React re-renders; compute legal moves on JS with chess.js (precompute all moves for the side to move on fen change) and push to a shared value. Consider committing tap-moves on touch-up to avoid accidental moves. Haptics: selectionAsync on select, impactAsync(Light) on move commit. Decide whether to block selection when allowMoves=false.

**Why M:** Logic is small, but must be reimplemented in gesture-handler with UI-thread hit testing and coordinated with drag; parity edge cases (move on pointerdown, reselect, state reset on fen) must be preserved.


## Drag-and-drop moves  ·  complexity L

**Where:** Chessboard onSquareMouseDown / onPointerMove / onPointerUp, .board-square.dragging CSS

**Behaviour**

Every pointerdown on an own piece also starts a drag: dragFrom, dragStart (clientX/Y), dragPos; setPointerCapture on the event target. No movement threshold — a tap is a zero-length drag. On pointermove the same <img> in the source square is translated by (dragPos - dragStart) px (the piece keeps its offset relative to the finger; it does NOT centre under the finger), plus the fit transform and scale(1.06), zIndex 50, filter drop-shadow(0 10px 18px rgba(17,15,17,0.35)), willChange transform, transition none. dragOver = pointToSquare(); a legal hovered square (not the source) gets an inset 4px ring rgba(47,95,158,0.85), radius 2px. On pointerup/pointercancel: legal target != source -> tryMove; otherwise the piece snaps back instantly (no return animation) and selection stays. Pointer outside the board -> null -> no move. Board root overflow-hidden clips the dragged piece at the board edge. The dropped piece appears at the destination without animation (parent sets new fen). Each pointermove calls setState (dragPos, dragOver), re-rendering the whole 64-square tree — main-thread bound.

**State & persistence:** useState: dragFrom, dragStart, dragPos, dragOver.

**Web-only deps:** Pointer Events + setPointerCapture; CSS transform translate/scale on <img>; CSS filter drop-shadow; touch-action: none; will-change

**Motion & sound:** Lift: scale 1.06 + drop shadow, instant. Snap-back: instant. No sound on lift; move sound from parent on commit.

**Mobile mapping:** Gesture.Pan().minDistance(0..4) with onBegin/onUpdate/onEnd worklets; dragged piece x/y in useSharedValue rendered as a Skia Image with a derived transform or an Animated.View with useAnimatedStyle — zero JS re-renders during drag, 120Hz on ProMotion (Info.plist CADisableMinimumFrameDurationOnPhone=true) and high-refresh Android. Improvements: lift piece above the finger (offset ~-0.6 sq), animate lift (withSpring scale to ~1.12) and snap-back (withSpring/withTiming 150-180ms), render the dragged piece in an overlay so it can leave the board bounds. Drop ring from useDerivedValue. Haptics: selectionAsync when hovered legal square changes (runOnJS, throttled), impactAsync(Medium) on drop, soft/no haptic on illegal drop.

**Why L:** Rebuilt from scratch on the UI thread with Reanimated worklets and gesture composition (tap vs pan vs long-press arrows), plus overlay rendering; this is where perceived quality is won or lost.


## Promotion picker  ·  complexity S

**Where:** Chessboard PromotionPicker (internal component)

**Behaviour**

Triggered in tryMove when the moving piece is a pawn and the target ends with '8' or '1'. The pawn stays visually on its source square while open. Backdrop: absolute inset-0, rgba(17,15,17,0.35), z30; tap cancels (setPromotion(null), selection kept) but is ignored for the first 250ms after mount (setTimeout ready guard so the triggering tap does not cancel). Picker: column one square wide and four tall on the target file (left = col*sq), z40, background rgba(255,254,252,0.98), shadow-2xl, rounded-lg, ring-1 ring-black/15. If the target visual row <= 3 it extends downward with order q,n,r,b; else upward ending at the target with order b,r,n,q (queen always nearest the target). Each option is a <button> of height sq, touchAction manipulation, hover bg-black/10, active bg-black/20, piece image with 8% padding, colour = chess.turn(). Picks fire on pointerdown (stopPropagation + preventDefault) -> onMove({from,to,promotion}); selection clears if not false. Drag-drop onto a promotion square also opens it. No animation.

**State & persistence:** useState promotion: Move|null; picker-local ready flag.

**Web-only deps:** setTimeout 250ms guard; button :hover/:active; touch-action: manipulation

**Motion & sound:** None (appears instantly). Parent plays the move sound via moveSoundEvent.

**Mobile mapping:** Animated overlay inside the board (Reanimated FadeIn ~120ms backdrop, spring/ZoomIn column), same placement math; Pressable options with pressed state. The 250ms guard becomes unnecessary if opened on gesture end with its own Tap gesture for the backdrop. Haptics: selectionAsync on open, impactAsync(Medium) on pick. Optional: ghost pawn on target while open.

**Why S:** Small, self-contained overlay with simple layout math.


## Arrows and user highlights (right-click drawing) + knightArrow setting  ·  complexity M

**Where:** components/board/Arrows.tsx (Arrows, sqCenter, isKnightHop), Chessboard onRightDown / arrowDrag / highlights

**Behaviour**

Desktop-only drawing: right-button pointerdown starts arrowDrag{from}; pointermove updates `to` (only over a square); pointerup: to exists and differs -> toggle arrow (remove if identical exists, else add); released on the same square -> toggle a user highlight (fill rgba(166,66,65,0.6), ember). Pending arrow renders live. Any left pointerdown clears all highlights and arrows; fen change clears them too. NO touch equivalent today — phone users cannot draw arrows. Arrows SVG: absolute inset-0, pointer-events none, z20, width/height = size. Stroke rgba(89,123,167,0.78); shaft width sq*0.18, butt caps; arrowhead via one <marker id="ah"> path M0,0 L10,5 L0,10 z, markerUnits userSpaceOnUse, markerWidth headLen=sq*0.34, markerHeight headWid=sq*0.58, preserveAspectRatio none, refX 0, so the shaft is shortened by headLen and the tip lands on the destination centre. Knight hops (1,2 / 2,1) with settings.knightArrow==='bent' (default) draw an L: long leg first (horizontal if |dx|>|dy|), then the short leg, strokeLinejoin round, last segment shortened by headLen; 'straight' draws a straight line. Hint arrow {hintSquare -> hintTargetSquare} appended when both set. Marker id 'ah' is global in the DOM. Arrows reads knightArrow directly from useAppStore.

**State & persistence:** Chessboard useState: arrows[], arrowDrag, highlights Set. settings.knightArrow ('bent'|'straight', default 'bent') from zustand (persisted with user settings).

**Web-only deps:** SVG <marker> / markerEnd; PointerEvent.button === 2 (right mouse); onContextMenu preventDefault; zustand hook inside Arrows

**Motion & sound:** None; arrows appear/disappear instantly.

**Mobile mapping:** Skia Path for the shaft plus an explicit triangle path for the head (no markers in Skia); port geometry as a pure 'worklet' function returning shaft points and head polygon. Touch input: Gesture.LongPress(~300ms) then Pan to draw; long-press release on the same square toggles highlight. Haptics: impactAsync(Light) when long-press activates, selectionAsync as the arrow end snaps to new squares. Pass knightArrow as a prop. Optional appear animation 120ms.

**Why M:** Geometry is pure and portable, but the touch input model must be invented and composed with tap/drag gestures without conflicts.


## Last-move highlight and check indicator  ·  complexity S

**Where:** Chessboard (isLast, checkSquare)

**Behaviour**

lastMove {from,to}: both squares get fill rgba(47,95,158,0.35) behind the piece (HL constant '47, 95, 158' = #2f5f9e, while comment/token --eos-hl is #3a6296 — values differ; the constant is what renders). Overlap priority: user highlight (ember 0.6) > selected (0.45 + 3px inset ring) > last move (0.35). Check: if chess.inCheck(), the king of chess.turn() is located by scanning chess.board(); its square gets 'radial-gradient(circle, rgba(223,78,77,0.85) 10%, rgba(223,78,77,0.35) 55%, transparent 80%)' under the piece. Parents set lastMove after the setup move completes and after each move.

**State & persistence:** Props only; checkSquare memoised on chess.

**Web-only deps:** CSS radial-gradient

**Motion & sound:** None (instant).

**Mobile mapping:** Skia Rect fills and a RadialGradient shader for check (or a pre-rendered glow PNG with Views). Optional fade-in ~120ms. Haptic impactAsync(Heavy) when the player's move gives check (parent decides).

**Why S:** Simple fills; radial gradient is native in Skia.


## animateMove slide (setup move / solution stepping)  ·  complexity M

**Where:** Chessboard sliding <img> overlay, globals.css @keyframes slide-piece, lib/store.ts ANIMATION_MS

**Behaviour**

While animateMove {from,to} is non-null and size>0, the static piece on `from` is hidden and an absolutely positioned img (width/height sq, left col*sq, top row*sq via gridPos with orientation) runs `slide-piece ${animationMs}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`, translating by CSS vars --dx/--dy = (to-from)*sq px, z3. The fen during the slide is the PRE-move position; a captured piece on `to` stays visible under the slider. The parent swaps in the post-move fen after animationMs + 20ms and sets animateMove=null and lastMove (play loadPuzzle; review pages; puzzles/[puzzleId] also uses it to step through the solution). key = `${from}-${to}-${fen}` restarts the animation. If animationMs===0 parents skip it. Durations (settings.animationSpeed): instant 0, fast 160, normal 280 (default), slow 460. allowMoves is false while animating. The slider does NOT apply pieceTransform (fit scale/offset) so it can pop on swap (comment mentions 5% padding, none applied). Opponent replies in the play runner are NOT animated: applied after setTimeout(max(animMs, 80)) and the piece teleports. Player moves are never animated.

**State & persistence:** Prop-driven; parent holds animateMove useState and timers. settings.animationSpeed persisted with user settings.

**Web-only deps:** CSS @keyframes with custom properties; setTimeout coordination in parents (animMs+20)

**Motion & sound:** Slide 160/280/460ms cubic-bezier(0.4,0,0.2,1). Parent plays sfx('move') when the setup slide starts and sfx(moveSoundEvent(move)) on opponent reply.

**Mobile mapping:** Replace the timer-coupled prop with an imperative/promise board API (ref.animateMove(from,to,{ms}) or a move queue) driven by withTiming(..., {duration, easing: Easing.bezier(0.4,0,0.2,1)}) and runOnJS(onDone), removing the +20ms race. Animate all moves (opponent replies, tap-to-move 120-160ms, drop-settle spring), captures (fade/scale out) and castling rook; apply fit transform to the moving piece. Haptic on opponent move landing optional; heavier on capture.

**Why M:** The animation is trivial in Reanimated, but redesigning the API to be callback-driven and animating currently-unanimated moves touches every runner screen.


## Hint squares and hint arrow  ·  complexity S

**Where:** Chessboard hintSquare / hintTargetSquare, globals.css .hint-pulse / @keyframes hint-pulse, review/[puzzleId] handleHint + hintLevel

**Behaviour**

Used by review/[puzzleId], puzzles/[puzzleId] and sessions/[id]/review (not the play runner). Parent hintLevel 0/1/2: >=1 -> hintSquare = expected move from; >=2 -> hintTargetSquare = expected move to. When hintSquare is set the board auto-selects it (selected + legal dots) via effect. Both hint squares get an overlay z4, radius 2px, .hint-pulse: infinite 1.2s ease-out — inset 4px ring rgba(236,162,38,0.95) constant, outer glow 0 -> 14px at 60% fading rgba(236,162,38,0.55 -> 0). Glow paints over neighbours, clipped at the board edge. Both set -> arrow from->to (blue). Not covered by prefers-reduced-motion.

**State & persistence:** Props from parent page state (hintLevel). No persistence.

**Web-only deps:** CSS infinite keyframe animation on box-shadow

**Motion & sound:** 1.2s infinite amber pulse, ease-out.

**Mobile mapping:** withRepeat(withTiming(1,{duration:1200, easing: Easing.out(Easing.ease)}), -1) driving a Skia stroke rect + blurred outer rect (MaskFilter blur), or Animated.View border + shadow. Respect useReducedMotion. Haptic selectionAsync on each hint level.

**Why S:** Single looping animation on two squares.


## Per-attempt feedback: square flash, ember sparks, piece shake  ·  complexity M

**Where:** Chessboard feedbackSquare overlay, Chessboard SPARKS constant, globals.css .square-feedback, .ember-spark, .piece-shake and keyframes, play/[id] afterAttempt

**Behaviour**

feedbackSquare {square, correct, id} set by the parent after an attempt (play: {square: m.to, correct, id: Date.now()}, cleared after 500ms; next puzzle loads after 220ms correct / 360ms wrong, i.e. before the flash ends). Overlay keyed by id to restart on repeat. Flash (z4, above piece): .square-feedback 500ms ease-out forwards, opacity 0 -> 1 at 15% (75ms), hold to 70% (350ms), -> 0; correct rgba(94,218,137,0.7), fail rgba(223,78,77,0.7). Correct only: 14 ember sparks (z5) from square centre: angle i/14*2pi (+0.2 rad odd i), distance 34+((i*7)%22) px (34-55px fixed), dy -10px upward bias, size 3-5px, colours cycle #f9b786/#d35e4a/#fddcb1, glow box-shadow 0 0 6px rgba(242,127,75,0.9), duration 520/580/640/700ms (inline override of 560ms default), easing cubic-bezier(.15,.7,.3,1), translate to (dx,dy) with scale 1 -> 0.3 and opacity 1 -> 0; clipped at board edge. Wrong only: destination piece shakes .piece-shake 340ms ease via the CSS `translate` property (stacks with fit transform): 0 / -6% / +6% / -4% / +3% / 0 at 0/20/40/60/80/100%; img keyed `shake-${id}`. prefers-reduced-motion disables sparks and shake (not the flash or hint pulse).

**API**

- `POST /sessions/:id/attempt (called by the parent in afterAttempt, not by the board)`

**State & persistence:** Prop from parent; parent 500ms clear timer.

**Web-only deps:** CSS keyframes, custom properties --dx/--dy; CSS `translate` individual transform property; React key-reset to restart animations; prefers-reduced-motion media query

**Motion & sound:** Flash 500ms; sparks 520-700ms; shake 340ms. Parent plays sfx('correct') / sfx('mistake') at the same moment.

**Mobile mapping:** Skia: 14 Circles with blur paint driven by one shared progress value (withTiming 700ms) in a full-screen overlay Canvas so sparks can overflow the board; scale distances by sq/50. Flash: Rect with withSequence opacity (75ms in, hold, 150ms out). Shake: withSequence translateX (-6%,+6%,-4%,+3%,0 of sq over 340ms). Expose as board.flash(square, correct) imperative call. Haptics: correct -> notificationAsync(Success) synced with flash; wrong -> notificationAsync(Error) or two-beat pattern matching the shake. Respect reduce-motion.

**Why M:** Three coordinated effects with precise timings; easy in Skia/Reanimated but need an imperative trigger API and tuning with haptics/sound.


## Orientation and mirror view  ·  complexity S

**Where:** Chessboard rows/cols, gridPos, pointToSquare, Arrows sqCenter, PromotionPicker, parent pages (settings.mirrorView, settings.fixedColor)

**Behaviour**

orientation 'white' renders rank 8 at top / file a at left; 'black' reverses both. Parents compute orientation from the puzzle (player colour after setup) or settings.fixedColor ('auto'|'white'|'black'), then settings.mirrorView flips it again (pure visual flip so the player sees threats from the opponent side; TurnCard keeps the natural orientation). All coordinate math (grid, hit test, arrows, slide, promotion column, coordinate labels) uses the same flip.

**State & persistence:** Prop. settings.mirrorView and settings.fixedColor persisted with user settings (store.ts).

**Motion & sound:** None; orientation changes are instant.

**Mobile mapping:** Single pure squareToXY / xyToSquare helper marked 'worklet' so it runs on both JS and UI threads; share in a packages/chess-ui-core module. Optional animated flip (pieces animate to mirrored positions ~300ms) between puzzles.

**Why S:** Pure math already isolated in small functions.


## Board sizing / responsive layout  ·  complexity S

**Where:** Chessboard ResizeObserver, play/[id] board column (containerType: size, width min(100cqw,100cqh)), review/[puzzleId], puzzles/[puzzleId], sessions/[id]/review same pattern, globals.css .board-top-slot { min-height: 218px }

**Behaviour**

The board fills its parent width (aspect-square) and measures itself with ResizeObserver; sq = width/8 drives all px math. Runner pages use a flex-1 column with container-type: size and an inner aspect-square div of width min(100cqw, 100cqh) = largest square that fits. On phones a fixed .board-top-slot (min-height 218px: exit/timer/pause row, TurnCard, progress bar) sits above so the board lands at the same y on every board screen; stats row below; max-w min(calc(100vh-240px), 880px); page padding max(12px, env(safe-area-inset-*)). Desktop lg+: board left, 320px side panel. Before settingsReady the board is not rendered (prevents piece-set flash) and a spinner shows. Phone landscape blocked by .rotate-lock (max-height 500px).

**State & persistence:** size in useState; settingsReady flag in zustand.

**Web-only deps:** CSS container queries (cqw/cqh, container-type: size); ResizeObserver; 100dvh / env(safe-area-inset-*); media queries (lg breakpoint, landscape lock)

**Motion & sound:** None.

**Mobile mapping:** react-native-safe-area-context + onLayout on the board slot: boardSize = floor(min(w,h)/8)*8 rounded to device pixels (avoids tile seams). Lock portrait in app.json (tablets optional). Keep the fixed-height top slot for consistent board y. Gate first board render on piece assets loaded + settings hydrated (expo-splash-screen).

**Why S:** Native layout is simpler than the cq/dvh tricks; just onLayout math.


## BoardThumbnail (static mini board)  ·  complexity S

**Where:** components/board/BoardThumbnail.tsx

**Behaviour**

Static preview of a FEN, optionally after applying a UCI setupMove (errors swallowed); autoOrient (default true) shows black's side if black is to move after setup. Default size 120px, 8x8 grid, radius 6, boxShadow 0 0 0 1px rgba(255,255,254,0.06), marble/slate tiles over stone colours, pieces with fit transform. Per-square backgroundPosition is a no-op (background-size 100% 100%). Piece set from prop or store settings.pieceSet. No coordinates, no interactivity. Currently has NO importers in apps/frontend/src (unused).

**State & persistence:** Reads settings.pieceSet from zustand.

**Web-only deps:** CSS grid, background-image tiles, <img>

**Motion & sound:** None.

**Mobile mapping:** If needed for lists, reuse the board renderer in static mode; in long FlashLists cache rendered thumbnails (Skia makeImageSnapshot) to keep scrolling at 120fps. Otherwise skip.

**Why S:** Static drawing reusing main board code.


## LandingBoard (hero decorative board)  ·  complexity S

**Where:** components/landing/LandingBoard.tsx, components/landing/Hero.tsx

**Behaviour**

Static hero board for the marketing landing: FEN 'r2q3k/ppp3pp/8/4N3/8/8/PPP2PPP/R2Q2K1' parsed by a local parse(); Ember pieces always; e5 tinted rgba(81,123,181,0.38), f7 rgba(81,123,181,0.22); coordinates 9px (11px md) extra-bold, #505059 on light / #cdcfd5 on dark; bent knight-fork arrow e5->f7 in an 8x8 viewBox SVG path 'M4.5 3.2 L4.5 1.5 L5.18 1.5', stroke rgba(82,132,199,0.85), width 0.19, marker lb-ah. backgroundPosition tweaks are no-ops.

**State & persistence:** None.

**Web-only deps:** SVG marker; CSS grid/background images

**Motion & sound:** None in the component.

**Mobile mapping:** Web marketing only; on mobile could become an onboarding illustration using the static board renderer with a preset FEN + arrow.

**Why S:** Decorative, optional.


## TurnCard (whose-turn pill above the board)  ·  complexity S

**Where:** components/board/TurnCard.tsx (used by play/[id], review/[puzzleId], puzzles/[puzzleId], sessions/[id]/review)

**Behaviour**

Glass card (rounded-2xl, px-4 py-3) with a 44px round disc using the marble (white) or slate (black) tile texture and inset shadows, holding a 36px king of the orientation colour from the user's set. Title/subtitle: override (puzzle viewer solution/solved) > loading -> t('play.loading_puzzle') > opponentBusy or !isPlayerTurn -> t('play.opponent_moving') > t('play.your_turn') + subtitle t('play.find_best_white'|'play.find_best_black'). 5 i18n keys. Streak chip when streak>=2 (bg rgba(166,66,65,0.16), text #d8847c, emoji fire + N) or broken streak (line-through, text-eos-rose), keyed to remount, transition-opacity 500ms. Title serif 15px bold tracking 0.03em; subtitle 12px zinc-400; truncate.

**State & persistence:** Reads settings.pieceSet from zustand; useT() i18n.

**Web-only deps:** CSS background-image texture classes; Tailwind classes; emoji text

**Motion & sound:** Streak chip opacity transition 500ms; parent clears streakBroken after 700ms.

**Mobile mapping:** Plain RN View + expo-image; Reanimated entering animations for the chip and a broken-streak shake/fade with Haptics.notificationAsync(Warning) (parent). Serif font via expo-font.

**Why S:** Simple presentational component.


## Puzzle theme icons  ·  complexity S

**Where:** lib/theme-icons.ts (themeIcon, maskIcon, LICHESS_THEMES), used by review/page.tsx, analytics/page.tsx, components/ThemePicker.tsx, landing Features/Hero/Motifs

**Behaviour**

themeIcon(slug) returns a component rendering /design/themes/<slug>.svg as a CSS mask filled with currentColor, size*1.2 px square (default 16 -> 19px). 43 known slugs; 'mate' or 'mateIn*' -> mate.svg; unknown -> lucide Puzzle icon. Per-file component cache. 43 SVGs (8-12KB each, 492KB total), each one path with fill="#7f7f7f", viewBox 0 0 512 512, plus a large embedded c2pa <metadata> manifest that dominates file size. Licence CC BY 3.0 (game-icons.net via Lichess), attribution in CREDITS.md.

**State & persistence:** Module-level Map cache.

**Web-only deps:** CSS mask / -webkit-mask with url(); lucide-react; createElement span

**Motion & sound:** None.

**Mobile mapping:** Strip c2pa metadata, convert via react-native-svg-transformer/SVGR to components with a fill/color prop (or an icon font); lucide-react-native fallback. Keep the 1.2x optical scale. Show CC BY attribution in a licenses screen.

**Why S:** Mechanical asset conversion.


## Shared-logic candidates

- `apps/frontend/src/lib/pieces.ts` — PieceType, APP_PIECE_SETS, AppPieceSet, normalizePieceSet, EMBER_FIT, CLASSIC_FIT (verbatim); pieceUrl and pieceTransform need native variants (require() asset map; numeric {scale,dx,dy} instead of CSS string) — blockers: pieceUrl returns web paths and a Lichess CDN URL; pieceTransform returns a CSS transform string with % units. Split into pure data + platform resolvers.
- `apps/frontend/src/lib/themes.ts` — BOARD_THEMES (only 'stone' used), ThemeColors, BoardTheme; PIECE_SETS/PIECE_SET_LABELS are legacy — blockers: None (pure data). Recommend trimming to stone only.
- `apps/frontend/src/components/board/Arrows.tsx (geometry only)` — sqCenter(square,size,orientation), isKnightHop(from,to), bent-L midpoint rule (long leg first), head shortening by headLen, constants width=sq*0.18, headLen=sq*0.34, headWid=sq*0.58, stroke rgba(89,123,167,0.78) — blockers: Embedded in a React/SVG component reading zustand; extract into a pure arrowGeometry() returning shaft points + head triangle, mark 'worklet'.
- `apps/frontend/src/components/board/Chessboard.tsx (pure helpers)` — FILES, sqName(file,rank), gridPos(sq,orientation), pointToSquare math (minus getBoundingClientRect), checkSquare finder, legalForSquare (chess.js), promotion detection rule, PromotionPicker placement math (downward if row<=3; order q,n,r,b / b,r,n,q), SPARKS generator, colour constants (HL '47,95,158', legal rgba(144,143,142,0.32), feedback green/red, user highlight rgba(166,66,65,0.6), check gradient) — blockers: Inline in the component; must be extracted. Otherwise pure (chess.js is platform-agnostic).
- `apps/frontend/src/lib/store.ts (subset)` — ANIMATION_MS {instant:0, fast:160, normal:280, slow:460}, AnimationSpeed, KnightArrowMode, ColorMode, UserSettings type, DEFAULT_SETTINGS — blockers: File also creates the zustand store and imports ./sound and ./levels; move types/constants to a shared package and recreate the store per platform (zustand works in RN).
- `chess.js dependency (^1.0.0-beta.8)` — Move generation/validation used by the board — blockers: Pure JS, runs on Hermes; not worklet-safe — compute legal moves on JS and pass to shared values.

## Haptics opportunities

- Piece pick-up (tap-select or drag start): Haptics.selectionAsync()
- Drag hover crosses into a new legal target square: selectionAsync (throttled, runOnJS from the pan worklet)
- Move commit (drop or tap-to-move): impactAsync(Light); capture: impactAsync(Medium); castling/promotion: Medium
- Illegal drop / snap-back: very soft impact or none
- Promotion picker open: selectionAsync; piece picked: impactAsync(Medium)
- Correct answer (green flash + ember sparks): notificationAsync(Success) synced with flash start and sfx('correct')
- Wrong answer (red flash + 340ms piece shake): notificationAsync(Error) or custom two-beat pattern matching the shake (Android Vibration pattern ~[0,30,40,30])
- Opponent reply landing: optional faint impactAsync(Soft)
- Move gives check: impactAsync(Heavy)
- Hint reveal level 1 / level 2: selectionAsync
- Long-press to start drawing an arrow (new touch gesture): impactAsync(Light); arrow end snapping to a new square: selectionAsync
- Streak broken chip in TurnCard: notificationAsync(Warning)
- All haptics behind a new settings toggle (analogous to soundEnabled)

## Push opportunities

- None originate in the board component; it is presentation/interaction only.
- Board-adjacent: a 'puzzle of the day' push deep-linking into a board screen (puzzles/[puzzleId]) needs a deep-link route that mounts the board with a FEN.
- Streak reminder pushes (streak shown on TurnCard) belong to the streak/session area.

## Risks

- Web drag updates React state on every pointermove and re-renders all 64 squares; a naive RN port with useState would drop frames. Drag, hover ring, sparks and slides must live on the UI thread (Reanimated shared values / Skia) for 60/120fps.
- Gesture composition: tap-to-move fires on pointerdown and every pointerdown starts a zero-threshold drag; adding long-press arrows on touch creates Tap/Pan/LongPress conflicts that must be designed explicitly (Exclusive/Race in gesture-handler).
- Timer-coupled API: parents swap fen after animationMs + 20ms and clear feedback after 500ms via setTimeout; on mobile (busy JS thread, backgrounding) this races. Use completion callbacks (runOnJS) / promises.
- Behaviour gaps owner may expect to 'just work': opponent replies and player moves are not animated on web, arrows cannot be drawn on touch, pieces can be selected while allowMoves=false. Decide parity vs improvement up front.
- Sliding piece ignores pieceTransform (fit scale/offset) so it pops on swap; stale comment about 5% padding. Do not copy.
- Colour inconsistency: Chessboard HL rgb(47,95,158) vs --eos-hl #3a6296 vs arrow rgba(89,123,167,0.78) vs landing rgba(81/82,123/132,...); baked-fade pipeline (scripts/bake-fade.py, bake-board.py) shifted colours. Mobile needs one authoritative token set.
- Fixed px values that do not scale with board size: coordinates 10px, capture ring 6px, drop ring 4px, hint ring 4px, spark distances 34-55px and sizes 3-5px. Scale by sq on mobile.
- Board root overflow:hidden clips the dragged piece, sparks and hint glow; on mobile the finger hides the piece, so render the dragged piece offset above the finger in an overlay outside the board.
- Asset weight: 24 piece PNGs at 256px (~1MB both sets) and 43 theme SVGs bloated by c2pa metadata (~492KB). Preload pieces before first board paint (web holds render until settingsReady) and strip SVG metadata.
- Tile seams/hairlines at fractional square sizes on Android; round board size to multiples of 8 device pixels (PixelRatio.roundToNearestPixel).
- chess.js is not worklet-safe; legal moves must be computed on JS and pushed to the UI thread — precompute all legal moves on fen change to avoid first-tap latency.
- react-native-skia increases binary size and requires a dev build; Skia text needs bundled font files.
- CC BY 3.0 attribution for theme icons must be preserved (licenses screen).

## Open questions

- Should mobile animate every move (player tap-to-move, drop settle, opponent replies, captures) or keep web parity where only the setup move / solution stepping slides?
- Should arrows/highlights be drawable on touch (long-press + drag), and should they persist across the opponent reply (web clears them on every fen change)?
- Should piece selection be blocked when allowMoves=false (web allows selecting and showing legal dots during opponent turn/animation)?
- Drop the Lichess piece-set fallback and the 10 unused BOARD_THEMES permanently on mobile?
- BoardThumbnail has no importers — planned for a mobile list screen, or delete?
- Which highlight blue is authoritative: rgb(47,95,158) (rendered), #3a6296 (--eos-hl), or arrow rgba(89,123,167,0.78)? Are pre-bake source tiles and inputs for scripts/bake-board.py / bake-fade.py available to regenerate higher-res assets for 3x displays?
- Is tablet landscape required (web blocks phone landscape via .rotate-lock but allows tablets)?
- Should haptics have their own user setting (none exists; only soundEnabled/soundPack)?
- Sound engine details (sfx catalog, moveSoundEvent, Web Audio trimming) are outside this area — needed to sync haptics with sound timing.
- Not fully read: parent runner pages (puzzles/[puzzleId] solution stepping, sessions review flow) that sequence animateMove/hint/feedback beyond the inspected snippets.
