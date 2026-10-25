import { eos, fontFamilies } from '@tac/core/tokens';
import { Redirect, Stack } from 'expo-router';

// Dev-only route group: labs, benches and the kitchen sink (PLAN §5 Phase 1).
export const DEV_MENU = __DEV__ || process.env.EXPO_PUBLIC_DEV_MENU === '1';

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
