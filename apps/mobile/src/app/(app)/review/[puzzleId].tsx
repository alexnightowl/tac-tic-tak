import { useLocalSearchParams } from 'expo-router';

import { DxReviewDrill } from '@/desktop/board';
import { useDesktop } from '@/desktop/useDesktop';
import { DrillScreen } from '@/features/review/DrillScreen';

// /review/[puzzleId]?theme= : theme drill (fullScreenModal, see (app)/_layout).
export default function DrillRoute() {
  const { puzzleId, theme } = useLocalSearchParams<{ puzzleId: string; theme?: string }>();
  const desktop = useDesktop();
  if (desktop) return <DxReviewDrill key={`${puzzleId}|${theme ?? ''}`} puzzleId={puzzleId} theme={theme || undefined} />;
  return <DrillScreen key={`${puzzleId}|${theme ?? ''}`} puzzleId={puzzleId} theme={theme || undefined} />;
}
