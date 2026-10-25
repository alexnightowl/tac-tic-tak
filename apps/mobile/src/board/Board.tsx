// Board v1 (PLAN §2.6): Views + Reanimated + RNGH 3 hooks + expo-image +
// react-native-svg. Selection, drag, hover and feedback live in SharedValues
// and worklets. A position change is a "plan" run on the UI thread first
// (slides, captures, highlights start within a frame of the call); React
// catches up afterwards (testIDs, labels, unmounts) once the board is idle,
// and renders first only when a view must mount or change its sprite.
import {
  boardSize, squareCenter, squareIndex, squareName, squareToXY, xyToSquare, maskHas,
  type AppPieceSet, type KnightArrowMode, type Orientation, type PromotionPiece, type Square,
} from '@tac/core/board';
import { moveFeelEvent, type FeelEvent } from '@tac/core/feel';
import { SPARK_TOTAL_MS } from '@tac/core/board';
import { ANIMATION_MS, easing as EASE, keyframeStops, keyframes, radii, shadows, timing } from '@tac/core/tokens';
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
import { BOARD_IMAGE, PIECE_CODES, type PieceCode } from './assets';
import { Chess } from './chess';
import {
  CAPTURE_END_SCALE, CAPTURE_FADE_MS, DRAG_LIFT_SQ, DRAG_SCALE, DRAG_THRESHOLD, DROP_SETTLE_MS, HOVER_THROTTLE_MS,
  LIFT_SPRING, RECONCILE_IDLE_MS, SECONDARY_MOVE_MS, SNAP_BACK_SPRING, TAP_MOVE_MS,
} from './constants';
import { Arrows, CheckGlow, Coordinates, DragOverlay, Feedback, Highlights, SlideCover, Sparks, SquareCell, type ArrowSpec } from './Layers';
import { Piece } from './Piece';
import {
  checkSquareOf, codeIndices, diffPieces, freshPieces, legalTableOf, occupancy, placementFromFen, START_FEN, tryMove,
  type BoardPiece, type Placement,
} from './position';
import { PromotionPicker } from './PromotionPicker';
import { useBoardShared, type PieceHandle, type PieceRegistry } from './shared';

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

/** performance.now() of each runtime (the UI one is the raw steady clock: calibrate before comparing). */
export type SlideTiming = {
  ms: number;
  /** JS: the earliest handle call this slide's end resolves. */
  called: number;
  /** UI: the plan ran and started the slide. */
  uiStart: number;
  /** UI: the slide clock finished. */
  uiEnd: number;
  /** JS: the promises resolved. */
  resolved: number;
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
  /**
   * Who plays a legal user move's click/capture/check feel: the board itself
   * (labs, viewer) or the caller, which knows whether the move solved or
   * failed the puzzle and plays `correct` / `mistake` instead.
   */
  moveFeel?: 'board' | 'caller';
  /** Every position change (user move, animateMove, setPosition, reset). */
  onPositionChange?: (fen: string, lastMove: LastMove | null) => void;
  /** Dev: the board's React render count after each commit. */
  onRenderCount?: (n: number) => void;
  /** The board square's frame in window coordinates (Maestro drags, overlays). */
  onBoardFrame?: (frame: { x: number; y: number; size: number }) => void;
  /** Dev (bench): timestamps of every slide that resolved promises. */
  onSlideTiming?: (t: SlideTiming) => void;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<BoardHandle>;
};

type PieceView = BoardPiece & { dying: boolean };

/** The board's current position on JS. React renders snapshots of it. */
type Model = {
  version: number;
  fen: string;
  placement: Placement;
  checkSquare: Square | null;
  /** Live pieces plus the ones the last change captured (fading). */
  pieces: PieceView[];
};

/** A position change for the UI thread, by piece id (handles resolved when it runs). */
type PlanSpec = {
  /** Slide id for the promise clock; 0 = nothing to wait for. */
  id: number;
  clockMs: number;
  moves: { id: number; to: number; ms: number }[];
  deaths: { id: number; delay: number }[];
  /** The main mover, drawn above the others for `hold` ms. */
  cover: { id: number; code: number; ms: number; to: number; hold: number } | null;
  /** Commit of a drag: hand the drag overlay over to the real piece on `last[1]`. */
  drop: boolean;
  last: [number, number];
  check: number;
  clearHint: boolean;
};

type UiPlan = {
  id: number;
  clockMs: number;
  moves: { h: PieceHandle; to: number; ms: number }[];
  deaths: { h: PieceHandle; delay: number }[];
  cover: { h: PieceHandle; code: number; ms: number; to: number; hold: number } | null;
  prevCover: PieceHandle | null;
  drop: boolean;
  last: [number, number];
  check: number;
  clearHint: boolean;
};

let nextPieceId = 1;
const newId = () => nextPieceId++;

/** Worklet → JS hop target; feel.emit itself lives on the RN runtime. */
function emitFeel(event: FeelEvent) {
  feel.emit(event);
}

const ease = (b: readonly [number, number, number, number]) => Easing.bezier(b[0], b[1], b[2], b[3]);
const slideEasing = ease(EASE.slide);
const codeIndex = (c: PieceCode) => PIECE_CODES.indexOf(c);

function initialModel(fen: string): { chess: Chess; model: Model } {
  const chess = new Chess(fen);
  const placement = placementFromFen(chess.fen());
  return {
    chess,
    model: {
      version: 0,
      fen: chess.fen(),
      placement,
      checkSquare: checkSquareOf(chess, placement),
      pieces: freshPieces(placement, newId).map((p) => ({ ...p, dying: false })),
    },
  };
}

function BoardImpl({
  initialFen = START_FEN,
  orientation: orientationProp = 'white',
  mirror: mirrorProp = false,
  pieceSet = 'classic',
  knightArrow = 'bent',
  coordinates = true,
  labels = DEFAULT_LABELS,
  onMove,
  moveFeel = 'board',
  onPositionChange,
  onRenderCount,
  onBoardFrame,
  onSlideTiming,
  style,
  ref,
}: BoardProps) {
  const renders = useRenderCount('Board');
  // The initial position seeds the SVs, so the first touch already has legal moves.
  const [initial] = useState(() => initialModel(initialFen));
  const [registry] = useState<PieceRegistry>(() => new Map());
  const sv = useBoardShared(
    codeIndices(initial.model.placement),
    legalTableOf(initial.chess),
    initial.chess.turn() === 'w' ? 0 : 1,
    occupancy(initial.model.placement),
    initial.model.checkSquare ? squareIndex(initial.model.checkSquare) : -1,
  );
  const reduced = useReducedMotion();

  const [size, setSize] = useState(0);
  const [geo, setGeo] = useState({ orientation: orientationProp, mirror: mirrorProp });
  const [view, setView] = useState<Model>(initial.model);
  const [arrows, setArrowsState] = useState<ArrowSpec[]>([]);
  const [hintArrow, setHintArrow] = useState<ArrowSpec | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square; color: 'w' | 'b' } | null>(null);

  // JS-side state read by imperative calls (never during render).
  const chessRef = useRef(initial.chess);
  const modelRef = useRef(initial.model);
  /** Version of the last snapshot handed to React. */
  const viewVersionRef = useRef(0);
  /** Plans waiting for a commit (a view must mount or swap its sprite first). */
  const queueRef = useRef<PlanSpec[]>([]);
  const pendingRef = useRef<{ id: number; at: number; ms: number; resolve: () => void }[]>([]);
  const slideSeqRef = useRef(0);
  const coverRef = useRef<PieceHandle | null>(null);
  // Mirrors of React state, so position changes only set it when it is set.
  const arrowsOnRef = useRef(false);
  const hintArrowOnRef = useRef(false);
  const promoOnRef = useRef(false);
  const lockCount = useRef(0);
  const innerRef = useRef<HostInstance>(null);
  const slideTimingRef = useRef(onSlideTiming);
  useEffect(() => {
    slideTimingRef.current = onSlideTiming;
  });

  // Props → internal geometry (reset() can also change it): adjust during
  // render when the props change, no effect round-trip.
  const [geoProps, setGeoProps] = useState({ orientation: orientationProp, mirror: mirrorProp });
  if (geoProps.orientation !== orientationProp || geoProps.mirror !== mirrorProp) {
    setGeoProps({ orientation: orientationProp, mirror: mirrorProp });
    setGeo({ orientation: orientationProp, mirror: mirrorProp });
  }

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
    let lo = 0;
    let hi = 0;
    if (idx >= 0) {
      const t = sv.legal.get();
      lo = t[idx * 2] | 0;
      hi = t[idx * 2 + 1] | 0;
    }
    const oLo = sv.occLo.get();
    const oHi = sv.occHi.get();
    sv.selLo.set(lo);
    sv.selHi.set(hi);
    sv.dotLo.set((lo & ~oLo) | 0);
    sv.dotHi.set((hi & ~oHi) | 0);
    sv.ringLo.set((lo & oLo) | 0);
    sv.ringHi.set((hi & oHi) | 0);
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
  /** The drag overlay hands over to the real piece (now on its target square). */
  const finishDrop = () => {
    'worklet';
    sv.dropPhase.set(0);
    sv.dragSq.set(-1);
    sv.dragVisible.set(0);
    sv.dragCode.set(-1);
  };
  const releaseCover = (prev: PieceHandle | null) => {
    'worklet';
    if (prev) prev.hide.set(0);
    sv.coverToken.set(sv.coverToken.get() + 1);
    sv.coverCode.set(-1);
  };
  /** Reconcile React once nothing has slid for RECONCILE_IDLE_MS. */
  const armIdle = () => {
    'worklet';
    sv.idle.set(0);
    sv.idle.set(withTiming(1, { duration: RECONCILE_IDLE_MS, easing: Easing.linear }, (finished) => {
      'worklet';
      if (finished && !sv.slideBusy.get()) scheduleOnRN(flush);
    }));
  };

  /** Runs one position change on the UI thread: everything visible starts here, in one frame. */
  const runPlan = (p: UiPlan) => {
    'worklet';
    const t0 = performance.now();
    const size = sv.size.get();
    const o = sv.orientation.get();
    const m = sv.mirror.get();
    const xy = (idx: number) => squareToXY(squareName(idx), size, o, m);

    // A drop keeps its overlay until the settle ends (it covers the real
    // piece, hidden on its new square through dragSq); anything else ends it.
    const phase = sv.dropPhase.get();
    if (p.drop) {
      if (phase === 2) finishDrop();
      else if (phase === 1 || phase === 3) {
        sv.dragSq.set(p.last[1]);
        sv.dropPhase.set(3);
      }
    } else if (phase !== 0) {
      finishDrop();
    }

    releaseCover(p.prevCover);
    const c = p.cover;
    // The cover starts where its piece is now (mid-slide included).
    const cx = c ? c.h.x.get() : 0;
    const cy = c ? c.h.y.get() : 0;

    for (const mv of p.moves) {
      const t = xy(mv.to);
      mv.h.at.set(mv.to);
      if (mv.ms > 0) {
        mv.h.x.set(withTiming(t.x, { duration: mv.ms, easing: slideEasing }));
        mv.h.y.set(withTiming(t.y, { duration: mv.ms, easing: slideEasing }));
      } else {
        mv.h.x.set(t.x);
        mv.h.y.set(t.y);
      }
    }
    // The capturer covers the square first, then the victim fades under it.
    for (const d of p.deaths) {
      d.h.dead.set(1);
      d.h.fade.set(withDelay(d.delay, withTiming(0, { duration: CAPTURE_FADE_MS })));
      d.h.scale.set(withDelay(d.delay, withTiming(CAPTURE_END_SCALE, { duration: CAPTURE_FADE_MS })));
    }
    if (c) {
      const t = xy(c.to);
      const token = sv.coverToken.get();
      sv.coverX.set(cx);
      sv.coverY.set(cy);
      if (c.ms > 0) {
        sv.coverX.set(withTiming(t.x, { duration: c.ms, easing: slideEasing }));
        sv.coverY.set(withTiming(t.y, { duration: c.ms, easing: slideEasing }));
      } else {
        sv.coverX.set(t.x);
        sv.coverY.set(t.y);
      }
      c.h.hide.set(1);
      sv.coverSq.set(c.to);
      sv.coverCode.set(c.code);
      sv.coverHold.set(0);
      sv.coverHold.set(withTiming(1, { duration: c.hold, easing: Easing.linear }, () => {
        'worklet';
        // Same frame as the real view's last slide step: no flicker.
        if (sv.coverToken.get() !== token) return;
        c.h.hide.set(0);
        sv.coverCode.set(-1);
      }));
    }

    sv.lastFrom.set(p.last[0]);
    sv.lastTo.set(p.last[1]);
    sv.checkSq.set(p.check);
    select(-1);
    sv.hover.set(-1);
    if (p.clearHint) {
      cancelAnimation(sv.hintPulse);
      sv.hintPulse.set(0);
      sv.hintFrom.set(-1);
      sv.hintTo.set(-1);
    }

    if (p.clockMs > 0) {
      sv.idle.set(0);
      sv.slideBusy.set(true);
      sv.clock.set(0);
      // A newer slide restarts the clock; its end then settles this one too.
      sv.clock.set(withTiming(1, { duration: p.clockMs, easing: Easing.linear }, (finished) => {
        'worklet';
        if (!finished) return;
        sv.slideBusy.set(false);
        scheduleOnRN(onClockEnd, p.id, t0, performance.now());
        armIdle();
      }));
    } else if (!sv.slideBusy.get()) {
      armIdle();
    }
  };

  /** Re-places every mounted piece for new geometry (jumps; running slides end). */
  const relayout = (hs: PieceHandle[], prevCover: PieceHandle | null, size: number, o: Orientation, m: boolean) => {
    'worklet';
    releaseCover(prevCover);
    for (const h of hs) {
      const p = squareToXY(squareName(h.at.get()), size, o, m);
      h.x.set(p.x);
      h.y.set(p.y);
    }
  };

  // ─── JS side ──────────────────────────────────────────────────────────

  function onClockEnd(id: number, uiStart: number, uiEnd: number) {
    const done = pendingRef.current.filter((p) => p.id <= id);
    if (done.length === 0) return;
    pendingRef.current = pendingRef.current.filter((p) => p.id > id);
    for (const p of done) p.resolve();
    slideTimingRef.current?.({
      ms: done[done.length - 1].ms,
      called: Math.min(...done.map((p) => p.at)),
      uiStart,
      uiEnd,
      resolved: performance.now(),
    });
  }

  /** Hands React the current model (no-op when it already has it). */
  function flush() {
    const model = modelRef.current;
    if (viewVersionRef.current === model.version) return;
    viewVersionRef.current = model.version;
    setView(model);
  }

  const startPlan = (spec: PlanSpec) => {
    const get = (id: number) => registry.get(id);
    const moves: UiPlan['moves'] = [];
    for (const mv of spec.moves) {
      const h = get(mv.id);
      if (h) moves.push({ h, to: mv.to, ms: mv.ms });
    }
    const deaths: UiPlan['deaths'] = [];
    for (const d of spec.deaths) {
      const h = get(d.id);
      if (h) deaths.push({ h, delay: d.delay });
    }
    const ch = spec.cover ? get(spec.cover.id) : undefined;
    const cover = spec.cover && ch ? { ...spec.cover, h: ch } : null;
    const prevCover = coverRef.current;
    coverRef.current = cover?.h ?? null;
    const plan: UiPlan = {
      id: spec.id, clockMs: spec.clockMs, moves, deaths, cover, prevCover,
      drop: spec.drop, last: spec.last, check: spec.check, clearHint: spec.clearHint,
    };
    scheduleOnUI(runPlan, plan);
  };

  /**
   * The one place a position becomes current; `chessRef` already holds it.
   * Returns when its slides end.
   */
  const commit = (last: LastMove | null, opts: { ms: number; fresh?: boolean; dragFrom?: Square }): Promise<void> => {
    const at = performance.now();
    const chess = chessRef.current;
    const prev = modelRef.current;
    const fen = chess.fen();
    const placement = placementFromFen(fen);
    let ms = opts.ms > 0 && reduced ? timing.reducedMotionSlide : opts.ms;
    let pieces: PieceView[];
    const moves: PlanSpec['moves'] = [];
    const deaths: PlanSpec['deaths'] = [];
    let cover: PlanSpec['cover'] = null;
    if (opts.fresh) {
      pieces = freshPieces(placement, newId).map((p) => ({ ...p, dying: false }));
      ms = 0;
    } else {
      const alive = prev.pieces.filter((p) => !p.dying);
      const d = diffPieces(alive, placement, last, newId);
      const secondary = reduced ? timing.reducedMotionSlide : SECONDARY_MOVE_MS;
      const was = new Map(alive.map((p) => [p.id, p.sq]));
      for (const p of d.pieces) {
        if (!d.moved.has(p.id)) continue;
        // A dropped piece is already under the finger: it lands, it doesn't slide.
        const pms = opts.dragFrom ? (was.get(p.id) === opts.dragFrom ? 0 : secondary) : ms;
        moves.push({ id: p.id, to: squareIndex(p.sq), ms: pms });
      }
      const fadeDelay = Math.round((opts.dragFrom ? 0 : ms) * 0.55);
      for (const c of d.captured) deaths.push({ id: c.id, delay: fadeDelay });
      pieces = [...d.pieces.map((p) => ({ ...p, dying: false })), ...d.captured.map((c) => ({ ...c, dying: true }))];
      if (opts.dragFrom) ms = Math.max(0, ...moves.map((mv) => mv.ms));
      // Cover: the move's piece while it slides or while its victim fades
      // under it; else the first sliding piece (a dropped king's rook).
      const mover = last ? d.pieces.find((p) => p.sq === last.to && d.moved.has(p.id)) : undefined;
      const moverMs = mover ? (moves.find((mv) => mv.id === mover.id)?.ms ?? 0) : 0;
      const victimUnder = !!last && d.captured.some((c) => c.sq === last.to);
      if (mover && (moverMs > 0 || victimUnder)) {
        const hold = Math.max(moverMs, victimUnder ? fadeDelay + CAPTURE_FADE_MS : 0);
        cover = { id: mover.id, code: codeIndex(mover.code), ms: moverMs, to: squareIndex(mover.sq), hold };
      } else {
        const first = moves.find((mv) => mv.ms > 0);
        const p = first ? d.pieces.find((q) => q.id === first.id) : undefined;
        if (first && p) cover = { id: first.id, code: codeIndex(p.code), ms: first.ms, to: first.to, hold: first.ms };
      }
    }
    const checkSquare = checkSquareOf(chess, placement);
    const changed = fen !== prev.fen;
    const model: Model = { version: prev.version + 1, fen, placement, checkSquare, pieces };
    modelRef.current = model;

    const id = ms > 0 ? ++slideSeqRef.current : 0;
    const spec: PlanSpec = {
      id,
      clockMs: ms,
      moves,
      deaths,
      cover,
      drop: !!opts.dragFrom,
      last: last ? [squareIndex(last.from), squareIndex(last.to)] : [-1, -1],
      check: checkSquare ? squareIndex(checkSquare) : -1,
      clearHint: changed || !!opts.fresh,
    };
    // Fast path: every live piece already has a mounted view with its
    // sprite, so the UI thread can start right now and React follows later.
    const fast =
      !opts.fresh &&
      queueRef.current.length === 0 &&
      pieces.every((p) => p.dying || registry.get(p.id)?.code === p.code);
    if (fast) {
      startPlan(spec);
    } else {
      queueRef.current.push(spec);
      flush();
    }

    // After the slide is on its way: the side to move's legal targets for
    // the next touch, in one hop.
    const occ = occupancy(placement);
    scheduleOnUI(
      (codes: number[], legal: number[], turn: number, oLo: number, oHi: number) => {
        'worklet';
        sv.codes.set(codes);
        sv.legal.set(legal);
        sv.turn.set(turn);
        sv.occLo.set(oLo);
        sv.occHi.set(oHi);
      },
      codeIndices(placement),
      legalTableOf(chess),
      chess.turn() === 'w' ? 0 : 1,
      occ[0],
      occ[1],
    );

    if (spec.clearHint) {
      if (hintArrowOnRef.current) {
        hintArrowOnRef.current = false;
        setHintArrow(null);
      }
      if (arrowsOnRef.current) {
        arrowsOnRef.current = false;
        setArrowsState([]);
      }
    }
    if (promoOnRef.current) {
      promoOnRef.current = false;
      setPromo(null);
    }
    onPositionChange?.(fen, last);
    if (id === 0) return Promise.resolve();
    return new Promise((resolve) => {
      pendingRef.current.push({ id, at, ms, resolve });
    });
  };

  // Plans that waited for this commit run once their views are mounted
  // (child layout effects registered them first).
  useLayoutEffect(() => {
    const q = queueRef.current;
    if (q.length === 0) return;
    queueRef.current = [];
    for (const spec of q) startPlan(spec);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    sv.size.set(size);
    sv.orientation.set(geo.orientation);
    sv.mirror.set(geo.mirror);
    if (size <= 0) return;
    const prevCover = coverRef.current;
    coverRef.current = null;
    scheduleOnUI(relayout, [...registry.values()], prevCover, size, geo.orientation, geo.mirror);
  }, [size, geo, sv, registry]); // eslint-disable-line react-hooks/exhaustive-deps

  const endDragNow = () => {
    sv.dropPhase.set(0);
    sv.dragging.set(false);
    sv.dragSq.set(-1);
    sv.dragVisible.set(0);
    sv.dragCode.set(-1);
    sv.hover.set(-1);
  };

  /** User move (tap / drop / promotion pick): validate on JS, commit, feel, report. */
  const commitUserMove = (from: Square, to: Square, viaDrag: boolean, promotion?: PromotionPiece) => {
    const before = modelRef.current.fen;
    const move = tryMove(chessRef.current, from, to, promotion);
    if (!move) {
      if (viaDrag) endDragNow();
      feel.emit('illegal');
      return;
    }
    void commit({ from, to }, { ms: viaDrag ? 0 : TAP_MOVE_MS, dragFrom: viaDrag ? from : undefined });
    if (moveFeel === 'board') feel.emit(moveFeelEvent(move), { move });
    const accepted = onMove?.({
      from, to, promotion, san: move.san, flags: move.flags, captured: move.captured, fen: modelRef.current.fen, before,
    });
    if (accepted === false) {
      chessRef.current.load(before);
      void commit(null, { ms: TAP_MOVE_MS });
    }
  };

  const commitFromUI = (fromIdx: number, toIdx: number, viaDrag: boolean) => {
    commitUserMove(squareName(fromIdx), squareName(toIdx), viaDrag);
  };

  const requestPromotion = (fromIdx: number, toIdx: number) => {
    promoOnRef.current = true;
    setPromo({ from: squareName(fromIdx), to: squareName(toIdx), color: chessRef.current.turn() });
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
      // A previous drop still settling: land it now, this drag owns the overlay.
      if (sv.dropPhase.get() !== 0) finishDrop();
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
        // Settle onto the target; the overlay hands over to the real piece
        // when both the settle and the JS commit are done (dropPhase).
        const c = centreOf(to);
        const t = { duration: DROP_SETTLE_MS };
        sv.dropPhase.set(1);
        sv.fingerX.set(withTiming(c.x, t));
        sv.fingerY.set(withTiming(c.y, t));
        sv.offX.set(withTiming(0, t));
        sv.offY.set(withTiming(0, t));
        sv.dragScale.set(withTiming(1, t, () => {
          'worklet';
          const ph = sv.dropPhase.get();
          if (ph === 3) finishDrop();
          else if (ph === 1) sv.dropPhase.set(2);
        }));
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

  const clearHint = () => {
    cancelAnimation(sv.hintPulse);
    sv.hintPulse.set(0);
    sv.hintFrom.set(-1);
    sv.hintTo.set(-1);
    if (hintArrowOnRef.current) {
      hintArrowOnRef.current = false;
      setHintArrow(null);
    }
  };

  // ─── Imperative handle ────────────────────────────────────────────────

  useImperativeHandle(ref, (): BoardHandle => ({
    setPosition: (fen, lastMove = null, ms = 0) => {
      chessRef.current.load(fen);
      return commit(lastMove, { ms });
    },
    animateMove: (from, to, ms = ANIMATION_MS.normal, promotion) => {
      const before = modelRef.current;
      const code = before.placement[squareIndex(from)];
      const promo = promotion ?? (code?.[1] === 'P' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined);
      if (!tryMove(chessRef.current, from, to, promo)) {
        return Promise.reject(new Error(`illegal move ${from}${to} in ${before.fen}`));
      }
      // The opponent is moving: block input until the last slide settles
      // (PLAN §2.6; the web allowed selecting mid-slide).
      lockCount.current += 1;
      sv.locked.set(true);
      return commit({ from, to }, { ms }).finally(() => {
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
        hintArrowOnRef.current = true;
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
    setArrows: (list) => {
      arrowsOnRef.current = list.length > 0;
      setArrowsState(list);
    },
    setInteractive: (on) => {
      sv.interactive.set(on);
    },
    reset: (fen, orientation) => {
      if (orientation) setGeo((g) => ({ ...g, orientation }));
      endDragNow();
      chessRef.current.load(fen);
      void commit(null, { ms: 0, fresh: true });
    },
    getFen: () => modelRef.current.fen,
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
              <CheckGlow sv={sv} square={view.checkSquare} {...g} />
              {view.pieces.map((p) => (
                <Piece
                  key={p.id}
                  id={p.id}
                  code={p.code}
                  sq={p.sq}
                  dying={p.dying}
                  set={pieceSet}
                  registry={registry}
                  {...g}
                  dragSq={sv.dragSq}
                  shakeSq={sv.shakeSq}
                  shakeX={sv.shakeX}
                />
              ))}
              <SlideCover sv={sv} size={size} set={pieceSet} />
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
                promoOnRef.current = false;
                setPromo(null);
                commitUserMove(promo.from, promo.to, false, p);
              }}
              onCancel={() => {
                promoOnRef.current = false;
                setPromo(null);
              }}
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
