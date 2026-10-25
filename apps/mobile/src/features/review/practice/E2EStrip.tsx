import type { PracticeState } from '@tac/core/runner';
import { space, surface } from '@tac/core/tokens';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import { Tap } from '@/ui/Tap';
import type { PracticeController } from './PracticeController';

/** Dev / E2E builds only: `__DEV__` and the inlined flag let Metro strip it from release. */
export const E2E = __DEV__ || process.env.EXPO_PUBLIC_E2E === '1';

/** Faint ink at alpha 1 (RNGH skips views under 0.1 alpha; iOS hides < 0.01 from Maestro). */
const FAINT = surface.cardBorder;

/** Maestro hooks: solve / wrong go through the real move path, plus the probes flows read. */
export function PracticeE2EStrip({ controller, state }: { controller: PracticeController; state: PracticeState }) {
  return (
    <View style={styles.strip} pointerEvents="box-none">
      <Tap testID="e2e-solve" accessibilityRole="button" accessibilityLabel="e2e solve" onPress={controller.e2eSolve} style={styles.btn}>
        <AppText variant="caption" color={FAINT}>{'solve'}</AppText>
      </Tap>
      <Tap testID="e2e-wrong" accessibilityRole="button" accessibilityLabel="e2e wrong" onPress={controller.e2eWrong} style={styles.btn}>
        <AppText variant="caption" color={FAINT}>{'wrong'}</AppText>
      </Tap>
      <AppText variant="caption" color={FAINT} testID="puzzle-id">
        {state.item?.puzzle.id ?? ''}
      </AppText>
      <AppText variant="caption" color={FAINT} testID="runner-phase">
        {state.phase}
      </AppText>
      <AppText variant="caption" color={FAINT} testID="practice-rewinds">
        {String(state.rewinds)}
      </AppText>
      <AppText variant="caption" color={FAINT} testID="viewer-fen" numberOfLines={1} style={styles.fen}>
        {state.fen ?? ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: space[2], height: space[8] },
  btn: { height: space[8], paddingHorizontal: space[3], justifyContent: 'center' },
  fen: { flex: 1 },
});
