import { Stack } from 'expo-router';

import { DxSettingsGameplay } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { GameplayScreen } from '@/features/settings/GameplayScreen';

// Settings › Gameplay (push; title set by the screen; desktop: the settings frame's Gameplay pane).
export default function SettingsGameplayRoute() {
  const desktop = useDesktop();
  return (
    <>
      <Stack.Screen options={{ headerShown: !desktop }} />
      {desktop ? <DxSettingsGameplay /> : <GameplayScreen />}
    </>
  );
}
