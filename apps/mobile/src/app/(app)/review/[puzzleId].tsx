import { useLocalSearchParams } from 'expo-router';

import { DrillScreen } from '@/features/review/DrillScreen';

// /review/[puzzleId]?theme= : theme drill (fullScreenModal, see (app)/_layout).
export default function DrillRoute() {
  const { puzzleId, theme } = useLocalSearchParams<{ puzzleId: string; theme?: string }>();
  return <DrillScreen key={`${puzzleId}|${theme ?? ''}`} puzzleId={puzzleId} theme={theme || undefined} />;
}
