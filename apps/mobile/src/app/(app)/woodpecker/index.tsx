import { useLocalSearchParams } from 'expo-router';

import { DxWoodpecker } from '@/desktop/woodpecker';
import { useDesktop } from '@/desktop/useDesktop';
import { WoodpeckerScreen } from '@/features/woodpecker/SetScreen';

// /woodpecker?set: a Woodpecker set (D40): the cycle, the cycles chart,
// the blocks; without a set, the method and the create form.
export default function WoodpeckerRoute() {
  const { set } = useLocalSearchParams<{ set?: string }>();
  const desktop = useDesktop();
  if (desktop) return <DxWoodpecker setId={set} />;
  return <WoodpeckerScreen setId={set} />;
}
