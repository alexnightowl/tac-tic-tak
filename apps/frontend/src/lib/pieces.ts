/**
 * Piece asset URLs.
 *
 * `ember` is the app's own set (Ember on stone redesign), served from
 * /public/design/pieces. Every other set falls back to Lichess's CDN:
 *   https://lichess1.org/assets/piece/<set>/<pc>.svg
 */
const LICHESS_BASE = 'https://lichess1.org/assets/piece';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** The app's own sets — the only ones offered in Settings. */
export const APP_PIECE_SETS = ['classic', 'ember'] as const;
export type AppPieceSet = typeof APP_PIECE_SETS[number];

/** Classic is the default. Older accounts may still carry a Lichess set
 *  name from before the redesign (DB default 'maestro') — anything that
 *  isn't one of ours renders as Classic; an explicit 'ember' stays Ember. */
export function normalizePieceSet(set: string | null | undefined): AppPieceSet {
  return (APP_PIECE_SETS as readonly string[]).includes(set ?? '') ? (set as AppPieceSet) : 'classic';
}

export function pieceUrl(set: string, color: 'w' | 'b', type: PieceType) {
  const pc = `${color}${type.toUpperCase()}`;
  if (set === 'ember') return `/design/pieces/${pc}.png`;
  if (set === 'classic') return `/design/pieces-classic/${pc}.png`;
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

/** Classic set fit, tuned on the design canvas ("Pieces — Classic" tweaks). */
export const CLASSIC_FIT: Record<PieceType, { scale: number; y: number; x?: number }> = {
  p: { scale: 1.10, y: -1 },
  n: { scale: 1.05, y: -3, x: -1 },
  b: { scale: 1.05, y: -1 },
  r: { scale: 1.10, y: -2 },
  q: { scale: 1.08, y: -1 },
  k: { scale: 1.04, y: -1 },
};

export function pieceTransform(set: string, type: PieceType): string | undefined {
  const fit = set === 'ember' ? EMBER_FIT : set === 'classic' ? CLASSIC_FIT : null;
  if (!fit) return undefined;
  const f = fit[type] as { scale: number; y: number; x?: number };
  if (f.x) return `translate(${f.x}%, ${f.y}%) scale(${f.scale})`;
  return `translateY(${f.y}%) scale(${f.scale})`;
}
