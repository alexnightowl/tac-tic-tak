import { space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { acceptRequest, confirmUnfriend, removeRequest, sendRequest } from './actions';
import { friendshipQuery, type UserCard } from './api';

/**
 * Profile action for another player (web FriendActionButton): Add friend /
 * Cancel request / Accept + Decline / Unfriend. Every action toasts (the web
 * button never toasted its accept's unlocks) and unfriend asks first.
 */
export function FriendActionButton({ user }: { user: UserCard }) {
  const t = useT();
  const q = useQuery(friendshipQuery(user.nickname));
  const [busy, setBusy] = useState<string | null>(null);
  const s = q.data;
  if (!s || s.state === 'self') return null;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };
  const off = busy !== null;

  switch (s.state) {
    case 'none':
      return (
        <PlateButton
          testID="profile-add-friend"
          label={t('profile.add_friend')}
          size="sm"
          loading={busy === 'add'}
          disabled={off}
          onPress={() => void run('add', () => sendRequest(user))}
        />
      );
    case 'outgoing':
      return (
        <PlateButton
          testID="profile-cancel-request"
          label={t('profile.cancel_request')}
          variant="slate"
          size="sm"
          loading={busy === 'cancel'}
          disabled={off}
          onPress={() => s.friendshipId && void run('cancel', () => removeRequest(s.friendshipId!, user, 'cancel'))}
        />
      );
    case 'incoming':
      return (
        <View style={styles.pair}>
          <PlateButton
            testID="profile-accept"
            label={t('friends.accept')}
            size="sm"
            loading={busy === 'accept'}
            disabled={off}
            onPress={() => s.friendshipId && void run('accept', () => acceptRequest(s.friendshipId!, user))}
          />
          <PlateButton
            testID="profile-decline"
            label={t('friends.decline')}
            variant="slate"
            size="sm"
            loading={busy === 'decline'}
            disabled={off}
            onPress={() => s.friendshipId && void run('decline', () => removeRequest(s.friendshipId!, user, 'decline'))}
          />
        </View>
      );
    case 'friends':
      return (
        <PlateButton
          testID="profile-unfriend"
          label={t('profile.unfriend')}
          accessibilityLabel={`${t('profile.friends')}. ${t('profile.unfriend')}`}
          variant="slate"
          size="sm"
          disabled={off}
          onPress={() => confirmUnfriend(user)}
        />
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: space[2] },
});
