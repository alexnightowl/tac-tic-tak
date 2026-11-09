import { useLocalSearchParams } from 'expo-router';

import { DxStormResult } from '@/desktop/home';
import { useDesktop } from '@/desktop/useDesktop';
import { ResultScreen } from '@/features/storm/ResultScreen';

// /storm/result?run=<clientId>: a finished solo run, from the phone's copy.
// A desktop window gets DXStormResult.
export default function StormResultRoute() {
  const p = useLocalSearchParams<{ run?: string }>();
  const desktop = useDesktop();
  const run = p.run ?? '';
  return desktop ? <DxStormResult key={run} clientId={run} /> : <ResultScreen key={run} clientId={run} />;
}
