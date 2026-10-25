import { layout, space } from '@tac/core/tokens';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AchievementsGrid } from '@/features/achievements/AchievementsGrid';
import '@/features/achievements/icons';
import { useT } from '@/ui/lang';
import { Segmented } from '@/ui/Segmented';
import { StatsView } from './StatsView';

type Tab = 'stats' | 'achievements';

/**
 * Stats tab (web /analytics): Stats | Achievements switch pinned under the
 * shell header; each side is its own virtualised list. Not persisted (web).
 */
export function StatsScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('stats');
  return (
    <View style={styles.root} testID="screen-stats">
      <View style={styles.switch}>
        <Segmented
          options={[
            { value: 'stats' as const, label: t('stats.tab_stats') },
            { value: 'achievements' as const, label: t('stats.tab_achievements') },
          ]}
          value={tab}
          onChange={setTab}
          testID="stats-tab"
          accessibilityLabel={t('stats.sections')}
        />
      </View>
      {tab === 'stats' ? <StatsView /> : <AchievementsGrid />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  switch: { paddingHorizontal: layout.gutter, paddingTop: space[3] },
});
