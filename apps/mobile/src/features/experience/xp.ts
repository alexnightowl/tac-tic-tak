import { localeFor } from '@tac/core/format';
import { XP_RANKS, type XpRankKey } from '@tac/core/rules';

import { PIECE_IMAGES, type PieceCode } from '@/board/assets';

// Experience ranks drawn as the white Ember pieces (design PlayV2Experience).
const RANK_PIECE: Record<XpRankKey, PieceCode> = {
  pawn: 'wP',
  knight: 'wN',
  bishop: 'wB',
  rook: 'wR',
  queen: 'wQ',
  king: 'wK',
};

export function rankPiece(rank: XpRankKey): number {
  return PIECE_IMAGES.ember[RANK_PIECE[rank]];
}

/** 4,820 / 4 820 by the app language. */
export function fmtXp(n: number, language: string): string {
  return Math.round(n).toLocaleString(localeFor(language));
}

/** Hours of training a stretch of XP stands for (2 XP a minute). */
export function xpHours(xp: number): number {
  return Math.max(1, Math.round(xp / 120));
}

export { XP_RANKS };
