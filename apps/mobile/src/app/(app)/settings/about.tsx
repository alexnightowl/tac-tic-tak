import { Stack } from 'expo-router';

import { DxSettingsAbout } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { AboutScreen } from '@/features/settings/AboutScreen';

// Settings › About (push; title set by the screen; desktop: the settings frame's About pane).
export default function SettingsAboutRoute() {
  const desktop = useDesktop();
  return (
    <>
      <Stack.Screen options={{ headerShown: !desktop }} />
      {desktop ? <DxSettingsAbout /> : <AboutScreen />}
    </>
  );
}
