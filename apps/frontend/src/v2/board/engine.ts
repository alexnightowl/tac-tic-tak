// The board's imperative core: a DOM port of the app's UI-thread half
// (apps/mobile/src/board/Board.tsx + shared.ts). React renders the board's
// structure once; selection, drag, slides, highlights and feedback are
// written straight to the elements here (transforms, attributes, the Web
// Animations API), so a drag or a move never re-renders React. React only
// catches up after the board goes idle (test ids, labels, unmounting
// captured pieces), and renders first only when an element must mount or
// change its sprite (promotion, reset).
import {
  gridPos, squareCenter, squareIndex, squareName, xyToSquare, SPARK_EASING, SPARK_TOTAL_MS, SPARKS,
  type AppPieceSet, type Orientation, type PromotionPiece, type Square,
} from '@tac/core/board';
import { moveFeelEvent } from '@tac/core/feel';
import { ANIMATION_MS, easing, keyframeStops, keyframes, timing, type Bezier } from '@tac/core/tokens';
import { Chess } from 'chess.js';

import { emitFeel } from '@/v2/feel';
import { prefersReducedMotion } from '@/v2/motion';
import type { PieceCode } from './assets';
import {
  bezier, CAPTURE_END_SCALE, CAPTURE_FADE_AT, CAPTURE_FADE_MS, DRAG_LIFT_SQ, DRAG_SCALE, DRAG_THRESHOLD, DROP_SETTLE_MS,
  HOVER_THROTTLE_MS, LIFT_EASING, LIFT_MS, RECONCILE_IDLE_MS, SECONDARY_MOVE_MS, SNAP_BACK_EASING, SNAP_BACK_MS, TAP_MOVE_MS,
} from './constants';
import {
  checkSquareOf, codeIndices, diffPieces, freshPieces, legalTableOf, occupancy, placementFromFen, tryMove,
  type BoardPiece, type Placement,
} from './position';

export type LastMove = { from: Square; to: Square };

export type ArrowSpec = { from: Square; to: Square };

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

export type PieceView = BoardPiece & { dying: boolean };

/** The board's current position. React renders snapshots of it. */
export type Model = {
  version: number;
  fen: string;
  placement: Placement;
  checkSquare: Square | null;
  /** Live pieces plus the ones the last change captured (fading). */
  pieces: PieceView[];
};

export type PromoRequest = { from: Square; to: Square; color: 'w' | 'b' };

/** What the engine asks of its React shell. */
export type EngineHost = {
  setView(m: Model): void;
  setArrows(a: ArrowSpec[]): void;
  setHintArrow(a: ArrowSpec | null): void;
  setPromo(p: PromoRequest | null): void;
  setOrientation(o: Orientation): void;
};

export type EngineProps = {
  pieceSet: AppPieceSet;
  moveFeel: 'board' | 'caller';
  onMove?: (move: BoardMove) => boolean | void;
  onPositionChange?: (fen: string, lastMove: LastMove | null) => void;
};

/** One mounted piece element. */
type PieceEl = {
  el: HTMLElement;
  /** The code the element renders (its sprite): a plan may only move it if unchanged. */
  code: PieceCode;
  /** Square index the piece stands on (or slides to). */
  at: number;
  /** Captured: fading out, ignored by drag-hide and shake. */
  dead: boolean;
  slide: Animation | null;
};

/** A position change, by piece id (elements resolved when it runs). */
type PlanSpec = {
  /** Slide id for the promise clock; 0 = nothing to wait for. */
  id: number;
  clockMs: number;
  moves: { id: number; to: number; ms: number }[];
  deaths: { id: number; delay: number }[];
  /** The main mover, drawn above the others for `hold` ms. */
  cover: { id: number; hold: number } | null;
  /** Commit of a drag: the overlay hands over to the real piece on `last[1]`. */
  drop: boolean;
  last: [number, number];
  check: number;
  clearHint: boolean;
};

/** Elements the shell hands over once mounted. */
export type EngineEls = {
  board: HTMLElement;
  lastFrom: HTMLElement;
  lastTo: HTMLElement;
  selected: HTMLElement;
  check: HTMLElement;
  hintFrom: HTMLElement;
  hintTo: HTMLElement;
  hintFromGlow: HTMLElement;
  hintToGlow: HTMLElement;
  hover: HTMLElement;
  flash: HTMLElement;
  flashFill: HTMLElement;
  overlay: HTMLElement;
  overlayLift: HTMLElement;
  /** The overlay's 12 sprites, PIECE_CODES order: one shown at a time (no fetch on pickup). */
  overlayImgs: HTMLElement[];
  sparks: HTMLElement[];
  /** 64 square cells, a1 = 0 (dots, rings, a11y). */
  squares: HTMLElement[];
};

type Pointer = {
  id: number;
  rect: DOMRect;
  x0: number;
  y0: number;
  x: number;
  y: number;
  downSq: number;
  prevSel: number;
  pickupSent: boolean;
  /** Travelled past DRAG_THRESHOLD at some point. */
  moved: boolean;
  dragging: boolean;
};

type Marks = 'lastFrom' | 'lastTo' | 'selected' | 'check' | 'hintFrom' | 'hintTo' | 'hintFromGlow' | 'hintToGlow' | 'hover' | 'flash';

let nextPieceId = 1;
const newId = () => nextPieceId++;

const SLIDE = bezier(easing.slide);
const maskHas = (lo: number, hi: number, i: number) => (i < 32 ? (lo >>> i) & 1 : (hi >>> (i - 32)) & 1) === 1;

/** CSS applies a keyframe's easing per segment: the same as the app's withSequence of timings. */
function stopsToFrames<T>(stops: readonly (readonly [number, number])[], value: (v: number) => T, ease: Bezier, prop: string): Keyframe[] {
  return stops.map(([offset, v]) => ({ offset, [prop]: value(v), easing: bezier(ease) }) as Keyframe);
}

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

export class BoardEngine {
  readonly model0: Model;
  props: EngineProps;
  private host: EngineHost;
  private els: EngineEls | null = null;

  // Position (JS side).
  private chess: Chess;
  private model: Model;
  private viewVersion = 0;
  private registry = new Map<number, PieceEl>();
  private queue: PlanSpec[] = [];
  private pending: { id: number; resolve: () => void }[] = [];
  private slideSeq = 0;
  private clockTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private slideBusy = false;
  private cover: { h: PieceEl; timer: ReturnType<typeof setTimeout> } | null = null;

  // Geometry.
  private orientation: Orientation;
  private mirror: boolean;

  // Input layer (the app's SharedValues).
  private legal: number[];
  private codes: number[];
  private turn: 0 | 1;
  private occ: [number, number];
  private selected = -1;
  private selLo = 0;
  private selHi = 0;
  /** Squares carrying a dot / ring right now. */
  private marked: number[] = [];
  private interactive = true;
  private lockCount = 0;
  private marks: Record<Marks, number> = {
    lastFrom: -1, lastTo: -1, selected: -1, check: -1, hintFrom: -1, hintTo: -1, hintFromGlow: -1, hintToGlow: -1, hover: -1, flash: -1,
  };

  // Drag.
  private ptr: Pointer | null = null;
  private raf = 0;
  private dragSq = -1;
  private dragHidden: PieceEl | null = null;
  /** 0 none, 1 drop settling, 2 settled, 3 committed while settling (hand over at settle end). */
  private dropPhase = 0;
  private overlayAnims: Animation[] = [];
  private lastHoverAt = 0;

  // Feedback animations.
  private hintAnims: Animation[] = [];
  private flashAnim: Animation | null = null;
  private hintArrowOn = false;
  private arrowsOn = false;
  private promoOn = false;

  readonly handle: BoardHandle;

  constructor(initialFen: string, orientation: Orientation, mirror: boolean, props: EngineProps, host: EngineHost) {
    const init = initialModel(initialFen);
    this.chess = init.chess;
    this.model = init.model;
    this.model0 = init.model;
    this.props = props;
    this.host = host;
    this.orientation = orientation;
    this.mirror = mirror;
    this.legal = legalTableOf(init.chess);
    this.codes = codeIndices(init.model.placement);
    this.turn = init.chess.turn() === 'w' ? 0 : 1;
    this.occ = occupancy(init.model.placement);
    this.marks.check = init.model.checkSquare ? squareIndex(init.model.checkSquare) : -1;
    this.handle = this.makeHandle();
  }

  // ─── Wiring from the React shell ──────────────────────────────────────

  attach(els: EngineEls): void {
    this.els = els;
    this.applyMarks();
  }

  /** Unmount: timers and frames stop; a later attach (StrictMode remount) works again. */
  detach(): void {
    if (this.clockTimer) clearTimeout(this.clockTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.cover) clearTimeout(this.cover.timer);
    this.clockTimer = null;
    this.idleTimer = null;
    this.cover = null;
    this.slideBusy = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ptr = null;
    // Pending promises would never settle: resolve them.
    const p = this.pending;
    this.pending = [];
    for (const x of p) x.resolve();
  }

  /** Geometry changed (props or reset): every piece and mark jumps to its square. */
  setGeometry(orientation: Orientation, mirror: boolean): void {
    if (orientation === this.orientation && mirror === this.mirror) return;
    this.orientation = orientation;
    this.mirror = mirror;
    this.releaseCover();
    for (const h of this.registry.values()) {
      h.slide?.cancel();
      h.slide = null;
      h.el.style.transform = this.xf(h.at);
    }
    this.applyMarks();
  }

  /** A piece element mounted. Returns its unmount. */
  mountPiece(id: number, el: HTMLElement, code: PieceCode, sq: Square, dying: boolean): () => void {
    const h: PieceEl = { el, code, at: squareIndex(sq), dead: dying, slide: null };
    // A piece that mounts already captured was never on screen alive.
    el.style.opacity = dying ? '0' : '';
    el.style.transform = this.xf(h.at);
    this.registry.set(id, h);
    return () => {
      if (this.registry.get(id) === h) this.registry.delete(id);
    };
  }

  /** React swapped a mounted element's sprite (promotion keeps the pawn's id). */
  pieceCode(id: number, code: PieceCode): void {
    const h = this.registry.get(id);
    if (h) h.code = code;
  }

  /** Plans that waited for a commit run once their elements are mounted. */
  afterCommit(): void {
    const q = this.queue;
    if (q.length === 0) return;
    this.queue = [];
    for (const spec of q) this.runPlan(spec);
  }

  // ─── Geometry helpers ─────────────────────────────────────────────────

  /** Square → transform of a one-square element, in % of itself (independent of the board's px size). */
  private xf(idx: number, dx = 0): string {
    const { col, row } = gridPos(squareName(idx), this.orientation, this.mirror);
    return `translate(${(col + dx) * 100}%,${row * 100}%)`;
  }

  private hit(x: number, y: number, size: number): number {
    const s = xyToSquare(x, y, size, this.orientation, this.mirror);
    return s ? squareIndex(s) : -1;
  }

  private centre(idx: number, size: number) {
    return squareCenter(squareName(idx), size, this.orientation, this.mirror);
  }

  private reduced(): boolean {
    return prefersReducedMotion();
  }

  // ─── Marks (highlights, rings, flash: one element each) ───────────────

  private mark(name: Marks, idx: number): void {
    this.marks[name] = idx;
    const el = this.els?.[name];
    if (!el) return;
    if (idx >= 0) {
      el.style.transform = this.xf(idx);
      el.dataset.on = '1';
    } else {
      delete el.dataset.on;
    }
  }

  private applyMarks(): void {
    for (const k of Object.keys(this.marks) as Marks[]) this.mark(k, this.marks[k]);
    this.paintTargets();
  }

  // ─── Selection: legal dots and capture rings ──────────────────────────

  private canTouch(): boolean {
    return this.interactive && this.lockCount === 0;
  }

  private isOwn(idx: number): boolean {
    const c = this.codes[idx];
    return c >= 0 && (c < 6 ? 0 : 1) === this.turn;
  }

  private isTarget(idx: number): boolean {
    return idx >= 0 && maskHas(this.selLo, this.selHi, idx);
  }

  private isPromotion(from: number, to: number): boolean {
    const c = this.codes[from];
    const rank = to >> 3;
    return (c === 0 || c === 6) && (rank === 7 || rank === 0);
  }

  private select(idx: number): void {
    this.selected = idx;
    this.selLo = idx >= 0 ? this.legal[idx * 2] | 0 : 0;
    this.selHi = idx >= 0 ? this.legal[idx * 2 + 1] | 0 : 0;
    this.mark('selected', idx);
    this.paintTargets();
  }

  private paintTargets(): void {
    const squares = this.els?.squares;
    if (!squares) return;
    for (const i of this.marked) delete squares[i]?.dataset.t;
    this.marked = [];
    if (this.selected < 0) return;
    const [oLo, oHi] = this.occ;
    for (let i = 0; i < 64; i++) {
      if (!maskHas(this.selLo, this.selHi, i)) continue;
      const el = squares[i];
      if (!el) continue;
      el.dataset.t = maskHas(oLo, oHi, i) ? 'ring' : 'dot';
      this.marked.push(i);
    }
  }

  // ─── Position changes ─────────────────────────────────────────────────

  private releaseCover(): void {
    if (!this.cover) return;
    clearTimeout(this.cover.timer);
    this.cover.h.el.style.zIndex = '';
    this.cover = null;
  }

  private slidePiece(h: PieceEl, to: number, ms: number): void {
    const target = this.xf(to);
    // A slide starts where the piece is now (mid-slide included).
    const from = ms > 0 ? (h.slide?.playState === 'running' ? getComputedStyle(h.el).transform : this.xf(h.at)) : null;
    h.slide?.cancel();
    h.slide = null;
    h.at = to;
    h.el.style.transform = target;
    if (from && from !== 'none') {
      h.slide = h.el.animate([{ transform: from }, { transform: target }], { duration: ms, easing: SLIDE });
    }
  }

  private finishDrop(): void {
    this.dropPhase = 0;
    this.dragSq = -1;
    this.hideOverlay();
  }

  /** Runs one position change: everything visible starts here, in one frame. */
  private runPlan(p: PlanSpec): void {
    // A drop keeps its overlay until the settle ends (it covers the real
    // piece, hidden on its new square); anything else ends it.
    if (p.drop) {
      if (this.dropPhase === 2) this.finishDrop();
      else if (this.dropPhase === 1 || this.dropPhase === 3) {
        this.dragSq = p.last[1];
        this.dropPhase = 3;
      }
    } else if (this.dropPhase !== 0) {
      this.finishDrop();
    }

    this.releaseCover();
    for (const mv of p.moves) {
      const h = this.registry.get(mv.id);
      if (h) this.slidePiece(h, mv.to, mv.ms);
    }
    // The capturer covers the square first, then the victim fades under it.
    for (const d of p.deaths) {
      const h = this.registry.get(d.id);
      if (!h) continue;
      h.dead = true;
      h.slide?.cancel();
      h.slide = null;
      const t = this.xf(h.at);
      h.el.animate(
        [{ opacity: 1, transform: t }, { opacity: 0, transform: `${t} scale(${CAPTURE_END_SCALE})` }],
        { delay: d.delay, duration: CAPTURE_FADE_MS, fill: 'forwards' },
      );
    }
    if (p.cover) {
      const h = this.registry.get(p.cover.id);
      if (h) {
        h.el.style.zIndex = '2';
        const timer = setTimeout(() => {
          if (this.cover?.h !== h) return;
          h.el.style.zIndex = '';
          this.cover = null;
        }, p.cover.hold);
        this.cover = { h, timer };
      }
    }

    this.mark('lastFrom', p.last[0]);
    this.mark('lastTo', p.last[1]);
    this.mark('check', p.check);
    this.select(-1);
    this.mark('hover', -1);
    if (p.clearHint) this.clearHintMarks();

    if (p.clockMs > 0) {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = null;
      this.slideBusy = true;
      // A newer slide restarts the clock; its end then settles this one too.
      if (this.clockTimer) clearTimeout(this.clockTimer);
      const id = p.id;
      this.clockTimer = setTimeout(() => {
        this.clockTimer = null;
        this.slideBusy = false;
        this.onClockEnd(id);
        this.armIdle();
      }, p.clockMs);
    } else if (!this.slideBusy) {
      this.armIdle();
    }
  }

  private onClockEnd(id: number): void {
    const done = this.pending.filter((p) => p.id <= id);
    if (done.length === 0) return;
    this.pending = this.pending.filter((p) => p.id > id);
    for (const p of done) p.resolve();
  }

  /** Reconcile React once nothing has slid for RECONCILE_IDLE_MS. */
  private armIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (!this.slideBusy) this.flush();
    }, RECONCILE_IDLE_MS);
  }

  /** Hands React the current model (no-op when it already has it). */
  private flush(): void {
    const model = this.model;
    if (this.viewVersion === model.version) return;
    this.viewVersion = model.version;
    this.host.setView(model);
  }

  /**
   * The one place a position becomes current; `chess` already holds it.
   * Returns when its slides end.
   */
  private commit(last: LastMove | null, opts: { ms: number; fresh?: boolean; dragFrom?: Square }): Promise<void> {
    const chess = this.chess;
    const prev = this.model;
    const fen = chess.fen();
    const placement = placementFromFen(fen);
    const reduced = this.reduced();
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
        // A dropped piece is already under the pointer: it lands, it doesn't slide.
        const pms = opts.dragFrom ? (was.get(p.id) === opts.dragFrom ? 0 : secondary) : ms;
        moves.push({ id: p.id, to: squareIndex(p.sq), ms: pms });
      }
      const fadeDelay = Math.round((opts.dragFrom ? 0 : ms) * CAPTURE_FADE_AT);
      for (const c of d.captured) deaths.push({ id: c.id, delay: fadeDelay });
      pieces = [...d.pieces.map((p) => ({ ...p, dying: false })), ...d.captured.map((c) => ({ ...c, dying: true }))];
      if (opts.dragFrom) ms = Math.max(0, ...moves.map((mv) => mv.ms));
      // Cover: the move's piece while it slides or while its victim fades
      // under it; else the first sliding piece (a dropped king's rook).
      const mover = last ? d.pieces.find((p) => p.sq === last.to && d.moved.has(p.id)) : undefined;
      const moverMs = mover ? (moves.find((mv) => mv.id === mover.id)?.ms ?? 0) : 0;
      const victimUnder = !!last && d.captured.some((c) => c.sq === last.to);
      if (mover && (moverMs > 0 || victimUnder)) {
        cover = { id: mover.id, hold: Math.max(moverMs, victimUnder ? fadeDelay + CAPTURE_FADE_MS : 0) };
      } else {
        const first = moves.find((mv) => mv.ms > 0);
        if (first) cover = { id: first.id, hold: first.ms };
      }
    }
    const checkSquare = checkSquareOf(chess, placement);
    const changed = fen !== prev.fen;
    const model: Model = { version: prev.version + 1, fen, placement, checkSquare, pieces };
    this.model = model;

    // The side to move's legal targets for the next touch.
    this.codes = codeIndices(placement);
    this.legal = legalTableOf(chess);
    this.turn = chess.turn() === 'w' ? 0 : 1;
    this.occ = occupancy(placement);

    const id = ms > 0 ? ++this.slideSeq : 0;
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
    // Fast path: every live piece already has a mounted element with its
    // sprite, so the plan starts right now and React follows later.
    const fast =
      !opts.fresh &&
      this.queue.length === 0 &&
      pieces.every((p) => p.dying || this.registry.get(p.id)?.code === p.code);
    if (fast) {
      this.runPlan(spec);
    } else {
      this.queue.push(spec);
      this.flush();
    }

    if (spec.clearHint) {
      if (this.hintArrowOn) {
        this.hintArrowOn = false;
        this.host.setHintArrow(null);
      }
      if (this.arrowsOn) {
        this.arrowsOn = false;
        this.host.setArrows([]);
      }
    }
    if (this.promoOn) {
      this.promoOn = false;
      this.host.setPromo(null);
    }
    this.props.onPositionChange?.(fen, last);
    if (id === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.pending.push({ id, resolve });
    });
  }

  /** User move (tap / drop / promotion pick): validate, commit, feel, report. */
  private commitUserMove(from: Square, to: Square, viaDrag: boolean, promotion?: PromotionPiece): void {
    const before = this.model.fen;
    const move = tryMove(this.chess, from, to, promotion);
    if (!move) {
      if (viaDrag) this.endDragNow();
      emitFeel('illegal');
      return;
    }
    void this.commit({ from, to }, { ms: viaDrag ? 0 : TAP_MOVE_MS, dragFrom: viaDrag ? from : undefined });
    if (this.props.moveFeel === 'board') emitFeel(moveFeelEvent(move), { move });
    const accepted = this.props.onMove?.({
      from, to, promotion, san: move.san, flags: move.flags, captured: move.captured, fen: this.model.fen, before,
    });
    if (accepted === false) {
      this.chess.load(before);
      void this.commit(null, { ms: TAP_MOVE_MS });
    }
  }

  private requestPromotion(fromIdx: number, toIdx: number): void {
    this.promoOn = true;
    this.host.setPromo({ from: squareName(fromIdx), to: squareName(toIdx), color: this.chess.turn() });
  }

  /** The promotion picker's choice (null = cancelled). */
  pickPromotion(req: PromoRequest, piece: PromotionPiece | null): void {
    this.promoOn = false;
    this.host.setPromo(null);
    if (piece) this.commitUserMove(req.from, req.to, false, piece);
  }

  // ─── Taps ─────────────────────────────────────────────────────────────

  /** Released (tap) on idx with `prev` selected at press-down. */
  private tapAt(idx: number, prev: number): void {
    if (prev >= 0 && idx !== prev && this.isTarget(idx) && this.selected === prev) {
      if (this.isPromotion(prev, idx)) {
        this.requestPromotion(prev, idx);
        return;
      }
      this.select(-1);
      this.commitUserMove(squareName(prev), squareName(idx), false);
      return;
    }
    if (idx >= 0 && this.isOwn(idx)) {
      if (this.selected !== idx) this.select(idx);
      return;
    }
    this.select(-1);
  }

  /** Keyboard / screen-reader activation of a square: the same tap logic. */
  a11yTap(idx: number): void {
    if (!this.canTouch()) return;
    this.tapAt(idx, this.selected);
  }

  // ─── Pointer input ────────────────────────────────────────────────────

  pointerDown(e: PointerEvent): void {
    // One pointer at a time; mouse: the main button only.
    if (this.ptr || (e.pointerType === 'mouse' && e.button !== 0) || !this.els) return;
    const board = this.els.board;
    const rect = board.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p: Pointer = {
      id: e.pointerId, rect, x0: x, y0: y, x, y, downSq: -1, prevSel: this.selected, pickupSent: false, moved: false, dragging: false,
    };
    this.ptr = p;
    try {
      board.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events in tests have no active pointer.
    }
    if (!this.canTouch()) return;
    const idx = this.hit(x, y, rect.width);
    p.downSq = idx;
    // Press-down: select at once so the dots appear with zero latency.
    if (idx < 0 || (this.selected >= 0 && this.isTarget(idx))) return;
    if (this.isOwn(idx)) {
      if (this.selected !== idx) this.select(idx);
      p.pickupSent = true;
      emitFeel('pickup');
    }
  }

  pointerMove(e: PointerEvent): void {
    const p = this.ptr;
    if (!p || e.pointerId !== p.id) return;
    p.x = e.clientX - p.rect.left;
    p.y = e.clientY - p.rect.top;
    if (!p.dragging) {
      if (Math.hypot(p.x - p.x0, p.y - p.y0) < DRAG_THRESHOLD) return;
      p.moved = true;
      const idx = p.downSq;
      if (!this.canTouch() || idx < 0 || !this.isOwn(idx) || this.selected !== idx) return;
      this.startDrag(p, idx);
    }
    // One write per frame, however many pointer events arrive.
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (): void => {
    this.raf = 0;
    const p = this.ptr;
    if (!p?.dragging || !this.els) return;
    const size = p.rect.width;
    const s = size / 8;
    this.els.overlay.style.transform = `translate(${p.x - s / 2}px,${p.y - s / 2}px)`;
    const h = this.hit(p.x, p.y, size);
    const hv = h !== this.dragSq && this.isTarget(h) ? h : -1;
    if (hv !== this.marks.hover) {
      this.mark('hover', hv);
      if (hv >= 0) {
        const now = performance.now();
        if (now - this.lastHoverAt >= HOVER_THROTTLE_MS) {
          this.lastHoverAt = now;
          emitFeel('hoverLegal');
        }
      }
    }
  };

  pointerUp(e: PointerEvent, canceled = false): void {
    const p = this.ptr;
    if (!p || e.pointerId !== p.id) return;
    this.ptr = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    const board = this.els?.board;
    try {
      if (board?.hasPointerCapture(e.pointerId)) board.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    const size = p.rect.width;
    const x = e.clientX - p.rect.left;
    const y = e.clientY - p.rect.top;
    if (!p.dragging) {
      if (canceled || !this.canTouch()) return;
      if (!p.moved) {
        this.tapAt(this.hit(x, y, size), p.prevSel);
        return;
      }
      // The press outlived the tap's slop without lifting a piece: still a
      // tap when it ends on the square it started on.
      if (p.downSq >= 0 && this.hit(x, y, size) === p.downSq) this.tapAt(p.downSq, p.prevSel);
      return;
    }
    this.mark('hover', -1);
    const from = this.dragSq;
    // setInteractive(false) mid-drag (time up, puzzle solved) snaps back.
    const to = canceled || !this.canTouch() ? -1 : this.hit(x, y, size);
    if (to >= 0 && to !== from && this.isTarget(to)) {
      if (this.isPromotion(from, to)) {
        this.dragSq = -1;
        this.hideOverlay();
        this.requestPromotion(from, to);
        return;
      }
      // Settle onto the target; the overlay hands over to the real piece
      // when both the settle and the commit are done (dropPhase).
      this.dropPhase = 1;
      const c = this.centre(to, size);
      this.animateOverlay(c.x - size / 16, c.y - size / 16, DROP_SETTLE_MS, bezier(easing.easeOut), () => {
        if (this.dropPhase === 3) this.finishDrop();
        else if (this.dropPhase === 1) this.dropPhase = 2;
      });
      this.select(-1);
      this.commitUserMove(squareName(from), squareName(to), true);
      return;
    }
    this.snapBack(from, size);
    if (to !== from) emitFeel('illegal');
  }

  private startDrag(p: Pointer, idx: number): void {
    const els = this.els;
    if (!els) return;
    // A previous drop still settling (or snapping back): land it now, this drag owns the overlay.
    for (const a of this.overlayAnims) a.cancel();
    this.overlayAnims = [];
    if (this.dropPhase !== 0) this.finishDrop();
    else this.hideOverlay();
    const size = p.rect.width;
    const s = size / 8;
    const c = this.centre(idx, size);
    p.dragging = true;
    this.dragSq = idx;
    const code = this.codes[idx];
    els.overlayImgs.forEach((img, i) => {
      img.hidden = i !== code;
    });
    // Hide the real piece: the overlay draws it.
    const h = [...this.registry.values()].find((q) => !q.dead && q.at === idx) ?? null;
    if (h) h.el.style.opacity = '0';
    this.dragHidden = h;
    els.overlay.style.transform = `translate(${p.x - s / 2}px,${p.y - s / 2}px)`;
    // Start exactly on the square, then lift above the pointer.
    this.overlayAnims.push(
      els.overlayLift.animate(
        [
          { transform: `translate(${c.x - p.x}px,${c.y - p.y}px) scale(1)` },
          { transform: `translate(0px,${-DRAG_LIFT_SQ * s}px) scale(${DRAG_SCALE})` },
        ],
        { duration: this.reduced() ? 0 : LIFT_MS, easing: bezier(LIFT_EASING), fill: 'forwards' },
      ),
    );
    els.overlay.dataset.on = '1';
    if (!p.pickupSent) emitFeel('pickup');
  }

  /** Overlay to (x, y) (its top-left, px) and the lift back to rest. */
  private animateOverlay(x: number, y: number, ms: number, ease: string, done: () => void): void {
    const els = this.els;
    if (!els) return;
    const fromOuter = getComputedStyle(els.overlay).transform;
    const fromLift = getComputedStyle(els.overlayLift).transform;
    for (const a of this.overlayAnims) a.cancel();
    const to = `translate(${x}px,${y}px)`;
    els.overlay.style.transform = to;
    const outer = els.overlay.animate([{ transform: fromOuter }, { transform: to }], { duration: ms, easing: ease, fill: 'forwards' });
    const lift = els.overlayLift.animate(
      [{ transform: fromLift === 'none' ? 'scale(1)' : fromLift }, { transform: 'translate(0px,0px) scale(1)' }],
      { duration: ms, easing: ease, fill: 'forwards' },
    );
    this.overlayAnims = [outer, lift];
    // A new drag cancels these (no finish): it owns the overlay then.
    lift.onfinish = done;
  }

  private snapBack(from: number, size: number): void {
    const c = this.centre(from, size);
    this.animateOverlay(c.x - size / 16, c.y - size / 16, this.reduced() ? 0 : SNAP_BACK_MS, bezier(SNAP_BACK_EASING), () => {
      if (this.ptr?.dragging) return;
      this.dragSq = -1;
      this.hideOverlay();
    });
  }

  private hideOverlay(): void {
    const els = this.els;
    if (els) {
      delete els.overlay.dataset.on;
      for (const a of this.overlayAnims) a.cancel();
      this.overlayAnims = [];
    }
    if (this.dragHidden) {
      this.dragHidden.el.style.opacity = this.dragHidden.dead ? '0' : '';
      this.dragHidden = null;
    }
  }

  private endDragNow(): void {
    this.dropPhase = 0;
    if (this.ptr) this.ptr.dragging = false;
    this.dragSq = -1;
    this.hideOverlay();
    this.mark('hover', -1);
  }

  // ─── Hints and feedback ───────────────────────────────────────────────

  private clearHintMarks(): void {
    for (const a of this.hintAnims) a.cancel();
    this.hintAnims = [];
    this.mark('hintFrom', -1);
    this.mark('hintTo', -1);
    this.mark('hintFromGlow', -1);
    this.mark('hintToGlow', -1);
  }

  private clearHint(): void {
    this.clearHintMarks();
    if (this.hintArrowOn) {
      this.hintArrowOn = false;
      this.host.setHintArrow(null);
    }
  }

  /** hint-pulse: the glow grows to its peak at 60% of the cycle, then fades. */
  private pulse(el: HTMLElement | undefined): void {
    if (!el) return;
    const k = keyframes.hintPulse;
    const peak = keyframeStops.hintPulseGlow[1][0];
    this.hintAnims.push(
      el.animate(
        [
          { offset: 0, opacity: 0, transform: 'scale(1)' },
          { offset: peak, opacity: 1, transform: `scale(${1 + 0.28 * peak})` },
          { offset: 1, opacity: 0, transform: 'scale(1.28)' },
        ],
        { duration: k.duration, easing: bezier(k.easing), iterations: Infinity },
      ),
    );
  }

  private makeHandle(): BoardHandle {
    return {
      setPosition: (fen, lastMove = null, ms = 0) => {
        this.chess.load(fen);
        return this.commit(lastMove, { ms });
      },
      animateMove: (from, to, ms = ANIMATION_MS.normal, promotion) => {
        const before = this.model;
        const code = before.placement[squareIndex(from)];
        const promo = promotion ?? (code?.[1] === 'P' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined);
        if (!tryMove(this.chess, from, to, promo)) {
          return Promise.reject(new Error(`illegal move ${from}${to} in ${before.fen}`));
        }
        // The opponent is moving: input is blocked until the last slide settles.
        this.lockCount += 1;
        return this.commit({ from, to }, { ms }).finally(() => {
          this.lockCount -= 1;
        });
      },
      flash: (sq, ok) =>
        new Promise((resolve) => {
          const els = this.els;
          if (!els) return resolve();
          const k = keyframes.squareFeedback;
          this.flashAnim?.cancel();
          this.mark('flash', squareIndex(sq));
          els.flashFill.dataset.ok = ok ? '1' : '0';
          const a = els.flashFill.animate(stopsToFrames(keyframeStops.squareFeedbackOpacity, (v) => v, k.easing, 'opacity'), {
            duration: k.duration,
          });
          this.flashAnim = a;
          const end = () => {
            if (this.flashAnim === a) {
              this.flashAnim = null;
              this.mark('flash', -1);
            }
            resolve();
          };
          a.onfinish = end;
          a.oncancel = end;
        }),
      shake: (sq) =>
        new Promise((resolve) => {
          const idx = squareIndex(sq);
          const h = [...this.registry.values()].find((q) => !q.dead && q.at === idx);
          if (this.reduced() || !h) return resolve();
          const k = keyframes.pieceShake;
          const a = h.el.animate(stopsToFrames(keyframeStops.pieceShakeX, (v) => this.xf(idx, v), k.easing, 'transform'), {
            duration: k.duration,
          });
          a.onfinish = () => resolve();
          a.oncancel = () => resolve();
        }),
      sparks: (sq) =>
        new Promise((resolve) => {
          const els = this.els;
          if (this.reduced() || !els) return resolve();
          const size = els.board.getBoundingClientRect().width;
          const k = size / 8 / 50; // the web offsets are px at a ~50 px square
          const c = this.centre(squareIndex(sq), size);
          SPARKS.forEach((spark, i) => {
            const el = els.sparks[i];
            if (!el) return;
            const d = Math.max(2, spark.size * k * 1.2);
            el.style.width = `${d}px`;
            el.style.height = `${d}px`;
            el.style.boxShadow = `0 0 ${6 * k}px var(--feedback-spark-glow)`;
            el.style.backgroundColor = spark.color;
            const x0 = c.x - d / 2;
            const y0 = c.y - d / 2;
            el.animate(
              [
                { transform: `translate(${x0}px,${y0}px) scale(1)`, opacity: 1 },
                { transform: `translate(${x0 + spark.dx * k}px,${y0 + spark.dy * k}px) scale(0.3)`, opacity: 0 },
              ],
              { duration: spark.ms, easing: bezier(SPARK_EASING), fill: 'none' },
            );
          });
          setTimeout(resolve, SPARK_TOTAL_MS);
        }),
      setHint: (level, from, to) => {
        this.clearHint();
        if (level <= 0 || !from) return;
        const f = squareIndex(from);
        this.mark('hintFrom', f);
        // The hinted piece is selected (dots included), as on the web.
        this.select(f);
        const reduced = this.reduced();
        if (!reduced) {
          this.mark('hintFromGlow', f);
          this.pulse(this.els?.hintFromGlow);
        }
        if (level >= 2 && to) {
          const t = squareIndex(to);
          this.mark('hintTo', t);
          if (!reduced) {
            this.mark('hintToGlow', t);
            this.pulse(this.els?.hintToGlow);
          }
          this.hintArrowOn = true;
          this.host.setHintArrow({ from, to });
        }
      },
      setArrows: (list) => {
        this.arrowsOn = list.length > 0;
        this.host.setArrows(list);
      },
      setInteractive: (on) => {
        this.interactive = on;
      },
      reset: (fen, orientation) => {
        if (orientation && orientation !== this.orientation) {
          // Before the commit: the fresh pieces mount with the new geometry.
          this.orientation = orientation;
          this.applyMarks();
          this.host.setOrientation(orientation);
        }
        this.endDragNow();
        this.chess.load(fen);
        void this.commit(null, { ms: 0, fresh: true });
      },
      getFen: () => this.model.fen,
    };
  }
}
