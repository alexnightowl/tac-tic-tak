/**
 * Piece asset URLs.
 *
 * `ember` is the app's own set (Ember on stone redesign), served from
 * /public/design/pieces. Every other set falls back to Lichess's CDN:
 *   https://lichess1.org/assets/piece/<set>/<pc>.svg
 */
const LICHESS_BASE = 'https://lichess1.org/assets/piece';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export function pieceUrl(set: string, color: 'w' | 'b', type: PieceType) {
  const pc = `${color}${type.toUpperCase()}`;
  if (set === 'ember') return `/design/pieces/${pc}.png`;
  return `${LICHESS_BASE}/${set}/${pc}.svg`;
}

/**
 * Per-piece fit for the Ember set, tuned on the design canvas
 * ("Game board — final" tweaks): scale in %, vertical offset in % of
 * the square. Scaling is anchored at the base (transform-origin 50% 94%)
 * so pieces grow upward and stand on the same line.
 */
export const EMBER_FIT: Record<PieceType, { scale: number; y: number }> = {
  p: { scale: 1.10, y: -3 },
  n: { scale: 1.05, y: -2 },
  b: { scale: 1.02, y: 0 },
  r: { scale: 1.05, y: -2 },
  q: { scale: 1.05, y: -1 },
  k: { scale: 1.05, y: -1 },
};

export function pieceTransform(set: string, type: PieceType): string | undefined {
  if (set !== 'ember') return undefined;
  const f = EMBER_FIT[type];
  return `translateY(${f.y}%) scale(${f.scale})`;
}
