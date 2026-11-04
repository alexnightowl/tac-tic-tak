import { space } from '@tac/core/tokens';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import '@/features/achievements/icons';
import { RivalsChallenges } from '@/features/challenge/RivalsChallenges';
import { useT } from '@/ui/lang';
import { Segmented } from '@/ui/Segmented';
import { LeaderboardView, LeagueView } from './LeaderboardView';

type Period = 'week' | 'all';

/**
 * League tab (was Rivals; owner, 2026-11-04): the challenges section, then
 * the board. It opens on this week's league; "All time" is the rating
 * board. Friends are reached from the profile (web /friends).
 */
export function RivalsScreen() {
  const t = useT();
  const [period, setPeriod] = useState<Period>('week');
  const top = (
    <View style={styles.top}>
      <RivalsChallenges />
      <Segmented
        options={[
          { value: 'week' as const, label: t('league.week') },
          { value: 'all' as const, label: t('league.all_time') },
        ]}
        value={period}
        onChange={setPeriod}
        testID="board-period"
        accessibilityLabel={t('league.period_label')}
      />
    </View>
  );
  return (
    <View style={styles.root} testID="screen-rivals">
      {period === 'week' ? <LeagueView top={top} /> : <LeaderboardView top={top} />}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, top: { gap: space[3] } });
