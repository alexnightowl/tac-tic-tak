import { STORM_FORMATS, type StormFormat } from '@tac/core/storm';
import { useLocalSearchParams } from 'expo-router';

import { RunScreen } from '@/features/storm/RunScreen';

// /storm/run?challenge&format: the Storm / Race runner (fullScreenModal, no swipe; ✕ confirms).
export default function StormRunRoute() {
  const p = useLocalSearchParams<{ challenge?: string; format?: string }>();
  const format: StormFormat = STORM_FORMATS.includes(p.format as StormFormat) ? (p.format as StormFormat) : 'time3';
  const challenge = p.challenge || null;
  return <RunScreen key={`${challenge ?? 'solo'}|${format}`} challengeId={challenge} format={format} />;
}
