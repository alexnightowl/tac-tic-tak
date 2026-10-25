// Board v1 (PLAN §2.6): Views + Reanimated + RNGH 3 hooks + expo-image +
// react-native-svg. React renders on position / geometry changes only;
// selection, drag, hover and feedback live in SharedValues and worklets.
import {
  boardSize, legalTable, maskHas, squareCenter, squareIndex, squareName, xyToSquare,
  type AppPieceSet, type KnightArrowMode, type Orientation, type PromotionPiece, type Square,
} from '@tac/core/board';
import { moveSoundEvent, type FeelEvent } from '@tac/core/feel';
import { SPARK_TOTAL_MS } from '@tac/core/board';
import { ANIMATION_MS, keyframeStops, keyframes, radii, shadows, timing } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { memo, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { PixelRatio, StyleSheet, View, type HostInstance, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture, useTapGesture, useExclusiveGestures } from 'react-native-gesture-handler';
import {
  cancelAnimation, Easing, useReducedMotion, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { feel } from '@/feel';
import { useRenderCount } from '@/dev/renderCount';
import { DEFAULT_LABELS, squareLabel, type BoardLabels } from './a11y';
import { BOARD_IMAGE } from './assets';
import type { Move } from './chess';
import {
  DRAG_LIFT_SQ, DRAG_SCALE, DRAG_THRESHOLD, DROP_SETTLE_MS, HOVER_THROTTLE_MS, LIFT_SPRING,
  SECONDARY_MOVE_MS, SNAP_BACK_SPRING, TAP_MOVE_MS,
} from './constants';
import { Arrows, CheckGlow, Coordinates, DragOverlay, Feedback, Highlights, Sparks, SquareCell, type ArrowSpec } from './Layers';
import { Piece } from './Piece';
import { applyMove, codeIndices, diffPieces, fenInfo, freshPieces, START_FEN, type BoardPiece, type FenInfo, type Placement } from './position';
import { PromotionPicker } from './PromotionPicker';
import { useBoardShared } from './shared';

export type LastMove = { from: Square; to: Square };

export type BoardMove = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
  san: string;
  flags: string;
  captured?: string;
  /** Position after the move. */
  fen: string;
  /** Position before the move. */
  before: string;
};

export type BoardHandle = {
  /** Jump (ms = 0) or slide every changed piece to `fen`. Resolves when the slide ends. */
  setPosition(fen: string, lastMove?: LastMove | null, ms?: number): Promise<void>;
  /** Plays a legal move from the current position as a slide (opponent replies, solution stepping). */
  animateMove(from: Square, to: Square, ms?: number, promotion?: PromotionPiece): Promise<void>;
  flash(sq: Square, ok: boolean): Promise<void>;
  shake(sq: Square): Promise<void>;
  sparks(sq: Square): Promise<void>;
  /** 0 clears; 1 rings + selects `from`; 2 also rings `to` and draws the arrow. */
  setHint(level: 0 | 1 | 2, from?: Square | null, to?: Square | null): void;
  /** Solution / annotation arrows (cleared on every position change). */
  setArrows(arrows: ArrowSpec[]): void;
  setInteractive(on: boolean): void;
  /** New position without slides, fresh piece ids, optional new orientation. */
  reset(fen: string, orientation?: Orientation): void;
  getFen(): string;
};

export type BoardProps = {
  initialFen?: string;
  orientation?: Orientation;
  mirror?: boolean;
  pieceSet?: AppPieceSet;
  knightArrow?: KnightArrowMode;
  coordinates?: boolean;
  labels?: BoardLabels;
  /** The user's move, after chess.js validation and the board's own commit. Return false to take it back. */
  onMove?: (move: BoardMove) => boolean | void;
  /** Every position change (user move, animateMove, setPosition, reset). */
  onPositionChange?: (fen: string, lastMove: LastMove | null) => void;
  /** Dev: the board's React render count after each commit. */
  onRenderCount?: (n: number) => void;
  /** The board square's frame in window coordinates (Maestro drags, overlays). */
  onBoardFrame?: (frame: { x: number; y: number; size: number }) => void;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<BoardHandle>;
};

type PieceView = BoardPiece & { ms: number; z: number; dying: boolean };

type ViewState = {
  version: number;
  fen: string;
  placement: Placement;
  pieces: PieceView[];
  checkSquare: Square | null;
};

let nextPieceId = 1;
const newId = () => nextPieceId++;

/** Worklet → JS hop target; feel.emit itself lives on the RN runtime. */
function emitFeel(event: FeelEvent) {
  feel.emit(event);
}

/** moveSoundEvent names the board sound; the feel event mirrors it ('move' → 'drop'). */
function moveFeelEvent(move: Move): FeelEvent {
  const e = moveSoundEvent(move);
  return e === 'promote' || e === 'castle' || e === 'check' || e === 'capture' ? e : 'drop';
}

const ease = (b: readonly [number, number, number, number]) => Easing.bezier(b[0], b[1], b[2], b[3]);

function BoardImpl({
  initialFen = START_FEN,
  orientation: orientationProp = 'white',
  mirror: mirrorProp = false,
  pieceSet = 'classic',
  knightArrow = 'bent',
  coordinates = true,
  labels = DEFAULT_LABELS,
  onMove,
  onPositionChange,
  onRenderCount,
  onBoardFrame,
  style,
  ref,
}: BoardProps) {
  const renders = useRenderCount('Board');
  // The initial position seeds the SVs, so the first touch already has legal moves.
  const [initial] = useState(() => fenInfo(initialFen));
  const sv = useBoardShared(codeIndices(initial.placement), legalTable(initial.moves), initial.turn === 'w' ? 0 : 1);
  const reduced = useReducedMotion();

  const [size, setSize] = useState(0);
  const [geo, setGeo] = useState({ orientation: orientationProp, mirror: mirrorProp });
  const [view, setView] = useState<ViewState>(() => {
    const info = initial;
    return {
      version: 0,
      fen: info.fen,
      placement: info.placement,
      pieces: freshPieces(info.placement, newId).map((p) => ({ ...p, ms: 0, z: 1, dying: false })),
      checkSquare: info.checkSquare,
    };
  });
  const [arrows, setArrowsState] = useState<ArrowSpec[]>([]);
  const [hintArrow, setHintArrow] = useState<ArrowSpec | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square; color: 'w' | 'b' } | null>(null);

  // JS-side mirrors read by imperative calls (never during render).
  const fenRef = useRef(view.fen);
  const piecesRef = useRef<BoardPiece[]>(view.pieces);
  const pendingRef = useRef<{ ms: number; resolve: () => void }[]>([]);
  const dragCommitRef = useRef(false);
  const lockCount = useRef(0);
  const innerRef = useRef<HostInstance>(null);

  // Props → internal geometry (reset() can also change it): adjust during
  // render when the props change, no effect round-trip.
  const [geoProps, setGeoProps] = useState({ orientation: orientationProp, mirror: mirrorProp });
  if (geoProps.orientation !== orientationProp || geoProps.mirror !== mirrorProp) {
    setGeoProps({ orientation: orientationProp, mirror: mirrorProp });
    setGeo({ orientation: orientationProp, mirror: mirrorProp });
  }

  useLayoutEffect(() => {
    sv.size.set(size);
    sv.orientation.set(geo.orientation);
    sv.mirror.set(geo.mirror);
  }, [size, geo, sv]);

  /** Legal moves for the side to move, precomputed so first touch reads SVs only. */
  const pushShared = (info: FenInfo, last: LastMove | null) => {
    sv.codes.set(codeIndices(info.placement));
    sv.legal.set(legalTable(info.moves));
    sv.turn.set(info.turn === 'w' ? 0 : 1);
    sv.selected.set(-1);
    sv.selLo.set(0);
    sv.selHi.set(0);
    sv.hover.set(-1);
    sv.lastFrom.set(last ? squareIndex(last.from) : -1);
    sv.lastTo.set(last ? squareIndex(last.to) : -1);
  };

  const clearHint = () => {
    cancelAnimation(sv.hintPulse);
    sv.hintPulse.set(0);
    sv.hintFrom.set(-1);
    sv.hintTo.set(-1);
    setHintArrow(null);
  };

  /** The one place a position becomes current. Returns when its slides end. */
  const applyPosition = (
    fen: string,
    last: LastMove | null,
    opts: { ms: number; fresh?: boolean; dragFrom?: Square },
  ): Promise<void> => {
    const info = fenInfo(fen);
    let ms = opts.ms > 0 && reduced ? timing.reducedMotionSlide : opts.ms;
    let pieces: PieceView[];
    if (opts.fresh) {
      pieces = freshPieces(info.placement, newId).map((p) => ({ ...p, ms: 0, z: 1, dying: false }));
      ms = 0;
    } else {
      const d = diffPieces(piecesRef.current, info.placement, last, newId);
      const secondary = reduced ? timing.reducedMotionSlide : SECONDARY_MOVE_MS;
      pieces = d.pieces.map((p) => {
        if (!d.moved.has(p.id)) return { ...p, ms: 0, z: 1, dying: false };
        // A dropped piece is already under the finger: it lands, it doesn't slide.
        const prev = piecesRef.current.find((q) => q.id === p.id);
        const pms = opts.dragFrom ? (prev?.sq === opts.dragFrom ? 0 : secondary) : ms;
        return { ...p, ms: pms, z: 3, dying: false };
      });
      const fadeMs = opts.dragFrom ? 0 : ms;
      for (const c of d.captured) pieces.push({ ...c, ms: fadeMs, z: 0, dying: true });
      if (opts.dragFrom) ms = Math.max(0, ...pieces.filter((p) => !p.dying).map((p) => p.ms));
    }
    const changed = info.fen !== fenRef.current;
    fenRef.current = info.fen;
    piecesRef.current = pieces.filter((p) => !p.dying).map(({ id, code, sq }) => ({ id, code, sq }));
    pushShared(info, last);
    if (changed || opts.fresh) {
      clearHint();
      setArrowsState([]);
    }
    setPromo(null);
    setView((v) => ({ version: v.version + 1, fen: info.fen, placement: info.placement, pieces, checkSquare: info.checkSquare }));
    onPositionChange?.(info.fen, last);
    return new Promise((resolve) => {
      pendingRef.current.push({ ms, resolve });
    });
  };

  // After each committed position: drop the drag overlay (the real piece now
  // stands on the target) and start the promise clock in the same frame as
  // the pieces' slides.
  useLayoutEffect(() => {
    if (dragCommitRef.current) {
      dragCommitRef.current = false;
      sv.dragSq.set(-1);
      sv.dragVisible.set(0);
      sv.dragCode.set(-1);
    }
    const list = pendingRef.current;
    if (list.length === 0) return;
    pendingRef.current = [];
    const ms = Math.max(...list.map((p) => p.ms));
    const done = () => {
      for (const p of list) p.resolve();
    };
    if (ms <= 0) {
      done();
      return;
    }
    sv.clock.set(0);
    // Resolves on interruption too: the caller only waits for "settled".
    sv.clock.set(withTiming(1, { duration: ms, easing: Easing.linear }, () => {
      'worklet';
      scheduleOnRN(done);
    }));
  }, [view.version, sv]);

  const endDragNow = () => {
    sv.dragging.set(false);
    sv.dragSq.set(-1);
    sv.dragVisible.set(0);
    sv.dragCode.set(-1);
    sv.hover.set(-1);
  };

  /** User move (tap / drop / promotion pick): validate on JS, commit, feel, report. */
  const commitUserMove = (from: Square, to: Square, viaDrag: boolean, promotion?: PromotionPiece) => {
    const before = fenRef.current;
    const r = applyMove(before, from, to, promotion);
    if (!r) {
      if (viaDrag) endDragNow();
      feel.emit('illegal');
      return;
    }
    dragCommitRef.current = viaDrag;
    applyPosition(r.fen, { from, to }, { ms: viaDrag ? 0 : TAP_MOVE_MS, dragFrom: viaDrag ? from : undefined });
    feel.emit(moveFeelEvent(r.move), { move: r.move });
    const accepted = onMove?.({
      from, to, promotion, san: r.move.san, flags: r.move.flags, captured: r.move.captured, fen: r.fen, before,
    });
    if (accepted === false) applyPosition(before, null, { ms: TAP_MOVE_MS });
  };

  const commitFromUI = (fromIdx: number, toIdx: number, viaDrag: boolean) => {
    commitUserMove(squareName(fromIdx), squareName(toIdx), viaDrag);
  };

  const requestPromotion = (fromIdx: number, toIdx: number) => {
    const info = fenInfo(fenRef.current);
    setPromo({ from: squareName(fromIdx), to: squareName(toIdx), color: info.turn });
  };

  // ─── UI-thread helpers ────────────────────────────────────────────────

  /** Input gate: setInteractive(false) or an animateMove in flight. */
  const canTouch = () => {
    'worklet';
    return sv.interactive.get() && !sv.locked.get();
  };
  const hit = (x: number, y: number) => {
    'worklet';
    const s = xyToSquare(x, y, sv.size.get(), sv.orientation.get(), sv.mirror.get());
    return s ? squareIndex(s) : -1;
  };
  const isOwn = (idx: number) => {
    'worklet';
    const c = sv.codes.get()[idx];
    return c >= 0 && (c < 6 ? 0 : 1) === sv.turn.get();
  };
  const isTarget = (idx: number) => {
    'worklet';
    return idx >= 0 && maskHas(sv.selLo.get(), sv.selHi.get(), idx);
  };
  const select = (idx: number) => {
    'worklet';
    sv.selected.set(idx);
    if (idx < 0) {
      sv.selLo.set(0);
      sv.selHi.set(0);
      return;
    }
    const t = sv.legal.get();
    sv.selLo.set(t[idx * 2] | 0);
    sv.selHi.set(t[idx * 2 + 1] | 0);
  };
  const isPromotion = (from: number, to: number) => {
    'worklet';
    const c = sv.codes.get()[from];
    const rank = to >> 3;
    return (c === 0 || c === 6) && (rank === 7 || rank === 0);
  };
  const centreOf = (idx: number) => {
    'worklet';
    return squareCenter(squareName(idx), sv.size.get(), sv.orientation.get(), sv.mirror.get());
  };
  /** Released (tap) on idx with `prev` selected at touch-down. */
  const tapAt = (idx: number, prev: number) => {
    'worklet';
    if (prev >= 0 && idx !== prev && isTarget(idx) && sv.selected.get() === prev) {
      if (isPromotion(prev, idx)) {
        scheduleOnRN(requestPromotion, prev, idx);
        return;
      }
      select(-1);
      scheduleOnRN(commitFromUI, prev, idx, false);
      return;
    }
    if (idx >= 0 && isOwn(idx)) {
      if (sv.selected.get() !== idx) select(idx);
      return;
    }
    select(-1);
  };
  const snapBack = (from: number) => {
    'worklet';
    const c = centreOf(from);
    sv.fingerX.set(withSpring(c.x, SNAP_BACK_SPRING));
    sv.fingerY.set(withSpring(c.y, SNAP_BACK_SPRING));
    sv.offX.set(withSpring(0, SNAP_BACK_SPRING));
    sv.offY.set(withSpring(0, SNAP_BACK_SPRING));
    sv.dragScale.set(withSpring(1, SNAP_BACK_SPRING, (finished) => {
      'worklet';
      // A new drag interrupts this spring (finished = false) and owns the overlay.
      if (finished && !sv.dragging.get()) {
        sv.dragSq.set(-1);
        sv.dragVisible.set(0);
      }
    }));
  };

  // Tap first: the pan waits for it to fail, i.e. for ≥ DRAG_THRESHOLD of
  // travel (or a long hold), which is exactly "movement enters drag".
  const tap = useTapGesture({
    maxDistance: DRAG_THRESHOLD,
    onActivate: (e) => {
      'worklet';
      if (!canTouch()) return;
      tapAt(hit(e.x, e.y), sv.prevSel.get());
    },
  });

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      // Touch-down: select immediately so dots appear with zero latency.
      sv.dragging.set(false);
      if (!canTouch()) {
        sv.downSq.set(-1);
        return;
      }
      const idx = hit(e.x, e.y);
      const sel = sv.selected.get();
      sv.downSq.set(idx);
      sv.prevSel.set(sel);
      sv.pickupSent.set(false);
      if (idx < 0 || (sel >= 0 && isTarget(idx))) return;
      if (isOwn(idx)) {
        if (sel !== idx) select(idx);
        sv.pickupSent.set(true);
        scheduleOnRN(emitFeel, 'pickup');
      }
    },
    onActivate: (e) => {
      'worklet';
      const idx = sv.downSq.get();
      if (!canTouch() || idx < 0 || !isOwn(idx) || sv.selected.get() !== idx) return;
      const s = sv.size.get() / 8;
      const c = centreOf(idx);
      sv.dragging.set(true);
      sv.dragSq.set(idx);
      sv.dragCode.set(sv.codes.get()[idx]);
      sv.fingerX.set(e.x);
      sv.fingerY.set(e.y);
      // Start exactly on the square, then spring up above the finger.
      sv.offX.set(c.x - e.x);
      sv.offY.set(c.y - e.y);
      sv.offX.set(withSpring(0, LIFT_SPRING));
      sv.offY.set(withSpring(-DRAG_LIFT_SQ * s, LIFT_SPRING));
      sv.dragScale.set(1);
      sv.dragScale.set(withSpring(DRAG_SCALE, LIFT_SPRING));
      sv.dragVisible.set(1);
      if (!sv.pickupSent.get()) scheduleOnRN(emitFeel, 'pickup');
    },
    onUpdate: (e) => {
      'worklet';
      if (!sv.dragging.get()) return;
      sv.fingerX.set(e.x);
      sv.fingerY.set(e.y);
      const h = hit(e.x, e.y);
      const hv = h !== sv.dragSq.get() && isTarget(h) ? h : -1;
      if (hv !== sv.hover.get()) {
        sv.hover.set(hv);
        if (hv >= 0) {
          const now = Date.now();
          if (now - sv.lastHoverAt.get() >= HOVER_THROTTLE_MS) {
            sv.lastHoverAt.set(now);
            scheduleOnRN(emitFeel, 'hoverLegal');
          }
        }
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (!sv.dragging.get()) {
        // The press outlived the tap's slop (> DRAG_THRESHOLD of finger
        // jitter) or its maxDuration without lifting a piece: still a tap
        // when it ends on the square it started on, so a sloppy tap on a
        // target moves instead of silently doing nothing.
        const down = sv.downSq.get();
        if (!e.canceled && canTouch() && down >= 0 && hit(e.x, e.y) === down) tapAt(down, sv.prevSel.get());
        return;
      }
      sv.dragging.set(false);
      sv.hover.set(-1);
      const from = sv.dragSq.get();
      // setInteractive(false) mid-drag (time up, puzzle solved) snaps back.
      const to = e.canceled || !canTouch() ? -1 : hit(e.x, e.y);
      if (to >= 0 && to !== from && isTarget(to)) {
        if (isPromotion(from, to)) {
          sv.dragSq.set(-1);
          sv.dragVisible.set(0);
          scheduleOnRN(requestPromotion, from, to);
          return;
        }
        // Settle onto the target; JS commits and hides the overlay.
        const c = centreOf(to);
        const t = { duration: DROP_SETTLE_MS };
        sv.fingerX.set(withTiming(c.x, t));
        sv.fingerY.set(withTiming(c.y, t));
        sv.offX.set(withTiming(0, t));
        sv.offY.set(withTiming(0, t));
        sv.dragScale.set(withTiming(1, t));
        select(-1);
        scheduleOnRN(commitFromUI, from, to, true);
        return;
      }
      snapBack(from);
      if (to !== from) scheduleOnRN(emitFeel, 'illegal');
    },
    onFinalize: () => {
      'worklet';
      // Cancelled before deactivation (e.g. the view unmounted mid-drag).
      if (sv.dragging.get()) {
        sv.dragging.set(false);
        sv.hover.set(-1);
        snapBack(sv.dragSq.get());
      }
    },
  });

  const gesture = useExclusiveGestures(tap, pan);

  /** VoiceOver activation of a square: the same tap logic, on the UI thread. */
  const onA11yTap = (idx: number) => {
    scheduleOnUI((i: number) => {
      'worklet';
      if (!canTouch()) return;
      const prev = sv.selected.get();
      tapAt(i, prev);
    }, idx);
  };

  // ─── Imperative handle ────────────────────────────────────────────────

  useImperativeHandle(ref, (): BoardHandle => ({
    setPosition: (fen, lastMove = null, ms = 0) => applyPosition(fen, lastMove, { ms }),
    animateMove: (from, to, ms = ANIMATION_MS.normal, promotion) => {
      const before = fenRef.current;
      const idx = squareIndex(from);
      const code = fenInfo(before).placement[idx];
      const promo = promotion ?? (code?.[1] === 'P' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined);
      const r = applyMove(before, from, to, promo);
      if (!r) return Promise.reject(new Error(`illegal move ${from}${to} in ${before}`));
      // The opponent is moving: block input until the last slide settles
      // (PLAN §2.6; the web allowed selecting mid-slide).
      lockCount.current += 1;
      sv.locked.set(true);
      return applyPosition(r.fen, { from, to }, { ms }).finally(() => {
        lockCount.current -= 1;
        if (lockCount.current === 0) sv.locked.set(false);
      });
    },
    flash: (sq, ok) =>
      new Promise((resolve) => {
        const d = keyframes.squareFeedback.duration;
        const e = ease(keyframes.squareFeedback.easing);
        const [, inStop, holdStop] = keyframeStops.squareFeedbackOpacity;
        sv.flashSq.set(squareIndex(sq));
        sv.flashOk.set(ok);
        sv.flashOpacity.set(0);
        sv.flashOpacity.set(withSequence(
          withTiming(1, { duration: d * inStop[0], easing: e }),
          withDelay(d * (holdStop[0] - inStop[0]), withTiming(0, { duration: d * (1 - holdStop[0]), easing: e }, () => {
            'worklet';
            sv.flashSq.set(-1);
            scheduleOnRN(resolve);
          })),
        ));
      }),
    shake: (sq) =>
      new Promise((resolve) => {
        if (reduced) {
          resolve();
          return;
        }
        const d = keyframes.pieceShake.duration;
        const e = ease(keyframes.pieceShake.easing);
        const stops = keyframeStops.pieceShakeX;
        sv.shakeSq.set(squareIndex(sq));
        sv.shakeX.set(0);
        const steps = stops.slice(1).map(([at, v], i) => {
          const isLast = i === stops.length - 2;
          const onEnd = () => {
            'worklet';
            sv.shakeSq.set(-1);
            scheduleOnRN(resolve);
          };
          return withTiming(v, { duration: d * (at - stops[i][0]), easing: e }, isLast ? onEnd : undefined);
        });
        sv.shakeX.set(withSequence(...steps));
      }),
    sparks: (sq) =>
      new Promise((resolve) => {
        if (reduced) {
          resolve();
          return;
        }
        sv.sparkSq.set(squareIndex(sq));
        sv.sparkClock.set(0);
        sv.sparkClock.set(withTiming(SPARK_TOTAL_MS, { duration: SPARK_TOTAL_MS, easing: Easing.linear }, () => {
          'worklet';
          sv.sparkSq.set(-1);
          scheduleOnRN(resolve);
        }));
      }),
    setHint: (level, from, to) => {
      clearHint();
      if (level <= 0 || !from) return;
      const f = squareIndex(from);
      sv.hintFrom.set(f);
      // Web auto-selected the hinted piece (dots included).
      scheduleOnUI((i: number) => {
        'worklet';
        select(i);
      }, f);
      if (level >= 2 && to) {
        sv.hintTo.set(squareIndex(to));
        setHintArrow({ from, to });
      }
      if (!reduced) {
        sv.hintPulse.set(withRepeat(
          withTiming(1, { duration: keyframes.hintPulse.duration, easing: ease(keyframes.hintPulse.easing) }),
          -1,
          false,
        ));
      }
    },
    setArrows: (list) => setArrowsState(list),
    setInteractive: (on) => {
      sv.interactive.set(on);
    },
    reset: (fen, orientation) => {
      if (orientation) setGeo((g) => ({ ...g, orientation }));
      endDragNow();
      applyPosition(fen, null, { ms: 0, fresh: true });
    },
    getFen: () => fenRef.current,
  }));

  useEffect(() => {
    onRenderCount?.(renders);
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(boardSize(width, height, 1 / PixelRatio.get()));
  };
  const onInnerLayout = () => {
    innerRef.current?.measureInWindow((x, y, w) => onBoardFrame?.({ x, y, size: w }));
  };

  const { orientation, mirror } = geo;
  const g = { size, orientation, mirror };
  const allArrows = hintArrow ? [...arrows, hintArrow] : arrows;

  return (
    <View style={[styles.root, style]} onLayout={onLayout}>
      {size > 0 && (
        <View style={[styles.slot, { width: size, height: size }]}>
          <GestureDetector gesture={gesture}>
            <View ref={innerRef} onLayout={onInnerLayout} style={[styles.board, { width: size, height: size }]} testID="board">
              <View style={styles.frame} pointerEvents="none">
                <Image source={BOARD_IMAGE} style={StyleSheet.absoluteFill} contentFit="fill" transition={null} />
              </View>
              {coordinates && <Coordinates {...g} />}
              <Highlights sv={sv} {...g} />
              <CheckGlow square={view.checkSquare} {...g} />
              {view.pieces.map((p) => (
                <Piece
                  key={p.id}
                  id={p.id}
                  code={p.code}
                  sq={p.sq}
                  ms={p.ms}
                  z={p.z}
                  dying={p.dying}
                  set={pieceSet}
                  {...g}
                  dragSq={sv.dragSq}
                  shakeSq={sv.shakeSq}
                  shakeX={sv.shakeX}
                />
              ))}
              {SQUARE_LIST.map((sq, i) => (
                <SquareCell key={sq} sq={sq} idx={i} label={squareLabel(labels, sq, view.placement[i])} sv={sv} onA11yTap={onA11yTap} {...g} />
              ))}
              <Feedback sv={sv} {...g} />
              <Arrows arrows={allArrows} knightArrow={knightArrow} {...g} />
              <Sparks sv={sv} {...g} />
              <DragOverlay sv={sv} size={size} set={pieceSet} />
            </View>
          </GestureDetector>
          {promo && (
            <PromotionPicker
              to={promo.to}
              color={promo.color}
              set={pieceSet}
              labels={labels}
              {...g}
              onPick={(p) => {
                setPromo(null);
                commitUserMove(promo.from, promo.to, false, p);
              }}
              onCancel={() => setPromo(null)}
            />
          )}
        </View>
      )}
    </View>
  );
}

const SQUARE_LIST: Square[] = Array.from({ length: 64 }, (_, i) => squareName(i));

export const Board = memo(BoardImpl);

const styles = StyleSheet.create({
  // zIndex lifts the drag overlay and sparks above later siblings.
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  slot: { borderRadius: radii.board, boxShadow: [...shadows.board] },
  board: { overflow: 'visible' },
  frame: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.board,
    overflow: 'hidden',
  },
});
