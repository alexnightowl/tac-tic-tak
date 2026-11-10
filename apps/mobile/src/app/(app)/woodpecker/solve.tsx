import { useLocalSearchParams } from 'expo-router';

import { DxWoodpeckerSolve } from '@/desktop/woodpecker';
import { useDesktop } from '@/desktop/useDesktop';
import { WoodpeckerSolveScreen } from '@/features/woodpecker/SolveScreen';

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : d;
};

// /woodpecker/solve?set&cycle: a Woodpecker cycle on the practice runner
// (fullScreenModal, see (app)/_layout), in set order from the first open
// puzzle. (`start` from older links is ignored.)
export default function WoodpeckerSolveRoute() {
  const p = useLocalSearchParams<{ set?: string; cycle?: string }>();
  const desktop = useDesktop();
  const setId = p.set ?? '';
  const cycle = Math.max(1, int(p.cycle, 1));
  const key = `${setId}|${cycle}`;
  if (desktop) return <DxWoodpeckerSolve key={key} setId={setId} cycle={cycle} />;
  return <WoodpeckerSolveScreen key={key} setId={setId} cycle={cycle} />;
}
