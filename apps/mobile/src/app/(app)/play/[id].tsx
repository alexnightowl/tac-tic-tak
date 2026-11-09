import { useLocalSearchParams } from 'expo-router';

import { DxSession } from '@/desktop/board';
import { useDesktop } from '@/desktop/useDesktop';
import { RunnerScreen } from '@/features/play/runner/RunnerScreen';

export default function PlaySession() {
  // `finish=1`: Home's resume card "Finish" (restore the snapshot, then save).
  const { id, finish } = useLocalSearchParams<{ id: string; finish?: string }>();
  const desktop = useDesktop();
  // A new id remounts the runner (one controller per session).
  if (desktop) return <DxSession key={id} sessionId={id} finishOnStart={finish === '1'} />;
  return <RunnerScreen key={id} sessionId={id} finishOnStart={finish === '1'} />;
}
