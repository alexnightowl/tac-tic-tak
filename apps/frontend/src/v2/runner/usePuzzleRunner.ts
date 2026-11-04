'use client';

import type { NextResponse } from '@tac/core/runner';
import { ANIMATION_MS } from '@tac/core/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useAppStore } from '@/lib/store';
import type { BoardHandle, BoardMove } from '@/v2/board';
import { RunnerController, type RunnerView } from './controller';
import { useDisposeOnUnmount } from './useDisposeOnUnmount';

export type PuzzleRunner = {
  controller: RunnerController;
  view: RunnerView;
  /** Stable Board ref callback. */
  boardRef: (h: BoardHandle | null) => void;
  /** Stable Board onMove: false takes the move back. */
  onMove: (m: BoardMove) => boolean;
};

/**
 * Port of apps/mobile/src/runner/usePuzzleRunner.ts. One runner per mounted
 * session screen. The controller lives as long as the screen; its callbacks
 * are stable, so the memoised Board never re-renders because the runner
 * state changed.
 */
export function usePuzzleRunner(
  sessionId: string,
  takeStash: () => NextResponse | null,
  opts: { finishOnStart?: boolean } = {},
): PuzzleRunner {
  const queryClient = useQueryClient();
  const [controller] = useState(() => {
    const settings = useAppStore.getState().settings;
    return new RunnerController({
      mode: 'session',
      sessionId,
      animMs: ANIMATION_MS[settings.animationSpeed] ?? ANIMATION_MS.normal,
      fixedColor: settings.fixedColor,
    });
  });
  const [handlers] = useState(() => ({
    boardRef: (h: BoardHandle | null) => controller.setBoard(h),
    onMove: (m: BoardMove) => controller.dispatch({ type: 'move', from: m.from, to: m.to, promotion: m.promotion }),
  }));
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);

  useEffect(() => {
    controller.setInvalidator((queryKey) => void queryClient.invalidateQueries({ queryKey }));
  }, [controller, queryClient]);

  // Boot after the Board's ref is attached (children commit first). start()
  // runs once per controller, so StrictMode's remount does not boot twice.
  useEffect(() => {
    const booted = controller.start(takeStash());
    // Home's resume card "Finish": restore from the snapshot, then save.
    if (booted && opts.finishOnStart) controller.dispatch({ type: 'finish', save: true });
    // takeStash is read once at mount by design.
  }, [controller]); // eslint-disable-line react-hooks/exhaustive-deps

  useDisposeOnUnmount(controller, () => controller.dispose());

  // The app pauses when it leaves the foreground; the web pauses when the
  // tab is hidden (timers parked, time away not counted). Coming back keeps
  // the overlay up: the player resumes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') controller.dispatch({ type: 'pause', source: 'background' });
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [controller]);

  return { controller, view, boardRef: handlers.boardRef, onMove: handlers.onMove };
}
