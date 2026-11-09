import { STORM_FORMATS, type StormFormat } from '@tac/core/storm';
import { useLocalSearchParams } from 'expo-router';

import { DxStormRun } from '@/desktop/board';
import { useDesktop } from '@/desktop/useDesktop';
import { RunScreen } from '@/features/storm/RunScreen';

// /storm/run?challenge&format: the Storm / Race runner (fullScreenModal, no swipe; ✕ confirms).
export default function StormRunRoute() {
  const p = useLocalSearchParams<{ challenge?: string; format?: string }>();
  const desktop = useDesktop();
  const format: StormFormat = STORM_FORMATS.includes(p.format as StormFormat) ? (p.format as StormFormat) : 'time3';
  const challenge = p.challenge || null;
  if (desktop) return <DxStormRun key={`${challenge ?? 'solo'}|${format}`} challengeId={challenge} format={format} />;
  return <RunScreen key={`${challenge ?? 'solo'}|${format}`} challengeId={challenge} format={format} />;
}
