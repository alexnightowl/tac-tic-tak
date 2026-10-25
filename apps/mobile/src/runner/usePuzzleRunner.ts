import { ANIMATION_MS } from '@tac/core/tokens';
import type { NextResponse } from '@tac/core/runner';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { BoardHandle, BoardMove } from '@/board';
import { appStore } from '@/stores/appStore';
import { RunnerController, type RunnerView } from './controller';

export { RunnerController, SNAPSHOT_KEY, readSnapshot, type RunnerView } from './controller';

export type PuzzleRunner = {
  controller: RunnerController;
  view: RunnerView;
  /** Stable Board ref callback. */
  boardRef: (h: BoardHandle | null) => void;
  /** Stable Board onMove: false takes the move back. */
  onMove: (m: BoardMove) => boolean;
};

/**
 * One runner per mounted session screen. The controller lives as long as
 * the screen; its callbacks are stable, so the memoised Board never
 * re-renders because the runner state changed.
 */
export function usePuzzleRunner(sessionId: string, takeStash: () => NextResponse | null): PuzzleRunner {
  const [controller] = useState(() => {
    const settings = appStore.getState().settings;
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
  const view = useSyncExternalStore(controller.subscribe, controller.getView);

  // Boot after the Board's ref is attached (children commit first).
  useEffect(() => {
    controller.start(takeStash());
    return () => controller.dispose();
    // takeStash is read once at mount by design.
  }, [controller]); // eslint-disable-line react-hooks/exhaustive-deps

  // PLAN §2.10: leaving the app pauses the session (timers parked, time
  // away not counted). Coming back keeps the overlay up: the player resumes.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') controller.dispatch({ type: 'pause', source: 'background' });
    });
    return () => sub.remove();
  }, [controller]);

  return { controller, view, boardRef: handlers.boardRef, onMove: handlers.onMove };
}
