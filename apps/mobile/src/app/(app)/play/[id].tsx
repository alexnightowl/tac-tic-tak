import { useLocalSearchParams } from 'expo-router';

import { RunnerScreen } from '@/features/play/runner/RunnerScreen';

export default function PlaySession() {
  // `finish=1`: Home's resume card "Finish" (restore the snapshot, then save).
  const { id, finish } = useLocalSearchParams<{ id: string; finish?: string }>();
  // A new id remounts the runner (one controller per session).
  return <RunnerScreen key={id} sessionId={id} finishOnStart={finish === '1'} />;
}
