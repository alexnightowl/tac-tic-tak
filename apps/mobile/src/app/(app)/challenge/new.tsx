import { useLocalSearchParams } from 'expo-router';

import { CreateScreen } from '@/features/challenge/CreateScreen';

// /challenge/new?friend&format&run&score: Create (canvas ChallengeCreate).
// `run` + `score` come from Storm Result's "Dare a friend to beat N".
export default function ChallengeNewRoute() {
  const p = useLocalSearchParams<{ friend?: string; format?: string; run?: string; score?: string }>();
  return <CreateScreen key={`${p.friend ?? ''}|${p.run ?? ''}`} friend={p.friend} format={p.format} run={p.run} score={p.score} />;
}
