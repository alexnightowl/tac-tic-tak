import { useLocalSearchParams } from 'expo-router';

import { MistakesScreen } from '@/features/sessions/MistakesScreen';

// /sessions/[id]/review: the session's mistakes runner (fullScreenModal).
export default function SessionReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MistakesScreen key={id} sessionId={id} />;
}
