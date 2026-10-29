import type { StreakDisplayState } from '@tac/core/format';
import { eos, tone } from '@tac/core/tokens';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { fontFamily } from '@/ui/fonts';
import { useLang } from '@/ui/lang';
import { FlameGlyph } from './glyphs';

/**
 * Compact daily-streak flame + count (design v2 leaderboard rows: the filled
 * canvas flame, 12 pt, gap 3, 12/16 semibold gold). Callers decide
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
  const { lang } = useLang();
  if (days <= 0) return null;
  const color = state === 'broken' ? eos.dust : tone.gold;
  const small = size === 'sm';
  return (
    <View style={styles.row} accessible={!!label} accessibilityLabel={label} testID={testID}>
      <FlameGlyph size={small ? 12 : 14} color={color} />
      <AppText
        variant={small ? 'caption' : 'body'}
        color={color}
        style={[styles.num, { fontFamily: fontFamily(lang, 'body', 600) }]}
      >
        {String(days)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  num: { fontVariant: ['tabular-nums'] },
});
