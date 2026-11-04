'use client';

// Board v2 for the web (D31, docs/web/PLAN.md W2): a DOM port of the app's
// board (apps/mobile/src/board). The same imperative BoardHandle and props;
// the app's tiles and pieces; sizes and colours from the tokens (CSS
// variables), durations and easings from @tac/core/tokens. BoardEngine
// (engine.ts) owns everything that moves; this component renders the
// structure and re-renders only on geometry, arrows, promotion and the
// idle reconcile after a move.
import {
  boardSize, SPARKS,
  type AppPieceSet, type KnightArrowMode, type Orientation, type PromotionPiece,
} from '@tac/core/board';
import clsx from 'clsx';
import {
  forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
  type CSSProperties,
} from 'react';

import { useReducedMotion } from '@/v2/motion';
import { squareLabel, useBoardLabels, type BoardLabels } from './a11y';
import { BOARD_IMAGE, PIECE_CODES, preloadPieceSet } from './assets';
import {
  BoardEngine, type ArrowSpec, type BoardHandle, type BoardMove, type EngineEls, type LastMove, type Model, type PromoRequest,
} from './engine';
import { Arrows, Coordinates, SQUARES, SquareCell, squareKey } from './Layers';
import { Piece, Sprite } from './Piece';
import { START_FEN } from './position';
import { PromotionPicker } from './PromotionPicker';
import './board.css';

export type BoardProps = {
  initialFen?: string;
  orientation?: Orientation;
  mirror?: boolean;
  /** Settings piece set, through core's normalizePieceSet. */
  pieceSet?: AppPieceSet;
  knightArrow?: KnightArrowMode;
  coordinates?: boolean;
  /** Screen-reader strings; core's `board.*` keys by default. */
  labels?: BoardLabels;
  /** The user's move, after chess.js validation and the board's own commit. Return false to take it back. */
  onMove?: (move: BoardMove) => boolean | void;
  /**
   * Who plays a legal user move's click / capture / check feel: the board
   * itself (labs, viewer) or the caller, which knows whether the move solved
   * or failed the puzzle and plays `correct` / `mistake` instead.
   */
  moveFeel?: 'board' | 'caller';
  /** Every position change (user move, animateMove, setPosition, reset). */
  onPositionChange?: (fen: string, lastMove: LastMove | null) => void;
  /** Dev: the board's React render count after each commit (the app's useRenderCount). */
  onRenderCount?: (n: number) => void;
  className?: string;
  style?: CSSProperties;
};

const MARKS = ['lastFrom', 'lastTo', 'selected', 'check'] as const;

const BoardImpl = forwardRef<BoardHandle, BoardProps>(function Board(
  {
    initialFen = START_FEN,
    orientation: orientationProp = 'white',
    mirror: mirrorProp = false,
    pieceSet = 'classic',
    knightArrow = 'bent',
    coordinates = true,
    labels: labelsProp,
    onMove,
    moveFeel = 'board',
    onPositionChange,
    onRenderCount,
    className,
    style,
  },
  ref,
) {
  const renders = useRef(0);
  renders.current += 1;
  const defaultLabels = useBoardLabels();
  const labels = labelsProp ?? defaultLabels;
  const reduced = useReducedMotion();

  const [geo, setGeo] = useState({ orientation: orientationProp, mirror: mirrorProp });
  const [view, setView] = useState<Model | null>(null);
  const [arrows, setArrows] = useState<ArrowSpec[]>([]);
  const [hintArrow, setHintArrow] = useState<ArrowSpec | null>(null);
  const [promo, setPromo] = useState<PromoRequest | null>(null);
  const [size, setSize] = useState(0);
  const [focusSq, setFocusSq] = useState(0);

  const [engine] = useState(
    () =>
      new BoardEngine(initialFen, orientationProp, mirrorProp, { pieceSet, moveFeel, onMove, onPositionChange }, {
        setView,
        setArrows,
        setHintArrow,
        setPromo,
        setOrientation: (o) => setGeo((g) => ({ ...g, orientation: o })),
      }),
  );
  // Latest callbacks for the engine (read at event time, never during render).
  engine.props = { pieceSet, moveFeel, onMove, onPositionChange };
  const model = view ?? engine.model0;

  // Props → geometry (reset() can also change it): adjust during render.
  const [geoProps, setGeoProps] = useState({ orientation: orientationProp, mirror: mirrorProp });
  if (geoProps.orientation !== orientationProp || geoProps.mirror !== mirrorProp) {
    setGeoProps({ orientation: orientationProp, mirror: mirrorProp });
    setGeo({ orientation: orientationProp, mirror: mirrorProp });
  }

  useImperativeHandle(ref, () => engine.handle, [engine]);

  // ─── Elements → engine ────────────────────────────────────────────────

  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef<Partial<Record<string, HTMLElement | null>>>({});
  const squareEls = useRef<HTMLElement[]>([]);
  const sparkEls = useRef<HTMLElement[]>([]);
  const overlayImgs = useRef<HTMLElement[]>([]);
  const setMark = (name: string) => (el: HTMLElement | null) => {
    markRefs.current[name] = el;
  };
  const cellRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) squareEls.current[idx] = el;
  }, []);

  useLayoutEffect(() => {
    const m = markRefs.current;
    const need = (k: string) => m[k] as HTMLElement;
    const els: EngineEls = {
      board: boardRef.current!,
      lastFrom: need('lastFrom'),
      lastTo: need('lastTo'),
      selected: need('selected'),
      check: need('check'),
      hintFrom: need('hintFrom'),
      hintTo: need('hintTo'),
      hintFromGlow: need('hintFromGlow'),
      hintToGlow: need('hintToGlow'),
      hover: need('hover'),
      flash: need('flash'),
      flashFill: need('flashFill'),
      overlay: need('overlay'),
      overlayLift: need('overlayLift'),
      overlayImgs: overlayImgs.current,
      sparks: sparkEls.current,
      squares: squareEls.current,
    };
    engine.attach(els);
    return () => engine.detach();
  }, [engine]);

  // Plans that waited for this commit run once their pieces are mounted
  // (the pieces' layout effects registered them first).
  useLayoutEffect(() => {
    engine.afterCommit();
  }, [engine, view]);

  useLayoutEffect(() => {
    engine.setGeometry(geo.orientation, geo.mirror);
  }, [engine, geo]);

  useEffect(() => {
    preloadPieceSet(pieceSet);
  }, [pieceSet]);

  useEffect(() => {
    onRenderCount?.(renders.current);
  });

  // Whole device pixels per square (the app's boardSize).
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize(boardSize(r.width, r.height || r.width, 1 / (window.devicePixelRatio || 1)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Native listeners: React's pointer events are fine, but these keep the
  // engine's handlers free of synthetic-event pooling and run at capture.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => engine.pointerDown(e);
    const move = (e: PointerEvent) => engine.pointerMove(e);
    const up = (e: PointerEvent) => engine.pointerUp(e);
    const cancel = (e: PointerEvent) => engine.pointerUp(e, true);
    const menu = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', cancel);
    el.addEventListener('contextmenu', menu);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('lostpointercapture', cancel);
      el.removeEventListener('contextmenu', menu);
    };
  }, [engine]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const idx = Number(target.dataset.sq);
    if (!Number.isInteger(idx)) return;
    const r = squareKey(e, idx, geo);
    if (r === null) return;
    e.preventDefault();
    if (r === 'tap') {
      engine.a11yTap(idx);
      return;
    }
    setFocusSq(r);
    squareEls.current[r]?.focus();
  };

  const { orientation, mirror } = geo;
  const allArrows = hintArrow ? [...arrows, hintArrow] : arrows;
  const sizeStyle = size > 0 ? ({ width: size, height: size, '--v2b-sq': `${size / 8}px` } as CSSProperties) : undefined;

  return (
    <div ref={rootRef} className={clsx('v2b-root', className)} style={style}>
      <div className="v2b-slot" style={sizeStyle}>
        <div
          ref={boardRef}
          className="v2b-board"
          role="group"
          aria-label={labels.board}
          data-testid="board"
          data-fen={model.fen}
          onKeyDown={onKeyDown}
        >
          <div className="v2b-frame" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- one baked board image, fixed */}
            <img src={BOARD_IMAGE} alt="" draggable={false} />
          </div>
          {coordinates && <Coordinates orientation={orientation} mirror={mirror} />}
          <div className="v2b-layer v2b-under" aria-hidden>
            {MARKS.map((k) => (
              <div key={k} ref={setMark(k)} className={`v2b-mark v2b-${k}`} data-testid={k === 'lastFrom' ? 'board-last-move' : undefined} />
            ))}
          </div>
          <div className="v2b-layer v2b-pieces" aria-hidden>
            {model.pieces.map((p) => (
              <Piece key={p.id} id={p.id} code={p.code} sq={p.sq} dying={p.dying} set={pieceSet} engine={engine} />
            ))}
          </div>
          <div className="v2b-layer v2b-squares">
            {SQUARES.map((sq, i) => (
              <SquareCell
                key={sq}
                sq={sq}
                idx={i}
                label={squareLabel(labels, sq, model.placement[i])}
                orientation={orientation}
                mirror={mirror}
                focusable={i === focusSq}
                cellRef={cellRef}
              />
            ))}
          </div>
          <div className="v2b-layer v2b-feedback" aria-hidden>
            <div ref={setMark('hintFromGlow')} className="v2b-mark v2b-glow-slot">
              <div className="v2b-glow" />
            </div>
            <div ref={setMark('hintToGlow')} className="v2b-mark v2b-glow-slot">
              <div className="v2b-glow" />
            </div>
            <div ref={setMark('hintFrom')} className="v2b-mark v2b-hint" data-testid="board-hint-from" />
            <div ref={setMark('hintTo')} className="v2b-mark v2b-hint" data-testid="board-hint-to" />
            <div ref={setMark('hover')} className="v2b-mark v2b-hover" />
            <div ref={setMark('flash')} className="v2b-mark v2b-flash-slot">
              <div ref={setMark('flashFill')} className="v2b-flash" />
            </div>
          </div>
          <Arrows arrows={allArrows} orientation={orientation} mirror={mirror} knightArrow={knightArrow} />
          <div className="v2b-layer v2b-sparks" aria-hidden>
            {SPARKS.map((_, i) => (
              <div
                key={i}
                className="v2b-spark"
                ref={(el) => {
                  if (el) sparkEls.current[i] = el;
                }}
              />
            ))}
          </div>
          <div ref={setMark('overlay')} className="v2b-overlay" aria-hidden data-testid="board-drag-overlay">
            <div ref={setMark('overlayLift')} className="v2b-overlay-lift">
              {PIECE_CODES.map((code, i) => (
                <span
                  key={code}
                  className="v2b-overlay-sprite"
                  ref={(el) => {
                    if (el) overlayImgs.current[i] = el;
                  }}
                  hidden
                >
                  <Sprite set={pieceSet} code={code} />
                </span>
              ))}
            </div>
          </div>
        </div>
        {promo && (
          <PromotionPicker
            req={promo}
            orientation={orientation}
            mirror={mirror}
            set={pieceSet}
            labels={labels}
            reduced={reduced}
            onPick={(p: PromotionPiece | null) => engine.pickPromotion(promo, p)}
          />
        )}
      </div>
    </div>
  );
});

/** memo: screens pass stable props (refs, stable callbacks), so runner state never re-renders the board. */
export const Board = memo(BoardImpl);

export type { ArrowSpec, BoardHandle, BoardMove, LastMove };
