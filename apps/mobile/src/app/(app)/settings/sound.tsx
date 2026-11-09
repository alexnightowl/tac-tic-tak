import { Stack } from 'expo-router';

import { DxSettingsSound } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { SoundScreen } from '@/features/settings/SoundScreen';

// Settings › Sound & haptics (push; title set by the screen; desktop: the settings frame's Sound pane).
export default function SettingsSoundRoute() {
  const desktop = useDesktop();
  return (
    <>
      <Stack.Screen options={{ headerShown: !desktop }} />
      {desktop ? <DxSettingsSound /> : <SoundScreen />}
    </>
  );
}
