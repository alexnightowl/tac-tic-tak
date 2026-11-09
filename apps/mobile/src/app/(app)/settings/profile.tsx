import { Stack } from 'expo-router';

import { DxSettings } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { ProfileScreen } from '@/features/settings/ProfileScreen';

// Settings › Profile (routes to the social stream's editor) (push; title set by the screen; desktop: the settings frame's Profile pane).
export default function SettingsProfileRoute() {
  const desktop = useDesktop();
  return (
    <>
      <Stack.Screen options={{ headerShown: !desktop }} />
      {desktop ? <DxSettings /> : <ProfileScreen />}
    </>
  );
}
