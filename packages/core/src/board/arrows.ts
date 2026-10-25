// Arrow geometry ported from components/board/Arrows.tsx. The web drew the
// head with an SVG <marker> (base at the shaft end, tip on the target
// centre); react-native-svg markers are unreliable, so the head is an
// explicit triangle here with the same proportions.
import { isKnightHop, squareCenter, type Orientation, type Point } from './geometry';

export type KnightArrowMode = 'bent' | 'straight';

/** Proportions of the square (Arrows.tsx). */
export const ARROW = {
  width: 0.18,
  headLen: 0.34,
  headWid: 0.58,
} as const;

export type ArrowGeometry = {
  /** Shaft polyline: from centre, optional knee, end pulled back by headLen. */
  shaft: Point[];
  /** Head triangle: tip (target centre), then the two base corners. */
  head: [Point, Point, Point];
  /** react-native-svg path strings (stroke the shaft, fill the head). */
  shaftPath: string;
  headPath: string;
  strokeWidth: number;
  bent: boolean;
};

export function arrowGeometry(
  from: string, to: string, size: number, orientation: Orientation,
  mirror = false, knightArrow: KnightArrowMode = 'bent',
): ArrowGeometry {
  'worklet';
  const sq = size / 8;
  const width = sq * ARROW.width;
  const headLen = sq * ARROW.headLen;
  const headWid = sq * ARROW.headWid;
  const a = squareCenter(from, size, orientation, mirror);
  const b = squareCenter(to, size, orientation, mirror);

  let knee: Point | null = null;
  if (knightArrow === 'bent' && isKnightHop(from, to)) {
    // L-shape: travel the LONG leg (the 2-square axis) first, then turn.
    const longIsHorizontal =
      Math.abs((to.charCodeAt(0) - 97) - (from.charCodeAt(0) - 97)) >
      Math.abs((to.charCodeAt(1) - 49) - (from.charCodeAt(1) - 49));
    knee = longIsHorizontal ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  }

  // Pull the last segment back by headLen so the head tip lands on `to`.
  const s = knee ?? a;
  const dx = b.x - s.x;
  const dy = b.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const end = { x: b.x - ux * headLen, y: b.y - uy * headLen };
  const half = headWid / 2;
  const left = { x: end.x - uy * half, y: end.y + ux * half };
  const right = { x: end.x + uy * half, y: end.y - ux * half };

  const shaft = knee ? [a, knee, end] : [a, end];
  let shaftPath = `M ${a.x} ${a.y}`;
  for (let i = 1; i < shaft.length; i++) shaftPath += ` L ${shaft[i].x} ${shaft[i].y}`;
  const headPath = `M ${b.x} ${b.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;

  return { shaft, head: [b, left, right], shaftPath, headPath, strokeWidth: width, bent: knee !== null };
}
