import { eos, fontFamilies } from '@tac/core/tokens';
import { Redirect, Stack } from 'expo-router';

import { DEV_MENU } from '@/dev/flags';

// Dev-only route group: labs, benches and the kitchen sink (PLAN §5 Phase 1).

export default function DevLayout() {
  if (!DEV_MENU) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: eos.shade },
        headerTintColor: eos.bone,
        headerTitleStyle: { fontFamily: fontFamilies.sans[700] },
        contentStyle: { backgroundColor: eos.ink },
      }}
    />
  );
}
