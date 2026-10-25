import type { PracticeMode, PracticeState } from '@tac/core/runner';
import { ANIMATION_MS } from '@tac/core/tokens';
import { useEffect, useState, useSyncExternalStore } from 'react';

import type { BoardHandle, BoardMove } from '@/board';
import { appStore, useAppStore } from '@/stores/appStore';
import { PracticeController, type PracticeHooks } from './PracticeController';

export type Practice = {
  controller: PracticeController;
  state: PracticeState;
  /** Stable Board onMove: false takes the move back. */
  onMove: (m: BoardMove) => boolean;
  /** Stable Board ref callback. */
  boardRef: (h: BoardHandle | null) => void;
};

/**
 * One practice runner per mounted screen. Settings are read once at mount
 * (like the session runner) and re-sent on change, applying from the next
 * slide; the controller's callbacks are stable, so the memoised Board
 * never re-renders from runner state.
 */
export function usePractice(mode: PracticeMode, hooks: PracticeHooks = {}): Practice {
  const [controller] = useState(() => {
    const st = appStore.getState().settings;
    return new PracticeController(
      { mode, animMs: ANIMATION_MS[st.animationSpeed] ?? ANIMATION_MS.normal, fixedColor: st.fixedColor },
      hooks,
    );
  });
  const [onMove] = useState(() => (m: BoardMove) => controller.dispatch({ type: 'move', from: m.from, to: m.to, promotion: m.promotion }));
  const [boardRef] = useState(() => (h: BoardHandle | null) => controller.setBoard(h));
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const animationSpeed = useAppStore((s) => s.settings.animationSpeed);
  const fixedColor = useAppStore((s) => s.settings.fixedColor);

  useEffect(() => {
    controller.dispatch({ type: 'configure', animMs: ANIMATION_MS[animationSpeed] ?? ANIMATION_MS.normal, fixedColor });
  }, [controller, animationSpeed, fixedColor]);

  useEffect(() => () => controller.dispose(), [controller]);

  return { controller, state, onMove, boardRef };
}
