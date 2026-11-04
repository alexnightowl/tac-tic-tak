'use client';

import { useMemo } from 'react';

import { useT } from '@/lib/i18n';
import type { PieceCode } from './assets';

/**
 * Screen-reader strings (apps/mobile/src/board/a11y.ts). The app still has
 * English defaults; the web reads them from core's `board.*` keys.
 */
export type BoardLabels = {
  board: string;
  white: string;
  black: string;
  pieces: Record<'P' | 'N' | 'B' | 'R' | 'Q' | 'K', string>;
  promotion: string;
  cancel: string;
};

export function useBoardLabels(): BoardLabels {
  const t = useT();
  return useMemo(
    () => ({
      board: t('board.label'),
      white: t('board.white'),
      black: t('board.black'),
      pieces: {
        P: t('board.piece.p'),
        N: t('board.piece.n'),
        B: t('board.piece.b'),
        R: t('board.piece.r'),
        Q: t('board.piece.q'),
        K: t('board.piece.k'),
      },
      promotion: t('board.promotion'),
      cancel: t('board.promotion_cancel'),
    }),
    [t],
  );
}

export function pieceName(l: BoardLabels, code: PieceCode): string {
  return `${code[0] === 'w' ? l.white : l.black} ${l.pieces[code[1] as keyof BoardLabels['pieces']]}`;
}

/** "e4, white knight" / "e4". */
export function squareLabel(l: BoardLabels, sq: string, code: PieceCode | null): string {
  return code ? `${sq}, ${pieceName(l, code)}` : sq;
}
