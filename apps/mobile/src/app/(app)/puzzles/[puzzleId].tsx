import { useLocalSearchParams } from 'expo-router';

import { ViewerScreen } from '@/features/puzzles/ViewerScreen';

// /puzzles/[puzzleId]: the read-only puzzle viewer and solution stepper (push).
export default function PuzzleRoute() {
  const { puzzleId } = useLocalSearchParams<{ puzzleId: string }>();
  return <ViewerScreen key={puzzleId} puzzleId={puzzleId} />;
}
