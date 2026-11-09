import { BarChart3, Star } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { useStatsTab } from '@/features/stats/useStatsTab';
import { useT } from '@/ui/lang';
import { Seg } from '../kit';
import { DxAchievements } from './Achievements';
import { DxStats } from './Stats';

/** /stats on a desktop window: DXStats or DXAchievements, switched in the header. */
export function DxStatsTabs() {
  const t = useT();
  const [tab, setTab] = useStatsTab();
  const switcher = (
    <Seg
      options={[
        { value: 'stats' as const, label: t('stats.tab_stats'), icon: BarChart3 },
        { value: 'achievements' as const, label: t('stats.tab_achievements'), icon: Star },
      ]}
      value={tab}
      onChange={setTab}
      testID="dx-stats-tab"
      accessibilityLabel={t('stats.sections')}
      style={styles.switch}
    />
  );
  return tab === 'stats' ? <DxStats switcher={switcher} /> : <DxAchievements switcher={switcher} />;
}

const styles = StyleSheet.create({ switch: { width: 300 } });
