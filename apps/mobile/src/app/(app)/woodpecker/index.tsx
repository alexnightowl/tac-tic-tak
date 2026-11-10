import { useLocalSearchParams } from 'expo-router';

import { DxWoodpecker } from '@/desktop/woodpecker';
import { useDesktop } from '@/desktop/useDesktop';
import { WoodpeckerScreen } from '@/features/woodpecker/SetScreen';

// /woodpecker?set: the Woodpecker method (D41): the set's phase, today's
// portion, the cycles chart; without a set, the method and Start.
export default function WoodpeckerRoute() {
  const { set } = useLocalSearchParams<{ set?: string }>();
  const desktop = useDesktop();
  if (desktop) return <DxWoodpecker setId={set} />;
  return <WoodpeckerScreen setId={set} />;
}
