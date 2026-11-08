import { useLocalSearchParams } from 'expo-router';

import { AchievementSheet } from '@/features/achievements/AchievementSheet';
import { WebSheet } from '@/ui/webSheet';

export default function AchievementRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <WebSheet size="fit">
      <AchievementSheet slug={slug ?? ''} />
    </WebSheet>
  );
}
