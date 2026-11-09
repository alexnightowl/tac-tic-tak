import { useLocalSearchParams } from 'expo-router';

import { DxMistakes } from '@/desktop/board';
import { useDesktop } from '@/desktop/useDesktop';
import { MistakesScreen } from '@/features/sessions/MistakesScreen';

// /sessions/[id]/review: the session's mistakes runner (fullScreenModal).
export default function SessionReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const desktop = useDesktop();
  if (desktop) return <DxMistakes key={id} sessionId={id} />;
  return <MistakesScreen key={id} sessionId={id} />;
}
