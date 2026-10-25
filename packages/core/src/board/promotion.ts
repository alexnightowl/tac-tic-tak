// PromotionPicker placement (Chessboard.tsx): a one-square-wide, four-tall
// column on the target file, queen always nearest the target.
import { gridPos, type Orientation } from './geometry';

export type PromotionPiece = 'q' | 'n' | 'r' | 'b';

export type PromotionPlacement = {
  left: number;
  top: number;
  width: number;
  height: number;
  /** True when the column extends down from the target. */
  downward: boolean;
  /** Top-to-bottom order of the options. */
  order: PromotionPiece[];
};

/** A pawn reaching rank 8 or 1 opens the picker (web tryMove rule). */
export function isPromotionMove(pieceType: string | null | undefined, to: string): boolean {
  'worklet';
  return pieceType === 'p' && (to[1] === '8' || to[1] === '1');
}

export function promotionPlacement(
  square: string, size: number, orientation: Orientation, mirror = false,
): PromotionPlacement {
  'worklet';
  const sq = size / 8;
  const pos = gridPos(square, orientation, mirror);
  // Usually the top edge; mirror view puts the player's last rank at the bottom.
  const downward = pos.row <= 3;
  const order: PromotionPiece[] = downward ? ['q', 'n', 'r', 'b'] : ['b', 'r', 'n', 'q'];
  return {
    left: pos.col * sq,
    top: downward ? pos.row * sq : (pos.row - 3) * sq,
    width: sq,
    height: sq * 4,
    downward,
    order,
  };
}

/** Option under a point inside the picker column, or null. */
export function promotionPick(placement: PromotionPlacement, x: number, y: number): PromotionPiece | null {
  'worklet';
  const { left, top, width, height, order } = placement;
  if (x < left || x >= left + width || y < top || y >= top + height) return null;
  return order[Math.min(3, Math.floor((y - top) / width))];
}

/** Piece image padding inside each option (web: 8%). */
export const PROMOTION_PIECE_PADDING = 0.08;
