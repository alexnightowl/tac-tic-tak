import { useLocalSearchParams } from 'expo-router';

import { DxAchievementModal } from '@/desktop/rivals';
import { useDesktop } from '@/desktop/useDesktop';
import { AchievementSheet } from '@/features/achievements/AchievementSheet';
import { WebSheet } from '@/ui/webSheet';

export default function AchievementRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const desktop = useDesktop();
  if (desktop) return <DxAchievementModal slug={slug ?? ''} />;
  return (
    <WebSheet size="fit">
      <AchievementSheet slug={slug ?? ''} />
    </WebSheet>
  );
}
