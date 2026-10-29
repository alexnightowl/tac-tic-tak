import type { Language } from '@tac/core/i18n';
import { control, eos, space, tone } from '@tac/core/tokens';
import { router } from 'expo-router';
import { AlertTriangle, Bell, ChevronRight, Gamepad2, Info, KeyRound, RotateCcw, Volume2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { formatHour, useReminderPrefs } from '@/features/notifications/reminder';
import { openOnboarding } from '@/features/onboarding/gate';
import { Avatar } from '@/features/profile/Avatar';
import { APP_VERSION } from '@/platform/config';
import { toast } from '@/shell/toast/store';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AppText, ControlBlock, DangerButton, GroupedList, ListSection, PlateButton, Row, Segmented, Sheet, Tap } from '@/ui';
import { scriptLang } from '@/ui/fonts';
import { useT } from '@/ui/lang';
import { colorsTiming } from '@/ui/motion';
import { resetProgress } from './api';
import { SettingsPage } from './parts';
import { saveSettings } from './patch';

/**
 * Settings tab (design v2 MobSettings; web /settings, its three tabs
 * regrouped as a native list): the profile card, one row per section
 * screen, the App group inline (language, replay onboarding) and the
 * danger zone (reset progress → MobResetSheet).
 */
export function SettingsIndexScreen() {
  const t = useT();
  const lang = useAppStore((s) => s.settings.language);
  const reminder = useReminderPrefs();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <SettingsPage testID="screen-settings">
      <GroupedList>
        <ProfileCard />
      </GroupedList>

      <GroupedList>
        <Row
          icon={Gamepad2}
          label={t('settings.gameplay')}
          hint={t('settings.gameplay_hint')}
          testID="settings-gameplay"
          onPress={() => router.push('/settings/gameplay')}
        />
        <Row
          icon={Volume2}
          label={t('settings.sound_haptics')}
          hint={t('settings.sound_haptics_hint')}
          testID="settings-sound"
          onPress={() => router.push('/settings/sound')}
        />
        <Row
          icon={Bell}
          label={t('settings.notifications')}
          value={reminder.enabled ? formatHour(reminder.hour) : t('ui.off')}
          testID="settings-notifications"
          onPress={() => router.push('/settings/notifications')}
        />
        <Row
          icon={KeyRound}
          label={t('settings.account')}
          hint={t('settings.account_hint')}
          testID="settings-account"
          onPress={() => router.push('/settings/account')}
        />
        <Row
          icon={Info}
          label={t('settings.about')}
          value={APP_VERSION}
          testID="settings-about"
          onPress={() => router.push('/settings/about')}
        />
      </GroupedList>

      <ListSection title={t('settings.tab.app')}>
        <ControlBlock label={t('settings.language')}>
          <Segmented
            options={[
              { value: 'en', label: t('settings.lang.en') },
              { value: 'uk', label: t('settings.lang.uk') },
            ]}
            value={lang}
            onChange={(v: Language) => void saveSettings({ language: v })}
            tone="soft"
            testID="settings-lang"
            accessibilityLabel={t('settings.language')}
          />
        </ControlBlock>
        <Row
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
      </ListSection>

      <ListSection title={t('settings.section.danger')} footer={t('settings.reset_progress.body')}>
        <Row
          icon={AlertTriangle}
          label={t('settings.reset_progress.title')}
          testID="settings-reset"
          danger
          onPress={() => {
            feel.emit('exitSheet');
            setResetOpen(true);
          }}
        />
      </ListSection>

      <ResetSheet visible={resetOpen} onClose={() => setResetOpen(false)} />
    </SettingsPage>
  );
}

/**
 * The profile row: 16 pt padding, 52 pt avatar, the name in Cinzel 22
 * (in the name's own script), "Name, avatar, bio", chevron. A local `.row`
 * because the name needs its script's font (Row's label follows the UI
 * language).
 */
function ProfileCard() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const nickname = user?.nickname ?? '';
  const name = user?.displayName || nickname;
  const pressed = useSharedValue(0);
  const overlay = useAnimatedStyle(() => ({ opacity: pressed.get() }));
  return (
    <Tap
      testID="settings-profile"
      accessibilityRole="button"
      accessibilityLabel={`${t('settings.tab.profile')}, ${name}`}
      onPress={() => router.push('/settings/profile')}
      pressed={pressed}
      pressedTiming={colorsTiming}
      style={styles.me}
    >
      <Animated.View pointerEvents="none" style={[styles.pressed, overlay]} />
      <Avatar nickname={nickname} avatarUrl={user?.avatarUrl} size={52} />
      <View style={styles.meText}>
        <AppText variant="title" lang={scriptLang(name)} numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {t('settings.profile_hint')}
        </AppText>
      </View>
      <ChevronRight size={18} strokeWidth={2} color={eos.dust} />
    </Tap>
  );
}

/** MobResetSheet: the web ResetProgressSection's two-step confirm as a destructive sheet. */
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
    <WindowInsets>
      <Sheet visible={visible} onClose={close} dismissible={!busy} testID="reset-sheet" closeLabel={t('common.cancel')}>
        <View style={styles.sheetHead}>
          <AlertTriangle size={20} strokeWidth={2} color={tone.danger} />
          <AppText variant="title" color={tone.danger} style={styles.flex}>
            {t('settings.reset_progress.title')}
          </AppText>
        </View>
        <AppText variant="body" color={eos.ash}>
          {t('settings.reset_progress.body')}
        </AppText>
        <AppText variant="body">{t('settings.reset_progress.confirm')}</AppText>
        {error ? (
          <AppText variant="caption" color={tone.danger} testID="reset-error" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}
        <View style={styles.sheetButtons}>
          <DangerButton
            testID="reset-confirm"
            label={t('settings.reset_progress.confirm_cta')}
            filled
            busy={busy}
            onPress={() => void confirm()}
          />
          <PlateButton testID="reset-cancel" label={t('common.cancel')} variant="slate" block onPress={close} disabled={busy} />
        </View>
      </Sheet>
    </WindowInsets>
  );
}

/**
 * The tab scene zeroes the vertical insets (shell/TabSceneInsets) but a
 * Sheet is a full-window Modal: give it the window's own insets back so
 * its bottom padding clears the home indicator (34 + 8, as designed).
 */
function WindowInsets({ children }: { children: ReactNode }) {
  const scene = useSafeAreaInsets();
  const win = initialWindowMetrics?.insets;
  const value = win ? { ...scene, top: win.top, bottom: win.bottom } : scene;
  return <SafeAreaInsetsContext value={value}>{children}</SafeAreaInsetsContext>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  me: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  pressed: { ...StyleSheet.absoluteFill, backgroundColor: control.ghostPressBg },
  meText: { flex: 1, minWidth: 0, gap: space[0.5] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  sheetButtons: { gap: space[2.5], marginTop: space[2] },
});
