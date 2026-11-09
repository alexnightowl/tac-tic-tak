import { Stack } from 'expo-router';

import { DxSettingsAccount } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { AccountScreen } from '@/features/settings/AccountScreen';

// Settings › Account (push; title set by the screen; desktop: the settings frame's Account pane).
export default function SettingsAccountRoute() {
  const desktop = useDesktop();
  return (
    <>
      <Stack.Screen options={{ headerShown: !desktop }} />
      {desktop ? <DxSettingsAccount /> : <AccountScreen />}
    </>
  );
}
