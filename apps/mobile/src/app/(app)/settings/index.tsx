import { Stack } from 'expo-router';

import { SettingsIndexScreen } from '@/features/settings/SettingsIndexScreen';
import { useT } from '@/ui/lang';

// /settings (push from the avatar menu; was a tab until the Learn tab).
// Its sections push on the same stack.
export default function SettingsRoute() {
  const t = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <SettingsIndexScreen />
    </>
  );
}
