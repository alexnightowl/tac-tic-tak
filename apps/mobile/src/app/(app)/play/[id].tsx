import { useLocalSearchParams } from 'expo-router';

import { RunnerScreen } from '@/features/play/runner/RunnerScreen';

export default function PlaySession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A new id remounts the runner (one controller per session).
  return <RunnerScreen key={id} sessionId={id} />;
}
