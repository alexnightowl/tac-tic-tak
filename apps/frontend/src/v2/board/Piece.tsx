'use client';

import { pieceFitTransform, type AppPieceSet, type PieceType, type Square } from '@tac/core/board';
import { memo, useLayoutEffect, useRef } from 'react';

import { pieceSrc, type PieceCode } from './assets';
import type { BoardEngine } from './engine';

/** The canvas fit (scale about the base, small nudges) as a CSS transform, in % of the square. */
export function fitTransform(set: AppPieceSet, code: PieceCode): string {
  const f = pieceFitTransform(set, code[1].toLowerCase() as PieceType, 100);
  return `translate(${f.translateX}%,${f.translateY}%) scale(${f.scale})`;
}

/** A piece sprite with the set's fit, filling its one-square box. */
export function Sprite({ set, code, hidden }: { set: AppPieceSet; code: PieceCode; hidden?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size sprites, preloaded; next/image adds nothing here
    <img
      className="v2b-sprite"
      src={pieceSrc(set, code)}
      alt=""
      draggable={false}
      hidden={hidden}
      style={{ transform: fitTransform(set, code) }}
    />
  );
}

type Props = {
  id: number;
  code: PieceCode;
  /** Square as React last saw it: the test id, and the mount-time placement. */
  sq: Square;
  /** Captured (React side): drops the test id. The fade itself runs in the engine. */
  dying: boolean;
  set: AppPieceSet;
  engine: BoardEngine;
};

/**
 * One piece element. After mount, its position, fade and stacking belong to
 * the engine (transforms and animations), so a move starts sliding without
 * a React commit and the later reconcile (new test id) never moves it.
 */
function PieceImpl({ id, code, sq, dying, set, engine }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Mount-time placement only: sq / dying are read once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => engine.mountPiece(id, ref.current!, code, sq, dying), [engine, id]);
  useLayoutEffect(() => engine.pieceCode(id, code), [engine, id, code]);
  return (
    <div ref={ref} className="v2b-piece" data-testid={dying ? undefined : `piece-${sq}-${code}`}>
      <Sprite set={set} code={code} />
    </div>
  );
}

/** memo: a reconcile re-renders only the pieces whose square / code / fate changed. */
export const Piece = memo(PieceImpl);
