import type { AppPieceSet } from '@tac/core/board';

/** Piece codes in a fixed order: the index is what the UI thread stores (codes SV, drag overlay). */
export const PIECE_CODES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'] as const;
export type PieceCode = (typeof PIECE_CODES)[number];

// Static requires so Metro bundles all 24 sprites (256 px WebP, assets/pieces).
export const PIECE_IMAGES: Record<AppPieceSet, Record<PieceCode, number>> = {
  classic: {
    wP: require('../../assets/pieces/classic/wP.webp'),
    wN: require('../../assets/pieces/classic/wN.webp'),
    wB: require('../../assets/pieces/classic/wB.webp'),
    wR: require('../../assets/pieces/classic/wR.webp'),
    wQ: require('../../assets/pieces/classic/wQ.webp'),
    wK: require('../../assets/pieces/classic/wK.webp'),
    bP: require('../../assets/pieces/classic/bP.webp'),
    bN: require('../../assets/pieces/classic/bN.webp'),
    bB: require('../../assets/pieces/classic/bB.webp'),
    bR: require('../../assets/pieces/classic/bR.webp'),
    bQ: require('../../assets/pieces/classic/bQ.webp'),
    bK: require('../../assets/pieces/classic/bK.webp'),
  },
  ember: {
    wP: require('../../assets/pieces/ember/wP.webp'),
    wN: require('../../assets/pieces/ember/wN.webp'),
    wB: require('../../assets/pieces/ember/wB.webp'),
    wR: require('../../assets/pieces/ember/wR.webp'),
    wQ: require('../../assets/pieces/ember/wQ.webp'),
    wK: require('../../assets/pieces/ember/wK.webp'),
    bP: require('../../assets/pieces/ember/bP.webp'),
    bN: require('../../assets/pieces/ember/bN.webp'),
    bB: require('../../assets/pieces/ember/bB.webp'),
    bR: require('../../assets/pieces/ember/bR.webp'),
    bQ: require('../../assets/pieces/ember/bQ.webp'),
    bK: require('../../assets/pieces/ember/bK.webp'),
  },
};

/** bake-board.py output, 8×8 tiles at 2048 px; used unrotated for both orientations. */
export const BOARD_IMAGE: number = require('../../assets/board/board.webp');
