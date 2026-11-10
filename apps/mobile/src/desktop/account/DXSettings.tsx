import { LANGUAGES, type Language } from '@tac/core/i18n';
import { tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Camera, Flag, Gamepad2, Info, KeyRound, Lock, Pencil, RotateCcw, UserRound, Volume2, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { meQuery } from '@/features/auth/session';
import { Avatar } from '@/features/profile/Avatar';
import { chooseAvatar, useAvatarUpload } from '@/features/profile/avatarUpload';
import { openOnboarding } from '@/features/onboarding/gate';
import { saveSettings } from '@/features/settings/patch';
import { ResetSheet } from '@/features/settings/SettingsIndexScreen';
import { feel } from '@/feel';
import { HAS_HAPTICS } from '@/platform/capabilities';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/ui/lang';
import { HotkeyTable } from '../HotkeysDialog';
import { DesktopPage } from '../Page';
import { Card, DText, GhostButton, Hover, Seg } from '../kit';
import { dx } from '../tokens';
import { DxProfileEdit } from './DXProfileEdit';
import { LinkRow, PaneTitle, RowsCard, SettingRow, useNarrow } from './parts';

export type SettingsPane = 'general' | 'gameplay' | 'sound' | 'account' | 'about';

const NAV: readonly { pane: SettingsPane; href: string; icon: LucideIcon; label: string }[] = [
  { pane: 'general', href: '/settings', icon: UserRound, label: 'settings.tab.profile' },
  { pane: 'gameplay', href: '/settings/gameplay', icon: Gamepad2, label: 'settings.gameplay' },
  // The web has no haptics: the section is just Sound there.
  { pane: 'sound', href: '/settings/sound', icon: Volume2, label: HAS_HAPTICS ? 'settings.sound_haptics' : 'settings.sound' },
  { pane: 'account', href: '/settings/account', icon: Lock, label: 'settings.account' },
  { pane: 'about', href: '/settings/about', icon: Info, label: 'settings.about' },
];

/**
 * The desktop settings frame (DXSettings*): the page header, the 240 px
 * section list (sections, then Replay onboarding and Reset progress) and
 * the selected pane on the right. Every /settings/* route renders it with
 * its own pane; a section click replaces the route.
 */
export function DxSettingsFrame({ pane, children }: { pane: SettingsPane; children: ReactNode }) {
  const t = useT();
  const [resetOpen, setResetOpen] = useState(false);
  const narrow = useNarrow();
  return (
    <DesktopPage title={t('settings.title')} right={null} testID={`dx-settings-${pane}`}>
      <View style={[styles.cols, narrow && styles.colsNarrow]}>
        <View style={[styles.nav, narrow && styles.navNarrow]} accessibilityRole="tablist">
          {NAV.map((n) => {
            const on = n.pane === pane;
            const Icon = n.icon;
            return (
              <Hover
                key={n.pane}
                testID={`settings-nav-${n.pane}`}
                accessibilityRole="tab"
                accessibilityLabel={t(n.label)}
                selected={on}
                onPress={() => (on ? undefined : router.replace(n.href as Href))}
                style={[styles.navItem, on && styles.navOn]}
              >
                <Icon size={16} color={on ? dx.navOnText : dx.ash} strokeWidth={1.8} />
                <DText size={14} weight={700} color={on ? dx.navOnText : dx.ash} numberOfLines={1}>
                  {t(n.label)}
                </DText>
              </Hover>
            );
          })}
          <View style={styles.navRule} />
          <Hover
            testID="settings-replay-onboarding"
            accessibilityLabel={t('settings.replay_onboarding')}
            onPress={() => {
              void saveSettings({ onboardingCompleted: false });
              openOnboarding();
            }}
            style={styles.navItem}
          >
            <RotateCcw size={16} color={dx.ash} strokeWidth={1.8} />
            <DText size={14} weight={700} color={dx.ash} numberOfLines={1}>
              {t('settings.replay_onboarding')}
            </DText>
          </Hover>
          <Hover
            testID="settings-reset"
            accessibilityLabel={t('settings.reset_progress.title')}
            onPress={() => {
              feel.emit('exitSheet');
              setResetOpen(true);
            }}
            style={styles.navItem}
          >
            <Flag size={16} color={tone.roseSoft} strokeWidth={1.8} />
            <DText size={14} weight={700} color={tone.roseSoft} numberOfLines={1}>
              {t('settings.reset_progress.title')}
            </DText>
          </Hover>
        </View>
        <View style={styles.pane}>{children}</View>
      </View>
      <ResetSheet visible={resetOpen} onClose={() => setResetOpen(false)} />
    </DesktopPage>
  );
}

/**
 * DXSettings (/settings, /settings/profile): the profile row (avatar, name,
 * Edit) with the phone's Change avatar, Change password and View my profile
 * rows, the interface language, keyboard shortcuts.
 */
export function DxSettings() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const authed = useAuthStore((s) => s.status === 'authed');
  const me = useQuery({ ...meQuery, enabled: authed });
  const lang = useAppStore((s) => s.settings.language);
  const [editing, setEditing] = useState(false);
  const preview = useAvatarUpload((s) => s.previewUri);
  const uploading = useAvatarUpload((s) => s.uploading);
  const nickname = user?.nickname ?? '';
  const country = me.data?.country;
  const profileHref = `/profile/${encodeURIComponent(nickname)}` as Href;

  return (
    <DxSettingsFrame pane="general">
      <PaneTitle>{t('settings.tab.profile')}</PaneTitle>
      <RowsCard style={styles.mt14}>
        <SettingRow
          first
          title={user?.displayName || nickname}
          hint={[`@${nickname}`, country ? country.toUpperCase() : null].filter(Boolean).join(' · ')}
          testID="settings-profile"
          leading={<Avatar nickname={nickname} avatarUrl={user?.avatarUrl} previewUri={preview} size={44} />}
        >
          <GhostButton
            testID="settings-profile-edit"
            accessibilityLabel={t('profile.edit_title')}
            icon={Pencil}
            label={t('profile.edit')}
            // The editor seeds from /users/me; until it loads, the profile page edits.
            onPress={() => (me.data ? setEditing(true) : router.push(profileHref))}
          />
        </SettingRow>
        <LinkRow
          icon={Camera}
          title={uploading ? t('profile.avatar_uploading') : t('profile.change_avatar')}
          testID="settings-profile-avatar"
          onPress={chooseAvatar}
        />
        <LinkRow icon={KeyRound} title={t('profile.change_password')} testID="settings-profile-password" onPress={() => router.replace('/settings/account' as Href)} />
        <LinkRow icon={UserRound} title={t('settings.profile.view')} testID="settings-profile-view" onPress={() => router.push(profileHref)} />
        <SettingRow title={t('dx.account.ui_language')} hint={t('dx.account.ui_language_hint')}>
          <Seg
            options={LANGUAGES.map((l) => ({ value: l, label: t(`settings.lang.${l}`) }))}
            value={lang}
            onChange={(v: Language) => {
              feel.emit('segmented');
              void saveSettings({ language: v });
            }}
            small
            testID="settings-lang"
            accessibilityLabel={t('settings.language')}
            style={styles.langSeg}
          />
        </SettingRow>
      </RowsCard>

      <PaneTitle style={styles.mt28}>{t('dx.shell.hotkeys')}</PaneTitle>
      <Card style={styles.keys} testID="settings-hotkeys">
        <HotkeyTable />
      </Card>

      {editing && me.data ? (
        <DxProfileEdit
          initial={{ displayName: me.data.displayName, bio: me.data.bio, country: me.data.country }}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </DxSettingsFrame>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  colsNarrow: { gap: 20 },
  nav: { width: 240, gap: 4 },
  navNarrow: { width: 196 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 42, paddingHorizontal: 14, borderRadius: 10 },
  navOn: {
    backgroundColor: dx.navOn,
    boxShadow: [{ offsetX: 3, offsetY: 0, blurRadius: 0, spreadDistance: 0, color: dx.ember, inset: true }],
  },
  navRule: { height: 1, backgroundColor: dx.rowRule, marginVertical: 10 },
  pane: { flex: 1, minWidth: 0 },
  mt14: { marginTop: 14 },
  mt28: { marginTop: 28 },
  langSeg: { width: 420 },
  keys: { marginTop: 14, paddingVertical: 16, paddingHorizontal: 22 },
});
