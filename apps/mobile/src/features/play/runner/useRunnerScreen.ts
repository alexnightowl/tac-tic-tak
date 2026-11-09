import { normalizePieceSet } from '@tac/core/board';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, usePreventRemove, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { readPlanRecord, startPlanSession } from '@/features/plan/model';
import { usePlanSession } from '@/features/plan/usePlanSession';
import { usePuzzleRunner } from '@/runner';
import { useAppStore } from '@/stores/appStore';
import { blindRevealMs } from '../blind/director';
import { takeFirstPuzzle } from '../pendingPuzzle';
import { readLastSetup, repeatStartRating } from '../setupPrefs';
import { startSession } from '../startSession';

const HOME = '/' as Href;
const SETUP = '/play' as Href;
const KEEP_AWAKE_TAG = 'runner';

/**
 * The /play/[id] screen's logic, shared by the phone RunnerScreen and the
 * desktop web layout (src/desktop/board): the runner, the store's live
 * rating, the exit guard, keep-awake and "play again".
 */
export function useRunnerScreen(sessionId: string, finishOnStart: boolean) {
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const mirror = useAppStore((s) => s.settings.mirrorView);
  const { controller, view, boardRef, onMove } = usePuzzleRunner(sessionId, () => takeFirstPuzzle(sessionId), {
    finishOnStart,
    revealMs: blindRevealMs(sessionId),
  });
  const s = view.state;
  const runnerStyle = s.style;
  // web RatingPill: the store's live rating (patched after every attempt).
  const storeRating = useAppStore((st) => (runnerStyle ? st.progressions[runnerStyle].currentPuzzleRating : null));
  const storeProg = useAppStore((st) => (runnerStyle ? st.progressions[runnerStyle] : null));
  const [againLoading, setAgainLoading] = useState(false);
  // D40: a daily-plan session (label, per-theme results); null otherwise.
  const plan = usePlanSession(sessionId, controller);
  const result = s.result;
  const running = s.phase !== 'summary';

  // Back gesture / hardware back go into the exit flow while the session
  // runs (iOS: react-native-screens cancels the swipe natively).
  const disablePrevention = usePreventRemove(running, () => {
    if (controller.view.exitOpen) controller.closeExit();
    else controller.dispatch({ type: 'requestExit' });
  });

  // Discard (or 0-attempt exit): leave for Home without tripping the guard.
  useEffect(() => {
    return controller.setOnExit(() => {
      disablePrevention();
      router.dismissTo(HOME);
    });
  }, [controller, disablePrevention]);

  useEffect(() => {
    if (!running) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [running]);

  // "Play again with the same settings": the last setup straight into a
  // new session (the web went back to /play); on failure, the setup.
  const playAgain = async () => {
    // D40: a plan session repeats today's plan (same themes and length).
    const rec = readPlanRecord(sessionId);
    if (rec) {
      setAgainLoading(true);
      try {
        const prog = useAppStore.getState().progressions[rec.style];
        const id = await startPlanSession({ style: rec.style, themes: rec.themes, durationSec: rec.durationSec, startRating: prog.currentPuzzleRating });
        router.replace(`/play/${id}` as Href);
      } catch {
        setAgainLoading(false);
        router.dismissTo(HOME);
      }
      return;
    }
    const setup = readLastSetup();
    const prog = setup ? useAppStore.getState().progressions[setup.style] : null;
    if (!setup || !prog) {
      router.dismissTo(SETUP);
      return;
    }
    setAgainLoading(true);
    try {
      const id = await startSession({ ...setup, startRating: repeatStartRating(setup, prog) });
      router.replace(`/play/${id}` as Href);
    } catch {
      setAgainLoading(false);
      router.dismissTo(SETUP);
    }
  };

  return { pieceSet, mirror, controller, view, boardRef, onMove, s, storeRating, storeProg, againLoading, playAgain, result, running, plan };
}

export type RunnerScreenModel = ReturnType<typeof useRunnerScreen>;
