import type { Language } from '@tac/core/i18n';
import { control, eos, layout, radii, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import { AlertTriangle, Bell, ChevronRight, Gamepad2, Info, KeyRound, RotateCcw, Volume2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { feel } from '@/feel';
import { useReminderPrefs, formatHour } from '@/features/notifications/reminder';
import { openOnboarding } from '@/features/onboarding/gate';
import { APP_VERSION } from '@/platform/config';
import { Avatar } from '@/features/profile/Avatar';
import { toast } from '@/shell/toast/store';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { scriptLang } from '@/ui/fonts';
import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { Segmented } from '@/ui/Segmented';
import { Tap } from '@/ui/Tap';
import { resetProgress } from './api';
import { BottomSheet, ControlRow, NavRow, Section, SettingsPage } from './parts';
import { saveSettings } from './patch';

/**
 * Settings home (web /settings, its three tabs regrouped as a native
 * list): the profile card, one row per section screen, and the web's App
 * tab inline (language, replay onboarding, reset progress).
 */
export function SettingsIndexScreen() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const lang = useAppStore((s) => s.settings.language);
  const reminder = useReminderPrefs();
  const [resetOpen, setResetOpen] = useState(false);
  const nickname = user?.nickname ?? '';

  return (
    <SettingsPage testID="screen-settings" title={t('settings.title')}>
      <Section>
        <Tap
          testID="settings-profile"
          accessibilityRole="button"
          accessibilityLabel={`${t('settings.tab.profile')}, ${user?.displayName || nickname}`}
          onPress={() => router.push('/settings/profile')}
          style={styles.me}
        >
          <Avatar nickname={nickname} avatarUrl={user?.avatarUrl} size={52} />
          <View style={styles.meText}>
            <AppText variant="title" lang={scriptLang(user?.displayName || nickname)} numberOfLines={1}>
              {user?.displayName || nickname}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {t('settings.profile_hint')}
            </AppText>
          </View>
          <ChevronRight size={18} color={eos.dust} />
        </Tap>
      </Section>

      <Section>
        <NavRow
          icon={Gamepad2}
          label={t('settings.gameplay')}
          hint={t('settings.gameplay_hint')}
          testID="settings-gameplay"
          onPress={() => router.push('/settings/gameplay')}
        />
        <NavRow
          icon={Volume2}
          label={t('settings.sound_haptics')}
          hint={t('settings.sound_haptics_hint')}
          testID="settings-sound"
          onPress={() => router.push('/settings/sound')}
        />
        <NavRow
          icon={Bell}
          label={t('settings.notifications')}
          value={reminder.enabled ? formatHour(reminder.hour, lang) : t('ui.off')}
          testID="settings-notifications"
          onPress={() => router.push('/settings/notifications')}
        />
        <NavRow
          icon={KeyRound}
          label={t('settings.account')}
          hint={t('settings.account_hint')}
          testID="settings-account"
          onPress={() => router.push('/settings/account')}
        />
        <NavRow
          icon={Info}
          label={t('settings.about')}
          value={APP_VERSION}
          testID="settings-about"
          onPress={() => router.push('/settings/about')}
        />
      </Section>

      <Section title={t('settings.tab.app')}>
        <ControlRow label={t('settings.language')}>
          <Segmented
            options={[
              { value: 'en', label: t('settings.lang.en') },
              { value: 'uk', label: t('settings.lang.uk') },
            ]}
            value={lang}
            onChange={(v: Language) => void saveSettings({ language: v })}
            testID="settings-lang"
            accessibilityLabel={t('settings.language')}
          />
        </ControlRow>
        <NavRow
          icon={RotateCcw}
          label={t('settings.replay_onboarding')}
          hint={t('settings.replay_onboarding_hint')}
          testID="settings-replay-onboarding"
          onPress={() => {
            // Web flipped the flag and the global modal reappeared; here the
            // modal opens directly and marks it done again when closed.
            void saveSettings({ onboardingCompleted: false });
            openOnboarding();
          }}
        />
      </Section>

      <Section title={t('settings.section.danger')} footer={t('settings.reset_progress.body')}>
        <NavRow
          icon={AlertTriangle}
          label={t('settings.reset_progress.title')}
          testID="settings-reset"
          danger
          onPress={() => {
            feel.emit('exitSheet');
            setResetOpen(true);
          }}
        />
      </Section>

      <ResetSheet visible={resetOpen} onClose={() => setResetOpen(false)} />
    </SettingsPage>
  );
}

/** web ResetProgressSection's inline two-step confirm, as a destructive sheet. */
function ResetSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  const confirm = async () => {
    feel.emit('discard');
    setBusy(true);
    setError(null);
    try {
      await resetProgress();
      setBusy(false);
      onClose();
      toast.show({ title: t('settings.reset_progress.done') });
      // Web: router.push('/dashboard').
      router.navigate('/');
    } catch {
      setBusy(false);
      feel.emit('formError');
      setError(t('settings.reset_progress.failed'));
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close} testID="reset-sheet" closeLabel={t('common.cancel')}>
      <View style={styles.sheetHead}>
        <AlertTriangle size={20} color={control.dangerText} />
        <AppText variant="title" color={control.dangerText}>
          {t('settings.reset_progress.title')}
        </AppText>
      </View>
      <AppText variant="body" color={eos.ash}>
        {t('settings.reset_progress.body')}
      </AppText>
      <AppText variant="body">{t('settings.reset_progress.confirm')}</AppText>
      {error ? (
        <AppText variant="caption" color={control.dangerText} testID="reset-error">
          {error}
        </AppText>
      ) : null}
      <View style={styles.sheetButtons}>
        <Tap
          testID="reset-confirm"
          accessibilityRole="button"
          accessibilityLabel={t('settings.reset_progress.confirm_cta')}
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={() => void confirm()}
          style={[styles.danger, busy && styles.busy]}
        >
          <AppText variant="plateLabel" color={control.dangerText}>
            {busy ? '…' : t('settings.reset_progress.confirm_cta')}
          </AppText>
        </Tap>
        <PlateButton testID="reset-cancel" label={t('common.cancel')} variant="slate" block onPress={close} disabled={busy} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  meText: { flex: 1, minWidth: 0, gap: space[0.5] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  sheetButtons: { gap: space[2.5], marginTop: space[2] },
  danger: {
    height: layout.plateHeight.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: control.dangerBorder,
    backgroundColor: control.dangerPressBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.6 },
});
