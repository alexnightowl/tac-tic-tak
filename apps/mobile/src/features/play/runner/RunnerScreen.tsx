import type { Progression } from '@tac/core/api';
import { normalizePieceSet } from '@tac/core/board';
import { CALIBRATION_SESSIONS } from '@tac/core/rules';
import { eligibleForUnlock, turnCardOf, unlockProgressOf } from '@tac/core/runner';
import { eos, layout, space } from '@tac/core/tokens';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, usePreventRemove, type Href } from 'expo-router';
import { Pause, Play, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { Board } from '@/board';
import { Countdown, usePuzzleRunner } from '@/runner';
import { useAppStore } from '@/stores/appStore';
import { AppText } from '@/ui';
import { takeFirstPuzzle } from '../pendingPuzzle';
import { readLastSetup, repeatStartRating } from '../setupPrefs';
import { startSession } from '../startSession';
import { usePlayT } from '../strings';
import { E2E, E2EStrip, onBoardRenderCount } from './E2EStrip';
import { ExitSheet, PauseOverlay } from './overlays';
import { GlassButton, StatPills, TurnCard } from './parts';
import { CalibrationProgressBar, UnlockProgressBar } from './progress';
import { Summary } from './Summary';

const HOME = '/' as Href;
const SETUP = '/play' as Href;
const KEEP_AWAKE_TAG = 'runner';

/**
 * /play/[id]: the session runner, then its summary in the same screen
 * (PLAN §2.3). Runner state changes re-render this screen; the Board is
 * memoised with stable props and never re-renders from them, and the
 * clock re-renders only <Countdown>.
 */
export function RunnerScreen({ sessionId, finishOnStart = false }: { sessionId: string; finishOnStart?: boolean }) {
  const t = usePlayT();
  const insets = useSafeAreaInsets();
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const mirror = useAppStore((s) => s.settings.mirrorView);
  const { controller, view, boardRef, onMove } = usePuzzleRunner(sessionId, () => takeFirstPuzzle(sessionId), { finishOnStart });
  const s = view.state;
  const runnerStyle = s.style;
  // web RatingPill: the store's live rating (patched after every attempt).
  const storeRating = useAppStore((st) => (runnerStyle ? st.progressions[runnerStyle].currentPuzzleRating : null));
  const storeProg = useAppStore((st) => (runnerStyle ? st.progressions[runnerStyle] : null));
  const [againLoading, setAgainLoading] = useState(false);
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

  if (result?.kind === 'summary') {
    return (
      <View style={styles.root}>
        <Summary
          summary={result.summary}
          serverSummary={result.source === 'server'}
          ceilingBefore={view.ceilingBefore}
          styleLabel={runnerStyle ? t(`style.${runnerStyle}.name`) : ''}
          t={t}
          onHome={() => router.dismissTo(HOME)}
          onPlayAgain={() => void playAgain()}
          playAgainLoading={againLoading}
        />
      </View>
    );
  }

  const card = turnCardOf(s);
  const theme = s.sessionMode === 'theme';
  const rating = theme ? s.sessionStartRating : (storeRating ?? s.rating);

  return (
    <View style={[styles.root, { paddingTop: Math.max(layout.runnerPadding, insets.top), paddingBottom: Math.max(layout.runnerPadding, insets.bottom) }]}>
      <FocusStatusBar />
      <View style={styles.topSlot}>
        <View style={styles.topRow}>
          <GlassButton testID="runner-exit" label={t('play.exit')} onPress={() => controller.dispatch({ type: 'requestExit' })}>
            <X size={18} color={eos.bone} />
            <AppText variant="label" color={eos.bone}>
              {t('play.exit')}
            </AppText>
          </GlassButton>
          <Countdown controller={controller} accessibilityLabel={t('play.timer')} />
          <GlassButton
            testID="runner-pause"
            label={s.paused ? t('play.resume') : t('play.pause')}
            disabled={s.phase === 'booting'}
            onPress={() => controller.dispatch(s.paused ? { type: 'resume', source: 'user' } : { type: 'pause', source: 'user' })}
          >
            {s.paused ? <Play size={18} color={eos.bone} /> : <Pause size={18} color={eos.bone} />}
          </GlassButton>
        </View>
        <TurnCard
          loading={card.loading}
          opponentMoving={card.opponentMoving}
          playerColor={card.playerColor}
          streak={card.streak}
          streakBroken={card.streakBroken}
          pieceSet={pieceSet}
          t={t}
        />
        <ProgressSlot s={s} prog={storeProg} t={t} />
      </View>

      <View style={styles.boardSlot}>
        <Board
          ref={boardRef}
          onMove={onMove}
          moveFeel="caller"
          pieceSet={pieceSet}
          mirror={mirror}
          onRenderCount={E2E ? onBoardRenderCount : undefined}
          style={styles.board}
        />
        {card.loading && (
          <View style={styles.spinner} pointerEvents="none">
            <ActivityIndicator color={eos.ember} size="large" />
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        <StatPills
          solved={s.counters.solved}
          failed={s.counters.failed}
          rating={rating}
          ratingLabel={theme ? t('play.drill') : t('play.rating')}
          t={t}
        />
        {E2E && <E2EStrip controller={controller} view={view} />}
      </View>

      {s.paused && (
        <PauseOverlay
          restored={view.restored}
          remainingMs={controller.remainingMs()}
          onResume={() => controller.dispatch({ type: 'resume', source: 'user' })}
          t={t}
        />
      )}
      {view.exitOpen && (
        <ExitSheet
          t={t}
          onSave={() => {
            controller.closeExit();
            controller.dispatch({ type: 'finish', save: true });
          }}
          onDiscard={() => {
            controller.closeExit();
            controller.dispatch({ type: 'finish', save: false });
          }}
          onCancel={controller.closeExit}
        />
      )}
      {s.phase === 'finishing' && (
        <View style={styles.finishing} pointerEvents="auto">
          <ActivityIndicator color={eos.ember} size="large" />
        </View>
      )}
    </View>
  );
}

/**
 * web progress slot under the TurnCard: calibration bar while the style
 * calibrates (rated sessions), else the live level-up bar for a session
 * started inside the peak band, else nothing.
 */
function ProgressSlot({ s, prog, t }: { s: RunnerScreenState; prog: Progression | null; t: ReturnType<typeof usePlayT> }) {
  if (!prog || !s.style || s.phase === 'booting' || s.sessionMode === 'theme') return null;
  const calibrating = prog.calibrationSessionsLeft > 0;
  if (calibrating) {
    return <CalibrationProgressBar done={CALIBRATION_SESSIONS - prog.calibrationSessionsLeft} total={CALIBRATION_SESSIONS} style={s.style} t={t} />;
  }
  if (!eligibleForUnlock(s.sessionMode, calibrating, s.sessionStartRating, prog.unlockedStartRating)) return null;
  const progress = unlockProgressOf(s);
  return progress ? <UnlockProgressBar progress={progress} unlockedTo={prog.unlockedStartRating} t={t} /> : null;
}

type RunnerScreenState = ReturnType<typeof usePuzzleRunner>['view']['state'];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  topSlot: {
    minHeight: layout.boardTopSlot,
    paddingHorizontal: space[2],
    gap: space[2.5],
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  boardSlot: { flex: 1, minHeight: 0 },
  // Top-aligned so the board sits at the same y whatever the screen height.
  board: { flex: 1, alignSelf: 'stretch', justifyContent: 'flex-start' },
  spinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: space[2], paddingTop: space[2], gap: space[1] },
  finishing: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
});
