import { useLocalSearchParams } from 'expo-router';

import { ProfileScreen } from '@/features/profile/ProfileScreen';

// /profile/:nickname (push; also tactictak://profile/<nick>).
export default function ProfileRoute() {
  const { nickname } = useLocalSearchParams<{ nickname: string }>();
  return <ProfileScreen nickname={nickname ?? ''} />;
}
