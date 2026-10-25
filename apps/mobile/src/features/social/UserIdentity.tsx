import { eos, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, VerifiedBadge } from '@/features/profile/Avatar';
import { queryClient } from '@/platform/query';
import { AppText } from '@/ui/AppText';
import { profileQuery, type UserCard } from './api';
import { displayNameOf } from './actions';

/** Avatar + name (+ @nick when a display name is set) + verified + country,
 *  the left half of every social row (web rows). */
export function UserIdentity({ user, size = 36, extra }: { user: UserCard; size?: number; extra?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Avatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={size} />
      <View style={styles.text}>
        <View style={styles.nameLine}>
          <AppText variant="body" numberOfLines={1} style={styles.shrink}>
            {displayNameOf(user)}
            {user.displayName ? <AppText variant="body" color={eos.dust}>{`  @${user.nickname}`}</AppText> : null}
          </AppText>
          <VerifiedBadge verified={user.verified} size={13} />
        </View>
        {user.country ? (
          <AppText variant="label" color={eos.dust} style={styles.country}>
            {user.country.toUpperCase()}
          </AppText>
        ) : null}
        {extra}
      </View>
    </View>
  );
}

/** Row tap → profile; the profile query starts first so the push lands filled. */
export function openProfile(nickname: string): void {
  void queryClient.prefetchQuery(profileQuery(nickname));
  router.push({ pathname: '/profile/[nickname]', params: { nickname } });
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1, minWidth: 0 },
  text: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  shrink: { flexShrink: 1 },
  country: { fontSize: 10, marginTop: 1 },
});
