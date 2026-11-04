'use client';

// Board layers React renders: coordinates, the 64 square cells (a11y, legal
// dots / capture rings), arrows. They re-render only when the geometry, the
// position (labels) or the arrows change; the engine drives everything that
// moves.
import {
  arrowGeometry, coordLabels, gridPos, isLightSquare, squareName,
  type KnightArrowMode, type Orientation, type Square,
} from '@tac/core/board';
import { BOARD_COORD_SCALE } from '@tac/core/tokens';
import { memo, type KeyboardEvent } from 'react';

import type { ArrowSpec } from './engine';

type Geo = { orientation: Orientation; mirror: boolean };

export const SQUARES: Square[] = Array.from({ length: 64 }, (_, i) => squareName(i));

/** One-square box at `sq`, in % of itself. */
export const at = (sq: string, o: Orientation, m: boolean) => {
  const { col, row } = gridPos(sq, o, m);
  return `translate(${col * 100}%,${row * 100}%)`;
};

// ─── Coordinates (sq × BOARD_COORD_SCALE, opposite square colour) ────────

function CoordinatesImpl({ orientation, mirror }: Geo) {
  const out: React.ReactNode[] = [];
  for (const sq of SQUARES) {
    const { rank, file } = coordLabels(sq, orientation, mirror);
    if (!rank && !file) continue;
    const tone = isLightSquare(sq) ? 'light' : 'dark';
    out.push(
      <div key={sq} className="v2b-coord" data-tone={tone} style={{ transform: at(sq, orientation, mirror) }}>
        {rank && <span className="v2b-coord-rank">{rank}</span>}
        {file && <span className="v2b-coord-file">{file}</span>}
      </div>,
    );
  }
  // Hidden from screen readers: each square's label already names it.
  return (
    <div className="v2b-layer v2b-coords" aria-hidden style={{ fontSize: `max(8px, calc(var(--v2b-sq) * ${BOARD_COORD_SCALE}))` }}>
      {out}
    </div>
  );
}

export const Coordinates = memo(CoordinatesImpl);

// ─── Squares: a11y + test ids + legal dot / capture ring ─────────────────

type SquareProps = Geo & {
  sq: Square;
  idx: number;
  label: string;
  focusable: boolean;
  cellRef: (idx: number, el: HTMLDivElement | null) => void;
};

function SquareCellImpl({ sq, idx, label, orientation, mirror, focusable, cellRef }: SquareProps) {
  return (
    <div
      ref={(el) => cellRef(idx, el)}
      role="button"
      aria-label={label}
      tabIndex={focusable ? 0 : -1}
      data-testid={`sq-${sq}`}
      data-sq={idx}
      className="v2b-sq"
      style={{ transform: at(sq, orientation, mirror) }}
    >
      <span className="v2b-dot" />
      <span className="v2b-ring" />
    </div>
  );
}

/** memo: only squares whose label (or focus) changed re-render on a commit. */
export const SquareCell = memo(SquareCellImpl);

/** Arrow keys move the focus square in screen space; Enter / Space taps it. */
export function squareKey(e: KeyboardEvent, idx: number, geo: Geo): number | 'tap' | null {
  if (e.key === 'Enter' || e.key === ' ') return 'tap';
  const d: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const step = d[e.key];
  if (!step) return null;
  const { col, row } = gridPos(squareName(idx), geo.orientation, geo.mirror);
  const c = Math.min(7, Math.max(0, col + step[0]));
  const r = Math.min(7, Math.max(0, row + step[1]));
  for (let i = 0; i < 64; i++) {
    const p = gridPos(squareName(i), geo.orientation, geo.mirror);
    if (p.col === c && p.row === r) return i;
  }
  return null;
}

// ─── Arrows (hint / solution) ────────────────────────────────────────────

/** Drawn in a fixed 800 user-unit box that scales with the board. */
const VIEW = 800;

function ArrowsImpl({ arrows, orientation, mirror, knightArrow }: Geo & { arrows: readonly ArrowSpec[]; knightArrow: KnightArrowMode }) {
  if (arrows.length === 0) return null;
  return (
    <svg className="v2b-layer v2b-arrows" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden data-testid="board-arrows">
      {arrows.map((a, i) => {
        const g = arrowGeometry(a.from, a.to, VIEW, orientation, mirror, knightArrow);
        return (
          <g key={`${a.from}${a.to}${i}`}>
            <path d={g.shaftPath} strokeWidth={g.strokeWidth} strokeLinejoin="round" strokeLinecap="butt" fill="none" className="v2b-arrow-shaft" />
            <path d={g.headPath} className="v2b-arrow-head" />
          </g>
        );
      })}
    </svg>
  );
}

export const Arrows = memo(ArrowsImpl);
