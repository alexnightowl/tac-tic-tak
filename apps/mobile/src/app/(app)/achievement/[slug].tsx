import { useLocalSearchParams } from 'expo-router';

import { AchievementSheet } from '@/features/achievements/AchievementSheet';

export default function AchievementRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <AchievementSheet slug={slug ?? ''} />;
}
