/**
 * Piece asset URLs.
 *
 * Uses Lichess's stable CDN paths for all sets:
 *   https://lichess1.org/assets/piece/<set>/<pc>.svg
 * where <pc> is e.g. "wK" (white King) or "bN" (black kNight).
 */
const LICHESS_BASE = 'https://lichess1.org/assets/piece';

export function pieceUrl(set: string, color: 'w' | 'b', type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k') {
  const pc = `${color}${type.toUpperCase()}`;
  return `${LICHESS_BASE}/${set}/${pc}.svg`;
}
