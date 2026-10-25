import { space, surface } from '@tac/core/tokens';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import { Tap } from '@/ui/Tap';
import type { RunnerController, RunnerView } from '@/runner';

/**
 * Dev / E2E builds only (PLAN §2.11). Must be false in the release bundle:
 * `__DEV__` and the inlined EXPO_PUBLIC_ flag let Metro strip the strip.
 */
export const E2E = __DEV__ || process.env.EXPO_PUBLIC_E2E === '1';

// Board render count without re-rendering the runner: the Board reports
// through a stable module function, only <BoardRenderCount> listens.
let boardRenders = 0;
const renderListeners = new Set<() => void>();
export function onBoardRenderCount(n: number): void {
  boardRenders = n;
  for (const fn of renderListeners) fn();
}
const subscribeRenders = (fn: () => void) => {
  renderListeners.add(fn);
  return () => {
    renderListeners.delete(fn);
  };
};
const readRenders = () => boardRenders;

function BoardRenderCount() {
  const n = useSyncExternalStore(subscribeRenders, readRenders);
  return (
    <AppText variant="caption" color={FAINT} testID="board-render-count">
      {String(n)}
    </AppText>
  );
}

/**
 * Views stay at alpha 1 and only the ink is faint: RNGH on Android skips
 * views under alpha 0.1 when hit-testing (MIN_ALPHA_FOR_TOUCH), and iOS
 * hides views under 0.01 from accessibility (and so from Maestro).
 */
const FAINT = surface.cardBorder;

/**
 * Nearly invisible hooks for Maestro: solve / wrong go through the real
 * move path (controller.dispatch 'move'), plus the probes the flows read.
 */
export function E2EStrip({ controller, view }: { controller: RunnerController; view: RunnerView }) {
  const s = view.state;
  return (
    <View style={styles.strip} pointerEvents="box-none">
      <Tap testID="e2e-solve" accessibilityRole="button" accessibilityLabel="e2e solve" onPress={controller.e2eSolve} style={styles.btn}>
        <AppText variant="caption" color={FAINT}>{'solve'}</AppText>
      </Tap>
      <Tap testID="e2e-wrong" accessibilityRole="button" accessibilityLabel="e2e wrong" onPress={controller.e2eWrong} style={styles.btn}>
        <AppText variant="caption" color={FAINT}>{'wrong'}</AppText>
      </Tap>
      <AppText variant="caption" color={FAINT} testID="puzzle-id">
        {s.puzzle?.id ?? ''}
      </AppText>
      <AppText variant="caption" color={FAINT} testID="runner-phase">
        {s.paused ? 'paused' : s.phase}
      </AppText>
      <BoardRenderCount />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: space[8],
  },
  btn: { height: space[8], paddingHorizontal: space[3], justifyContent: 'center' },
});
