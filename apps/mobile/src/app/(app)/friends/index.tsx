import { Stack } from 'expo-router';
import { View } from 'react-native';

import '@/features/achievements/icons';
import { FriendsView } from '@/features/social/FriendsView';
import { useT } from '@/ui/lang';

// /friends (avatar menu → Friends): the Social tab's Friends side as a push.
export default function FriendsScreen() {
  const t = useT();
  return (
    <View style={{ flex: 1 }} testID="screen-friends">
      <Stack.Screen options={{ title: t('friends.title') }} />
      <FriendsView />
    </View>
  );
}
