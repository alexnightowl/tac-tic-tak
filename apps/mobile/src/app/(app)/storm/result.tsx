import { useLocalSearchParams } from 'expo-router';

import { ResultScreen } from '@/features/storm/ResultScreen';

// /storm/result?run=<clientId>: a finished solo run, from the phone's copy.
export default function StormResultRoute() {
  const p = useLocalSearchParams<{ run?: string }>();
  const run = p.run ?? '';
  return <ResultScreen key={run} clientId={run} />;
}
