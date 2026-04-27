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
  const sq = size / 8;
  const stroke = 'rgba(255,170,0,0.85)';
  // Tuned to feel close to Lichess: a thin shaft and a head about a
  // third of a square. `userSpaceOnUse` keeps the head a fixed pixel
  // size regardless of stroke width.
  const width = sq * 0.13;
  const headSize = sq * 0.34;

  return (
    <svg className="absolute inset-0 pointer-events-none" width={size} height={size}>
      <defs>
        <marker
          id="ah"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth={headSize}
          markerHeight={headSize}
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
        </marker>
      </defs>
      {all.map((a, i) => {
        const from = sqCenter(a.from, size, orientation);
        const to = sqCenter(a.to, size, orientation);
        if (isKnightHop(a.from, a.to)) {
          // L-shape: travel along the LONG leg first (the 2-square axis),
          // then turn for the short leg. Picking the short axis first
          // (like the previous build did) reads as a wrong move.
          const fx = a.from.charCodeAt(0) - 97;
          const fy = Number(a.from[1]) - 1;
          const tx = a.to.charCodeAt(0) - 97;
          const ty = Number(a.to[1]) - 1;
          const longIsHorizontal = Math.abs(tx - fx) > Math.abs(ty - fy);
          const mid = longIsHorizontal
            ? { x: to.x, y: from.y }
            : { x: from.x, y: to.y };
          return (
            <path
              key={i}
              d={`M ${from.x} ${from.y} L ${mid.x} ${mid.y} L ${to.x} ${to.y}`}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#ah)"
            />
          );
        }
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={stroke}
            strokeWidth={width}
            strokeLinecap="round"
            markerEnd="url(#ah)"
          />
        );
      })}
    </svg>
  );
}
