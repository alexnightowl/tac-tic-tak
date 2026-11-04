'use client';

import { promotionPlacement, PROMOTION_PIECE_PADDING, type AppPieceSet, type Orientation, type PromotionPiece } from '@tac/core/board';
import { useEffect, useRef } from 'react';

import { pieceName, type BoardLabels } from './a11y';
import { pieceSrc, type PieceCode } from './assets';
import { PROMOTION_FADE_MS } from './constants';
import type { PromoRequest } from './engine';

/** In % of the board: the placement is computed for a 100-unit board. */
const UNIT = 100;

/**
 * The web PromotionPicker, as on the app: a one-square column on the target
 * file, queen nearest the target, over a dimmed backdrop that cancels. It
 * sits outside the board's pointer layer, so the press that opened it
 * cannot pick an option.
 */
export function PromotionPicker({
  req,
  orientation,
  mirror,
  set,
  labels,
  reduced,
  onPick,
}: {
  req: PromoRequest;
  orientation: Orientation;
  mirror: boolean;
  set: AppPieceSet;
  labels: BoardLabels;
  reduced: boolean;
  onPick: (piece: PromotionPiece | null) => void;
}) {
  const place = promotionPlacement(req.to, UNIT, orientation, mirror);
  const column = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = column.current;
    if (!el) return;
    // Keyboard play (a square had focus): the choice takes it over.
    if (document.activeElement?.closest('.v2b-board')) el.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    if (!reduced) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: PROMOTION_FADE_MS });
  }, [reduced]);

  return (
    <div
      className="v2b-promo"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onPick(null);
      }}
    >
      <button
        type="button"
        className="v2b-promo-backdrop"
        aria-label={labels.cancel}
        data-testid="promo-cancel"
        onClick={() => onPick(null)}
      />
      <div
        ref={column}
        role="group"
        aria-label={labels.promotion}
        className="v2b-promo-column"
        style={{ left: `${place.left}%`, top: `${place.top}%`, width: `${place.width}%`, height: `${place.height}%` }}
      >
        {place.order.map((p) => {
          const code = `${req.color}${p.toUpperCase()}` as PieceCode;
          return (
            <button
              key={p}
              type="button"
              className="v2b-promo-option"
              data-testid={`promo-${p}`}
              aria-label={pieceName(labels, code)}
              onClick={() => onPick(p)}
              style={{ padding: `${PROMOTION_PIECE_PADDING * 100}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- preloaded sprite */}
              <img src={pieceSrc(set, code)} alt="" draggable={false} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
