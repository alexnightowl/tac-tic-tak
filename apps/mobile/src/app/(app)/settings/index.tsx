import { Stack } from 'expo-router';

import { DxSettings } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { SettingsIndexScreen } from '@/features/settings/SettingsIndexScreen';
import { useT } from '@/ui/lang';

// /settings (push from the avatar menu; was a tab until the Learn tab).
// Its sections push on the same stack.
export default function SettingsRoute() {
  const t = useT();
  const desktop = useDesktop();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.title'), headerShown: !desktop }} />
      {desktop ? <DxSettings /> : <SettingsIndexScreen />}
    </>
  );
}
