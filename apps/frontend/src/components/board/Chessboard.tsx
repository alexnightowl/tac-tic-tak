'use client';

import { Chess, Square } from 'chess.js';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BOARD_THEMES, BoardTheme } from '@/lib/themes';
import { pieceUrl } from '@/lib/pieces';
import { Arrows } from './Arrows';
import { cn } from '@/lib/utils';

type Move = { from: Square; to: Square; promotion?: string };

type Props = {
  fen: string;
  orientation?: 'white' | 'black';
  onMove?: (move: Move) => boolean | void;
  lastMove?: { from: Square; to: Square } | null;
  allowMoves?: boolean;
  theme?: BoardTheme;
  pieceSet?: string;
  /** If set, a piece slides from `from` to `to` while this prop is non-null. */
  animateMove?: { from: Square; to: Square } | null;
  /** Duration of the slide animation in milliseconds. */
  animationMs?: number;
  /** If set, the square is rendered with a pulsing amber hint ring. */
  hintSquare?: Square | null;
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

function sqName(file: number, rank: number): Square {
  return `${FILES[file]}${rank + 1}` as Square;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Board position → grid row/col indices under the current orientation. */
function gridPos(sq: Square, orientation: 'white' | 'black') {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  return {
    col: orientation === 'white' ? file : 7 - file,
    row: orientation === 'white' ? 7 - rank : rank,
  };
}

export function Chessboard({
  fen,
  orientation = 'white',
  onMove,
  lastMove,
  allowMoves = true,
  theme = 'green',
  pieceSet = 'cburnett',
  animateMove,
  animationMs = 280,
  hintSquare = null,
}: Props) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legal, setLegal] = useState<Set<Square>>(new Set());
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState<Square | null>(null);
  const [highlights, setHighlights] = useState<Set<Square>>(new Set());
  const [arrows, setArrows] = useState<Array<{ from: Square; to: Square }>>([]);
  const [arrowDrag, setArrowDrag] = useState<{ from: Square; to?: Square } | null>(null);
  const [promotion, setPromotion] = useState<Move | null>(null);

  useEffect(() => {
    setSelected(null);
    setLegal(new Set());
    setHighlights(new Set());
    setArrows([]);
    setArrowDrag(null);
    setPromotion(null);
  }, [fen]);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setSize(w);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const sq = size / 8;
  const colors = BOARD_THEMES[theme] ?? BOARD_THEMES.green;

  const rows = orientation === 'white' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  // Square of the king currently in check (if any).
  const checkSquare: Square | null = useMemo(() => {
    if (!chess.inCheck()) return null;
    const color = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c];
        if (cell && cell.type === 'k' && cell.color === color) {
          return sqName(c, 7 - r);
        }
      }
    }
    return null;
  }, [chess]);

  const pointToSquare = useCallback((clientX: number, clientY: number): Square | null => {
    if (!ref.current || !size) return null;
    const rect = ref.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    const colIdx = Math.floor(x / sq);
    const rowIdx = Math.floor(y / sq);
    const file = orientation === 'white' ? colIdx : 7 - colIdx;
    const rank = orientation === 'white' ? 7 - rowIdx : rowIdx;
    return sqName(file, rank);
  }, [size, sq, orientation]);

  const legalForSquare = useCallback((from: Square): Set<Square> => {
    const moves = chess.moves({ square: from, verbose: true }) as any[];
    return new Set(moves.map((m) => m.to as Square));
  }, [chess]);

  const tryMove = useCallback((from: Square, to: Square) => {
    if (!allowMoves) return;
    const piece = chess.get(from);
    const isPromotion = piece?.type === 'p' && (to.endsWith('8') || to.endsWith('1'));
    if (isPromotion) {
      setPromotion({ from, to });
      return;
    }
    const ok = onMove?.({ from, to });
    if (ok !== false) {
      setSelected(null);
      setLegal(new Set());
    }
  }, [chess, onMove, allowMoves]);

  const onSquareMouseDown = (e: React.PointerEvent, s: Square) => {
    if (e.button !== 0) return;
    setHighlights(new Set());
    setArrows([]);
    const piece = chess.get(s);
    if (selected && legal.has(s)) {
      tryMove(selected, s);
      return;
    }
    if (piece && piece.color === chess.turn()) {
      setSelected(s);
      setLegal(legalForSquare(s));
      setDragFrom(s);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragPos({ x: e.clientX, y: e.clientY });
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else {
      setSelected(null);
      setLegal(new Set());
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragFrom) {
      setDragPos({ x: e.clientX, y: e.clientY });
      setDragOver(pointToSquare(e.clientX, e.clientY));
    } else if (arrowDrag) {
      const to = pointToSquare(e.clientX, e.clientY);
      if (to) setArrowDrag({ ...arrowDrag, to });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragFrom) {
      const to = pointToSquare(e.clientX, e.clientY);
      if (to && to !== dragFrom && legal.has(to)) {
        tryMove(dragFrom, to);
      }
      setDragFrom(null);
      setDragStart(null);
      setDragPos(null);
      setDragOver(null);
    }
    if (arrowDrag) {
      if (arrowDrag.to && arrowDrag.to !== arrowDrag.from) {
        setArrows((prev) => {
          const exists = prev.find((a) => a.from === arrowDrag.from && a.to === arrowDrag.to);
          if (exists) return prev.filter((a) => a !== exists);
          return [...prev, { from: arrowDrag.from, to: arrowDrag.to! }];
        });
      } else {
        setHighlights((prev) => {
          const next = new Set(prev);
          if (next.has(arrowDrag.from)) next.delete(arrowDrag.from);
          else next.add(arrowDrag.from);
          return next;
        });
      }
      setArrowDrag(null);
    }
  };

  const onRightDown = (e: React.PointerEvent, s: Square) => {
    if (e.button !== 2) return;
    setArrowDrag({ from: s });
  };

  return (
    <div
      ref={ref}
      className="relative w-full aspect-square select-none touch-none overflow-hidden rounded-xl"
      style={{ userSelect: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {rows.map((rank) =>
          cols.map((file) => {
            const s = sqName(file, rank);
            const isLight = (file + rank) % 2 === 1;
            const isLast = lastMove && (lastMove.from === s || lastMove.to === s);
            const isSelected = selected === s;
            const isLegalTarget = legal.has(s);
            const isHighlighted = highlights.has(s);
            const isCheck = checkSquare === s;
            const piece = chess.get(s);
            const isDragging = dragFrom === s;
            const isAnimatingSource = animateMove?.from === s;
            const isHintTarget = hintSquare === s;
            const isDragTarget = !!dragFrom && dragOver === s && legal.has(s) && s !== dragFrom;
            const canGrab = allowMoves && !dragFrom && !!piece && piece.color === chess.turn();
            const cursor = dragFrom
              ? (legal.has(s) || s === dragFrom) ? 'grabbing' : 'not-allowed'
              : canGrab ? 'grab' : 'default';
            return (
              <div
                key={s}
                className={cn('board-square relative flex items-center justify-center',
                  isDragging && 'dragging')}
                style={{ background: isLight ? colors.light : colors.dark, cursor }}
                onPointerDown={(e) => {
                  if (e.button === 2) onRightDown(e, s);
                  else onSquareMouseDown(e, s);
                }}
                data-square={s}
                data-draggable={!!piece}
              >
                {/* check indicator — radial red glow under piece */}
                {isCheck && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    zIndex: 0,
                    background: 'radial-gradient(circle, rgba(239, 68, 68, 0.85) 10%, rgba(239, 68, 68, 0.35) 55%, transparent 80%)',
                  }} />
                )}
                {/* highlight fill — renders BEHIND the piece */}
                {(isLast || isHighlighted || isSelected) && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      zIndex: 0,
                      background: isHighlighted
                        ? 'rgba(208, 90, 77, 0.75)'
                        : isSelected
                          ? hexToRgba(colors.highlight, 0.72)
                          : hexToRgba(colors.lastMove, 0.58),
                    }}
                  />
                )}
                {/* legal move indicator */}
                {isLegalTarget && (
                  piece
                    ? <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, boxShadow: 'inset 0 0 0 3px rgba(0,0,0,0.35)' }} />
                    : <div className="absolute w-1/3 h-1/3 rounded-full bg-black/25 pointer-events-none" style={{ zIndex: 1 }} />
                )}
                {/* drop-target ring while dragging */}
                {isDragTarget && (
                  <div
                    className="absolute inset-0 pointer-events-none rounded-[2px]"
                    style={{ zIndex: 1, boxShadow: `inset 0 0 0 4px ${hexToRgba(colors.highlight, 0.85)}` }}
                  />
                )}
                {/* hint pulse — amber ring around the piece-to-move during
                    review hint reveal. Stays above the piece via z-index so
                    it remains visible on busy backgrounds. */}
                {isHintTarget && (
                  <div
                    className="absolute inset-0 pointer-events-none rounded-[2px] hint-pulse"
                    style={{ zIndex: 4 }}
                  />
                )}
                {/* piece — during drag the same <img> follows the
                    cursor via a translate() delta. Keeping the node in
                    the source square (rather than portalling a ghost)
                    sidesteps any transformed-ancestor / containing-block
                    quirks that would otherwise mis-position a fixed
                    ghost. */}
                {piece && !isAnimatingSource && (
                  <img
                    src={pieceUrl(pieceSet, piece.color, piece.type as any)}
                    alt=""
                    draggable={false}
                    className="w-full h-full pointer-events-none relative"
                    style={{
                      padding: '5%',
                      zIndex: isDragging ? 50 : 2,
                      transform: isDragging && dragStart && dragPos
                        ? `translate(${dragPos.x - dragStart.x}px, ${dragPos.y - dragStart.y}px) scale(1.06)`
                        : undefined,
                      transition: isDragging ? 'none' : undefined,
                      filter: isDragging ? 'drop-shadow(0 10px 18px rgba(0,0,0,0.35))' : undefined,
                      willChange: isDragging ? 'transform' : undefined,
                    }}
                  />
                )}
                {/* coordinates */}
                {file === (orientation === 'white' ? 0 : 7) && (
                  <span className="absolute top-0.5 left-1 text-[10px] font-medium" style={{ color: isLight ? colors.dark : colors.light, zIndex: 2 }}>
                    {rank + 1}
                  </span>
                )}
                {rank === (orientation === 'white' ? 0 : 7) && (
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-medium" style={{ color: isLight ? colors.dark : colors.light, zIndex: 2 }}>
                    {FILES[file]}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>

      {/* Sliding piece for setup / reply animations. */}
      {animateMove && size > 0 && (() => {
        const p = chess.get(animateMove.from);
        if (!p) return null;
        const from = gridPos(animateMove.from, orientation);
        const to = gridPos(animateMove.to, orientation);
        return (
          <img
            key={`${animateMove.from}-${animateMove.to}-${fen}`}
            src={pieceUrl(pieceSet, p.color, p.type as any)}
            alt=""
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              width: sq,
              height: sq,
              padding: '5%',
              left: from.col * sq,
              top: from.row * sq,
              ['--dx' as any]: `${(to.col - from.col) * sq}px`,
              ['--dy' as any]: `${(to.row - from.row) * sq}px`,
              animation: `slide-piece ${animationMs}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
              zIndex: 3,
            }}
          />
        );
      })()}


      <Arrows size={size} orientation={orientation} arrows={arrows}
              pending={arrowDrag?.from && arrowDrag.to ? { from: arrowDrag.from, to: arrowDrag.to } : null} />

      {promotion && (
        <PromotionPicker
          size={size}
          square={promotion.to}
          orientation={orientation}
          color={chess.turn()}
          pieceSet={pieceSet}
          onPick={(p) => {
            const m = { ...promotion, promotion: p };
            setPromotion(null);
            const ok = onMove?.(m);
            if (ok !== false) {
              setSelected(null);
              setLegal(new Set());
            }
          }}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  );
}

function PromotionPicker({ size, square, orientation, color, pieceSet, onPick, onCancel }: {
  size: number;
  square: Square;
  orientation: 'white' | 'black';
  color: 'w' | 'b';
  pieceSet: string;
  onPick: (p: 'q' | 'n' | 'r' | 'b') => void;
  onCancel: () => void;
}) {
  // Ignore pointer events that arrive immediately after mount (otherwise the
  // same tap that triggered the promotion closes the modal).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(id);
  }, []);

  const sq = size / 8;
  const pos = gridPos(square, orientation);
  // Promotion squares are always on the top visible edge, but guard anyway.
  const downward = pos.row <= 3;
  const baseTop = downward ? pos.row * sq : (pos.row - 3) * sq;
  const order: Array<'q' | 'n' | 'r' | 'b'> = downward ? ['q', 'n', 'r', 'b'] : ['b', 'r', 'n', 'q'];

  const pickHandler = (p: 'q' | 'n' | 'r' | 'b') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onPick(p);
  };

  return (
    <>
      <div
        className="absolute inset-0"
        style={{ zIndex: 30, background: 'rgba(0,0,0,0.35)' }}
        onPointerDown={(e) => {
          if (!ready) return;
          e.stopPropagation();
          onCancel();
        }}
      />
      <div
        className="absolute shadow-2xl rounded-lg overflow-hidden ring-1 ring-black/15"
        style={{
          zIndex: 40,
          left: pos.col * sq,
          top: baseTop,
          width: sq,
          height: sq * 4,
          background: 'rgba(252, 252, 252, 0.98)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {order.map((p) => (
          <button
            key={p}
            className="block w-full hover:bg-black/10 active:bg-black/20"
            style={{ height: sq, touchAction: 'manipulation' }}
            onPointerDown={pickHandler(p)}
          >
            <img
              src={pieceUrl(pieceSet, color, p)}
              alt={p}
              draggable={false}
              className="w-full h-full"
              style={{ padding: '8%' }}
            />
          </button>
        ))}
      </div>
    </>
  );
}
