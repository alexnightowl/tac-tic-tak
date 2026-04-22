'use client';

import { useEffect, useRef, useState } from 'react';
import { pieceUrl } from '@/lib/pieces';
import { BOARD_THEMES } from '@/lib/themes';

type Piece = { color: 'w' | 'b'; type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k' };

// A tactical mid-game position for flavour. It's the kind of puzzle you'd
// see mid-rating: white to play, knight fork incoming.
const BOARD: (Piece | null)[][] = [
  // rank 8 (top)
  [{c:'b',t:'r'},null,null,{c:'b',t:'q'},null,{c:'b',t:'r'},{c:'b',t:'k'},null],
  // rank 7
  [{c:'b',t:'p'},{c:'b',t:'p'},{c:'b',t:'p'},null,null,{c:'b',t:'p'},{c:'b',t:'p'},{c:'b',t:'p'}],
  // rank 6
  [null,null,{c:'b',t:'n'},null,{c:'b',t:'p'},{c:'b',t:'n'},null,null],
  // rank 5
  [null,null,null,{c:'b',t:'b'},null,null,null,null],
  // rank 4
  [null,null,{c:'w',t:'b'},{c:'w',t:'p'},{c:'w',t:'p'},null,null,null],
  // rank 3
  [null,null,{c:'w',t:'n'},null,null,{c:'w',t:'n'},null,null],
  // rank 2
  [{c:'w',t:'p'},{c:'w',t:'p'},null,null,null,{c:'w',t:'p'},{c:'w',t:'p'},{c:'w',t:'p'}],
  // rank 1
  [{c:'w',t:'r'},null,null,{c:'w',t:'q'},null,{c:'w',t:'r'},{c:'w',t:'k'},null],
].map((row) => row.map((cell) => cell ? { color: (cell as any).c, type: (cell as any).t } : null));

// Highlight squares to telegraph "action" — last move and a legal-move dot.
const LAST_MOVE = { from: 'f3', to: 'e5' }; // visually drawn as cells (col,row)
const LEGAL_DOTS: Array<string> = ['d5', 'g5', 'e6'];

const FILES = ['a','b','c','d','e','f','g','h'];

function sqToCell(sq: string): { col: number; row: number } {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  return { col: file, row: 7 - rank };
}

export function HeroBoard({ theme = 'green', pieceSet = 'cburnett' }: { theme?: keyof typeof BOARD_THEMES; pieceSet?: string }) {
  const colors = BOARD_THEMES[theme];
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Tiny pointer-based parallax on desktop (mouse only). Adds a premium feel.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onMove(e: PointerEvent) {
      if (e.pointerType === 'touch') return;
      const rect = el!.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: cx, y: cy });
    }
    function onLeave() { setTilt({ x: 0, y: 0 }); }
    window.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const last = {
    from: sqToCell(LAST_MOVE.from),
    to: sqToCell(LAST_MOVE.to),
  };
  const dotCells = LEGAL_DOTS.map(sqToCell);

  return (
    <div
      ref={ref}
      className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
      style={{
        transform: `perspective(1600px) rotateX(${-tilt.y * 3}deg) rotateY(${tilt.x * 3}deg)`,
        transition: 'transform 180ms ease-out',
      }}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {BOARD.map((row, r) =>
          row.map((piece, c) => {
            const isLight = (r + c) % 2 === 0;
            const isLast = (r === last.from.row && c === last.from.col) || (r === last.to.row && c === last.to.col);
            const isDot = dotCells.some((d) => d.row === r && d.col === c);
            return (
              <div
                key={`${r}-${c}`}
                className="relative flex items-center justify-center"
                style={{ background: isLight ? colors.light : colors.dark }}
              >
                {isLast && (
                  <div className="absolute inset-0 pointer-events-none"
                       style={{ background: `${colors.lastMove}aa` }} />
                )}
                {isDot && !piece && (
                  <div className="absolute w-1/3 h-1/3 rounded-full bg-black/25 pointer-events-none" />
                )}
                {piece && (
                  <img
                    src={pieceUrl(pieceSet, piece.color, piece.type)}
                    alt=""
                    draggable={false}
                    className="w-full h-full pointer-events-none"
                    style={{ padding: '5%' }}
                  />
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
