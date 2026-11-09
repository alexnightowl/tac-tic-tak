import { Stack, useLocalSearchParams } from 'expo-router';

import { DxProfile } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { ProfileScreen } from '@/features/profile/ProfileScreen';

// /profile/:nickname (push; also tactictak://profile/<nick>).
export default function ProfileRoute() {
  const { nickname } = useLocalSearchParams<{ nickname: string }>();
  const desktop = useDesktop();
  if (desktop) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <DxProfile key={nickname} nickname={nickname ?? ''} />
      </>
    );
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />
      <ProfileScreen nickname={nickname ?? ''} />
    </>
  );
}
