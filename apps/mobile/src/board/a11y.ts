import type { PieceCode } from './assets';

/**
 * VoiceOver / TalkBack strings. @tac/core/i18n has no board keys yet, so the
 * board takes them as a prop with English defaults; screens pass t()-backed
 * labels once `board.*` keys exist in en + uk.
 */
export type BoardLabels = {
  white: string;
  black: string;
  pieces: Record<'P' | 'N' | 'B' | 'R' | 'Q' | 'K', string>;
  cancel: string;
};

export const DEFAULT_LABELS: BoardLabels = {
  white: 'white',
  black: 'black',
  pieces: { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' },
  cancel: 'Cancel promotion',
};

export function pieceName(l: BoardLabels, code: PieceCode): string {
  return `${code[0] === 'w' ? l.white : l.black} ${l.pieces[code[1] as keyof BoardLabels['pieces']]}`;
}

/** "e4, white knight" / "e4". */
export function squareLabel(l: BoardLabels, sq: string, code: PieceCode | null): string {
  return code ? `${sq}, ${pieceName(l, code)}` : sq;
}
