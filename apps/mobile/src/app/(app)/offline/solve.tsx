import { useLocalSearchParams } from 'expo-router';

import { SolveScreen } from '@/features/offline/SolveScreen';
import type { PackKey } from '@/features/offline/store';

const KEYS: readonly PackKey[] = ['level', 'weak', 'mate', 'endgame', 'hard', 'review'];

// /offline/solve?pack= : the offline runner (fullScreenModal, see (app)/_layout).
export default function OfflineSolveRoute() {
  const { pack } = useLocalSearchParams<{ pack?: string }>();
  const key = KEYS.find((k) => k === pack) ?? 'level';
  return <SolveScreen key={key} pack={key} />;
}
