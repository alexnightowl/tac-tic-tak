// Piece sets and per-piece fit (lib/pieces.ts). The web stored the fit as
// CSS % of the square; here dx/dy are fractions of the square.

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

/** The app's own sets, the only ones offered in Settings. */
export const APP_PIECE_SETS = ['classic', 'ember'] as const;
export type AppPieceSet = typeof APP_PIECE_SETS[number];

/** Anything that isn't one of ours (legacy 'maestro', Lichess names) renders as Classic. */
export function normalizePieceSet(set: string | null | undefined): AppPieceSet {
  'worklet';
  return set === 'ember' ? 'ember' : 'classic';
}

/** Asset key, e.g. 'ember/wK' ↔ web /design/pieces/wK.png. */
export function pieceAssetKey(set: AppPieceSet, color: PieceColor, type: PieceType): string {
  'worklet';
  return `${set}/${color}${type.toUpperCase()}`;
}

export type PieceFit = { scale: number; dx: number; dy: number };

/** Scale is anchored at the base (transform-origin 50% 94%) so pieces stand on one line. */
export const PIECE_FIT_ORIGIN_Y = 0.94;

/** Ember set, tuned on the design canvas ("Game board — final"). */
export const EMBER_FIT: Record<PieceType, PieceFit> = {
  p: { scale: 1.10, dx: 0, dy: -0.03 },
  n: { scale: 1.05, dx: 0, dy: -0.02 },
  b: { scale: 1.02, dx: 0, dy: 0 },
  r: { scale: 1.05, dx: 0, dy: -0.02 },
  q: { scale: 1.05, dx: 0, dy: -0.01 },
  k: { scale: 1.05, dx: 0, dy: -0.01 },
};

/** Classic set, tuned on the design canvas ("Pieces — Classic"). */
export const CLASSIC_FIT: Record<PieceType, PieceFit> = {
  p: { scale: 1.10, dx: 0, dy: -0.01 },
  n: { scale: 1.05, dx: -0.01, dy: -0.03 },
  b: { scale: 1.05, dx: 0, dy: -0.01 },
  r: { scale: 1.10, dx: 0, dy: -0.02 },
  q: { scale: 1.08, dx: 0, dy: -0.01 },
  k: { scale: 1.04, dx: 0, dy: -0.01 },
};

export function pieceFit(set: AppPieceSet, type: PieceType): PieceFit {
  'worklet';
  return set === 'ember' ? EMBER_FIT[type] : CLASSIC_FIT[type];
}

/**
 * Fit as a centre-origin transform in px for a square of `sq`, i.e. the
 * web's `translate(dx, dy) scale(s)` about (50%, 94%) rewritten for RN's
 * default centre origin: t' = t + (origin - centre) * (1 - s). Use as
 * `transform: [{translateX}, {translateY}, {scale}]` (that order). Apply the
 * same to moving pieces (web bug: the sliding piece skipped the fit and
 * "popped" on swap).
 */
export function pieceFitTransform(set: AppPieceSet, type: PieceType, sq: number): { translateX: number; translateY: number; scale: number } {
  'worklet';
  const f = set === 'ember' ? EMBER_FIT[type] : CLASSIC_FIT[type];
  return {
    translateX: f.dx * sq,
    translateY: f.dy * sq + (0.94 - 0.5) * sq * (1 - f.scale),
    scale: f.scale,
  };
}
