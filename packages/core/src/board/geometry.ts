// Board coordinate math (Chessboard.tsx sqName / gridPos / pointToSquare,
// Arrows.tsx sqCenter). Every function is a Reanimated worklet so the same
// code hit-tests on the UI thread and lays out on JS. No outer captures
// except other worklets.

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
/** Same shape as chess.js `Square`. */
export type Square = `${File}${Rank}`;
export type Orientation = 'white' | 'black';

export type Point = { x: number; y: number };
export type GridPos = { col: number; row: number };

/** a1 = 0, h1 = 7, a8 = 56, h8 = 63. */
export function squareIndex(sq: string): number {
  'worklet';
  return (sq.charCodeAt(0) - 97) + (sq.charCodeAt(1) - 49) * 8;
}

export function squareName(index: number): Square {
  'worklet';
  return (String.fromCharCode(97 + (index & 7)) + String.fromCharCode(49 + (index >> 3))) as Square;
}

/** Chessboard sqName(file, rank), both 0-based. */
export function sqName(file: number, rank: number): Square {
  'worklet';
  return (String.fromCharCode(97 + file) + String.fromCharCode(49 + rank)) as Square;
}

export function isSquare(s: string): s is Square {
  'worklet';
  if (s.length !== 2) return false;
  const f = s.charCodeAt(0) - 97;
  const r = s.charCodeAt(1) - 49;
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

/**
 * True when the board is drawn with rank 1 at the top (black's view).
 * Mirror view flips whatever orientation the parent picked (web: the
 * pages swapped orientation when settings.mirrorView was on).
 */
export function isFlipped(orientation: Orientation, mirror = false): boolean {
  'worklet';
  return (orientation === 'black') !== mirror;
}

/** Visual column/row (0..7, row 0 at the top) of a square. */
export function gridPos(sq: string, orientation: Orientation, mirror = false): GridPos {
  'worklet';
  const file = sq.charCodeAt(0) - 97;
  const rank = sq.charCodeAt(1) - 49;
  const flip = (orientation === 'black') !== mirror;
  return { col: flip ? 7 - file : file, row: flip ? rank : 7 - rank };
}

/** Square at a visual column/row. */
export function squareAt(col: number, row: number, orientation: Orientation, mirror = false): Square {
  'worklet';
  const flip = (orientation === 'black') !== mirror;
  const file = flip ? 7 - col : col;
  const rank = flip ? row : 7 - row;
  return (String.fromCharCode(97 + file) + String.fromCharCode(49 + rank)) as Square;
}

/** Top-left corner of a square, in the board's local px. */
export function squareToXY(sq: string, size: number, orientation: Orientation, mirror = false): Point {
  'worklet';
  const s = size / 8;
  const file = sq.charCodeAt(0) - 97;
  const rank = sq.charCodeAt(1) - 49;
  const flip = (orientation === 'black') !== mirror;
  return { x: (flip ? 7 - file : file) * s, y: (flip ? rank : 7 - rank) * s };
}

/** Centre of a square (Arrows sqCenter). */
export function squareCenter(sq: string, size: number, orientation: Orientation, mirror = false): Point {
  'worklet';
  const s = size / 8;
  const p = squareToXY(sq, size, orientation, mirror);
  return { x: p.x + s / 2, y: p.y + s / 2 };
}

/** Hit test (pointToSquare): local px → square, or null outside [0, size). */
export function xyToSquare(x: number, y: number, size: number, orientation: Orientation, mirror = false): Square | null {
  'worklet';
  if (!size || x < 0 || y < 0 || x >= size || y >= size) return null;
  const s = size / 8;
  // min() guards float drift right at the far edge
  const col = Math.min(7, Math.floor(x / s));
  const row = Math.min(7, Math.floor(y / s));
  return squareAt(col, row, orientation, mirror);
}

/** a1 is dark: light when (file + rank) is odd. */
export function isLightSquare(sq: string): boolean {
  'worklet';
  return ((sq.charCodeAt(0) - 97) + (sq.charCodeAt(1) - 49)) % 2 === 1;
}

/**
 * Coordinate labels a square carries: the rank number on the left visible
 * file, the file letter on the bottom visible rank.
 */
export function coordLabels(sq: string, orientation: Orientation, mirror = false): { rank: string | null; file: string | null } {
  'worklet';
  const p = gridPos(sq, orientation, mirror);
  return { rank: p.col === 0 ? sq[1] : null, file: p.row === 7 ? sq[0] : null };
}

/**
 * Board edge in px: floor(min(w, h) / 8 / px) * 8 * px, so every square is
 * a whole number of device pixels (PLAN §2.6). `px` is 1 / PixelRatio.
 */
export function boardSize(width: number, height: number, px: number): number {
  'worklet';
  return Math.floor(Math.min(width, height) / 8 / px) * 8 * px;
}

/** A knight hop (1,2) or (2,1). */
export function isKnightHop(from: string, to: string): boolean {
  'worklet';
  const dx = Math.abs((to.charCodeAt(0) - 97) - (from.charCodeAt(0) - 97));
  const dy = Math.abs((to.charCodeAt(1) - 49) - (from.charCodeAt(1) - 49));
  return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
}
