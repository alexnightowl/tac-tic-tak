import { Stack } from 'expo-router';
import { View } from 'react-native';

import '@/features/achievements/icons';
import { DxFriends } from '@/desktop/account';
import { useDesktop } from '@/desktop/useDesktop';
import { FriendsView } from '@/features/social/FriendsView';
import { useT } from '@/ui/lang';
import { stackHeader } from '@/ui/NavHeader';

// /friends (profile / account menu → Friends): design v2 MobFriends, a
// compact header with the `.glass` back button.
const FRIENDS_HEADER = stackHeader('glass', { compact: true });

export default function FriendsScreen() {
  const t = useT();
  const desktop = useDesktop();
  if (desktop) {
    return (
      <>
        <Stack.Screen options={{ title: t('friends.title'), headerShown: false }} />
        <DxFriends />
      </>
    );
  }
  return (
    <View style={{ flex: 1 }} testID="screen-friends">
      <Stack.Screen options={{ title: t('friends.title'), header: FRIENDS_HEADER, headerShown: true }} />
      <FriendsView />
    </View>
  );
}
