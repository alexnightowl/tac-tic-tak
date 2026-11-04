import type { AppPieceSet } from '@tac/core/board';

/** Piece codes in a fixed order: the index is what the input layer stores (codes, drag overlay). */
export const PIECE_CODES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'] as const;
export type PieceCode = (typeof PIECE_CODES)[number];

/** The app's 256 px WebP sprites, copied to public/v2/pieces by scripts/sync-assets.mjs. */
export function pieceSrc(set: AppPieceSet, code: PieceCode): string {
  return `/v2/pieces/${set}/${code}.webp`;
}

/** bake-board.py output: 8×8 tiles at 2048 px, used unrotated for both orientations (a1 and h8 are both dark). */
export const BOARD_IMAGE = '/v2/board/board.webp';

const preloaded = new Set<AppPieceSet>();

/** Warms the browser cache with a set's 12 sprites, so the first drag / promotion never waits on a fetch. */
export function preloadPieceSet(set: AppPieceSet): void {
  if (typeof window === 'undefined' || preloaded.has(set)) return;
  preloaded.add(set);
  for (const code of PIECE_CODES) {
    const img = new Image();
    img.decoding = 'async';
    img.src = pieceSrc(set, code);
  }
}
