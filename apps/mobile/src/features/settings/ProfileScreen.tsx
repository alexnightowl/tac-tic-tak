import { space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Camera, KeyRound, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { meQuery } from '@/features/auth/session';
import { chooseAvatar } from '@/features/profile/avatarUpload';
import { ProfileEditorSheet } from '@/features/profile/ProfileEditorSheet';
import { Avatar } from '@/features/profile/Avatar';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { scriptLang } from '@/ui/fonts';
import { useT } from '@/ui/lang';
import { NavRow, Section, SettingsPage } from './parts';

// Settings › Profile. The profile editor (display name, bio, country,
// avatar) belongs to the social stream, on the own-profile screen and the
// avatar chooser; this screen opens those same components (no second
// editor). Password lives in Settings › Account.
export function ProfileScreen() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const authed = useAuthStore((s) => s.status === 'authed');
  // bio / country aren't in the cached user; the editor seeds from /users/me.
  const me = useQuery({ ...meQuery, enabled: authed });
  const [editing, setEditing] = useState(false);
  const nickname = user?.nickname ?? '';
  const profileHref = `/profile/${encodeURIComponent(nickname)}` as const;

  return (
    <SettingsPage testID="screen-settings-profile" title={t('settings.tab.profile')}>
      <View style={styles.head}>
        <Avatar nickname={nickname} avatarUrl={user?.avatarUrl} size={72} />
        <AppText variant="title" lang={scriptLang(user?.displayName || nickname)} numberOfLines={1}>
          {user?.displayName || nickname}
        </AppText>
        <AppText variant="caption">{`@${nickname}`}</AppText>
      </View>
      <Section>
        <NavRow
          icon={UserRound}
          label={t('profile.edit_title')}
          hint={t('settings.profile_hint')}
          testID="settings-profile-edit"
          onPress={() => (me.data ? setEditing(true) : router.push(profileHref))}
        />
        <NavRow
          icon={Camera}
          label={t('profile.change_avatar')}
          testID="settings-profile-avatar"
          onPress={chooseAvatar}
        />
        <NavRow
          icon={KeyRound}
          label={t('profile.change_password')}
          testID="settings-profile-password"
          onPress={() => router.push('/settings/account')}
        />
      </Section>
      <Section>
        <NavRow
          label={t('settings.profile.view')}
          testID="settings-profile-view"
          onPress={() => router.push(profileHref)}
        />
      </Section>
      {me.data ? (
        <ProfileEditorSheet
          visible={editing}
          initial={{ displayName: me.data.displayName, bio: me.data.bio, country: me.data.country }}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: space[1.5], paddingVertical: space[2] },
});
