'use client';

import { normalizePieceSet } from '@tac/core/board';
import { transitions } from '@tac/core/tokens';
import { useEffect, useRef, type ReactNode } from 'react';

import { useAppStore } from '@/lib/store';
import { Board, type BoardHandle, type BoardMove } from '@/v2/board';
import { bezier } from '@/v2/board/constants';
import { prefersReducedMotion } from '@/v2/motion';
import { Spinner } from '@/v2/ui';
import type { PracticeController } from './PracticeController';
import './runner.css';

/**
 * Port of apps/mobile/src/features/review/practice/PracticeBoard.tsx: the
 * practice board slot. The memoised Board (stable props only), the in-place
 * cross-fade between puzzles (the controller drives it through its fader),
 * a spinner while nothing is loaded, and an optional overlay.
 */
export function PracticeBoard({
  controller,
  boardRef,
  onMove,
  loading,
  overlay,
}: {
  controller: PracticeController;
  boardRef: (h: BoardHandle | null) => void;
  onMove: (m: BoardMove) => boolean;
  loading: boolean;
  overlay?: ReactNode;
}) {
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const mirror = useAppStore((s) => s.settings.mirrorView);
  const knightArrow = useAppStore((s) => s.settings.knightArrow);
  const fade = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current: Animation | null = null;
    controller.setFader((to, done) => {
      const el = fade.current;
      if (!el) {
        if (done) setTimeout(done, 0);
        return;
      }
      const from = getComputedStyle(el).opacity;
      current?.cancel();
      el.style.opacity = String(to);
      const t = transitions.colors;
      const a = el.animate([{ opacity: from }, { opacity: to }], {
        duration: prefersReducedMotion() ? 0 : t.duration,
        easing: bezier(t.easing),
      });
      current = a;
      // Fires on interruption too: the swap must never stall.
      const end = () => done?.();
      a.onfinish = end;
      a.oncancel = end;
    });
    return () => controller.setFader(null);
  }, [controller]);

  return (
    <div className="v2r-practice-board">
      <div ref={fade} className="v2r-practice-fade">
        <Board ref={boardRef} onMove={onMove} moveFeel="caller" pieceSet={pieceSet} mirror={mirror} knightArrow={knightArrow} />
      </div>
      {overlay}
      {loading && (
        <div className="v2r-practice-spinner">
          <Spinner size={32} color="var(--eos-ember)" />
        </div>
      )}
    </div>
  );
}
