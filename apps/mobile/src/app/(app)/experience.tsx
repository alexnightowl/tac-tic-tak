import { Stack } from 'expo-router';

import { DxXp } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { ExperienceScreen } from '@/features/experience/ExperienceScreen';

// /experience: XP, the rank ladder and how XP is earned (Profile's card; desktop: DXXP).
export default function ExperienceRoute() {
  const desktop = useDesktop();
  return (
    <>
      <Stack.Screen options={{ headerShown: !desktop }} />
      {desktop ? <DxXp /> : <ExperienceScreen />}
    </>
  );
}
