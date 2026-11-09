import { useLocalSearchParams } from 'expo-router';

import { DxChallenge } from '@/desktop/home';
import { useDesktop } from '@/desktop/useDesktop';
import { CreateScreen } from '@/features/challenge/CreateScreen';

// /challenge/new?friend&format&run&score: Create (canvas ChallengeCreate).
// `run` + `score` come from Storm Result's "Dare a friend to beat N".
// A desktop window gets DXChallenge.
export default function ChallengeNewRoute() {
  const p = useLocalSearchParams<{ friend?: string; format?: string; run?: string; score?: string }>();
  const desktop = useDesktop();
  const key = `${p.friend ?? ''}|${p.run ?? ''}`;
  return desktop ? (
    <DxChallenge key={key} friend={p.friend} format={p.format} run={p.run} score={p.score} />
  ) : (
    <CreateScreen key={key} friend={p.friend} format={p.format} run={p.run} score={p.score} />
  );
}
