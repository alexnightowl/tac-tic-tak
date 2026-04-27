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
  const stroke = 'rgba(255,170,0,0.55)';
  // Lichess-style arrow: thin shaft, butt-end at the source, and a
  // stout head wider than it is long. Two tricks make this clean:
  //   1. preserveAspectRatio="none" so markerWidth/Height can render
  //      as a wide-and-short rectangle instead of a forced square.
  //   2. refX=0 anchors the marker's BASE at the line endpoint, so we
  //      shorten the line by headLen so the marker tip lands exactly
  //      on the destination square's centre. Without this the shaft
  //      pokes through near the apex (where the triangle tapers below
  //      the shaft width) and produces visible notches.
  const width = sq * 0.18;
  const headLen = sq * 0.34;
  const headWid = sq * 0.58;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
      width={size}
      height={size}
    >
      <defs>
        <marker
          id="ah"
          viewBox="0 0 10 10"
          refX="0"
          refY="5"
          markerWidth={headLen}
          markerHeight={headWid}
          markerUnits="userSpaceOnUse"
          preserveAspectRatio="none"
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
          // then turn for the short leg.
          const fx = a.from.charCodeAt(0) - 97;
          const fy = Number(a.from[1]) - 1;
          const tx = a.to.charCodeAt(0) - 97;
          const ty = Number(a.to[1]) - 1;
          const longIsHorizontal = Math.abs(tx - fx) > Math.abs(ty - fy);
          const mid = longIsHorizontal
            ? { x: to.x, y: from.y }
            : { x: from.x, y: to.y };
          // Pull last-segment endpoint back by headLen along that
          // segment's direction so the marker tip lands at `to`.
          const sdx = to.x - mid.x;
          const sdy = to.y - mid.y;
          const slen = Math.hypot(sdx, sdy) || 1;
          const ex = to.x - (sdx / slen) * headLen;
          const ey = to.y - (sdy / slen) * headLen;
          return (
            <path
              key={i}
              d={`M ${from.x} ${from.y} L ${mid.x} ${mid.y} L ${ex} ${ey}`}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="butt"
              strokeLinejoin="round"
              markerEnd="url(#ah)"
            />
          );
        }
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const ex = to.x - (dx / len) * headLen;
        const ey = to.y - (dy / len) * headLen;
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={ex}
            y2={ey}
            stroke={stroke}
            strokeWidth={width}
            strokeLinecap="butt"
            markerEnd="url(#ah)"
          />
        );
      })}
    </svg>
  );
}
