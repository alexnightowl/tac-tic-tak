import type { StreakDisplayState } from '@tac/core/format';
import { eos, rank } from '@tac/core/tokens';
import { Flame } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/AppText';

/**
 * Compact daily-streak flame + count (web StreakBadge). Callers decide
 * whether to show it (settings.showStreak, streakState); broken streaks dim.
 */
export function StreakBadge({
  days,
  state = 'secured',
  size = 'md',
  label,
  testID,
}: {
  days: number;
  state?: StreakDisplayState;
  size?: 'sm' | 'md';
  /** Spoken label; the caller localises it. */
  label?: string;
  testID?: string;
}) {
  if (days <= 0) return null;
  const color = state === 'broken' ? eos.dust : rank.intermediate.color;
  const small = size === 'sm';
  return (
    <View style={styles.row} accessible={!!label} accessibilityLabel={label} testID={testID}>
      <Flame size={small ? 12 : 14} color={color} />
      <AppText variant={small ? 'caption' : 'body'} color={color} style={styles.num}>
        {String(days)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  num: { fontVariant: ['tabular-nums'], fontWeight: '600' },
});
