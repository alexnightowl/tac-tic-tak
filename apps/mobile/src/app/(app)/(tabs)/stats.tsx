import { DxStatsTabs } from '@/desktop/rivals';
import { useDesktop } from '@/desktop/useDesktop';
import { StatsScreen } from '@/features/stats/StatsScreen';

// Stats tab = Stats | Achievements (PLAN §2.3, Phase 7); a desktop window
// gets DXStats / DXAchievements.
export default function StatsRoute() {
  const desktop = useDesktop();
  return desktop ? <DxStatsTabs /> : <StatsScreen />;
}
