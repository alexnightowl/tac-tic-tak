'use client';

import { Square } from 'chess.js';

type Props = {
  size: number;
  orientation: 'white' | 'black';
  arrows: Array<{ from: Square; to: Square }>;
  pending?: { from: Square; to: Square } | null;
};

function sqCenter(s: Square, size: number, orientation: 'white' | 'black') {
  const file = s.charCodeAt(0) - 97;
  const rank = Number(s[1]) - 1;
  const sq = size / 8;
  const colIdx = orientation === 'white' ? file : 7 - file;
  const rowIdx = orientation === 'white' ? 7 - rank : rank;
  return { x: colIdx * sq + sq / 2, y: rowIdx * sq + sq / 2 };
}

function isKnightHop(from: Square, to: Square) {
  const fx = from.charCodeAt(0) - 97, fy = Number(from[1]) - 1;
  const tx = to.charCodeAt(0) - 97, ty = Number(to[1]) - 1;
  const dx = Math.abs(tx - fx), dy = Math.abs(ty - fy);
  return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
}

export function Arrows({ size, orientation, arrows, pending }: Props) {
  if (size === 0) return null;
  const all = [...arrows, ...(pending ? [pending] : [])];
  const stroke = 'rgba(255,170,0,0.85)';
  const width = size / 8 * 0.2;

  return (
    <svg className="absolute inset-0 pointer-events-none" width={size} height={size}>
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
        </marker>
      </defs>
      {all.map((a, i) => {
        const from = sqCenter(a.from, size, orientation);
        const to = sqCenter(a.to, size, orientation);
        if (isKnightHop(a.from, a.to)) {
          // Bent (L-shaped) arrow: go vertically first, then horizontally.
          const mid = { x: from.x, y: to.y };
          return (
            <g key={i}>
              <path d={`M ${from.x} ${from.y} L ${mid.x} ${mid.y} L ${to.x} ${to.y}`}
                    fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#ah)" />
            </g>
          );
        }
        return (
          <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={stroke} strokeWidth={width} strokeLinecap="round" markerEnd="url(#ah)" />
        );
      })}
    </svg>
  );
}
