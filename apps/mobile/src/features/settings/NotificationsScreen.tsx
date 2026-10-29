import { formatLocalDate, localeFor } from '@tac/core/format';
import { control, eos, radii, space } from '@tac/core/tokens';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { DEV_MENU } from '@/dev/flags';
import {
  formatHour,
  getPermission,
  getScheduledReminders,
  onRemindersSynced,
  setReminderEnabled,
  setReminderHour,
  syncReminders,
  useReminderPrefs,
  type PermissionState,
  type ScheduledReminder,
} from '@/features/notifications/reminder';
import { feel } from '@/feel';
import { useAppStore } from '@/stores/appStore';
import { AppText, ControlBlock, ListSection, PlateButton, Tap, ToggleRow } from '@/ui';
import { useT } from '@/ui/lang';
import { SettingsPage } from './parts';

// Settings › Notifications (design v2 MobNotifications): the local daily streak reminder (PLAN §2.9 /
// Phase 9). Remote pushes (friend requests, achievements) come in Phase 10
// with accounts; their switches will join this screen then.

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function NotificationsScreen() {
  const t = useT();
  const lang = useAppStore((s) => s.settings.language);
  const prefs = useReminderPrefs();
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledReminder[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void getPermission().then(setPerm);
    void getScheduledReminders().then(setScheduled);
  }, []);

  // Back from system settings: the permission may have changed; re-plan.
  useFocusEffect(
    useCallback(() => {
      void syncReminders();
      refresh();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') refresh();
      });
      return () => sub.remove();
    }, [refresh]),
  );
  useEffect(() => onRemindersSynced(refresh), [refresh]);

  const toggle = async (on: boolean) => {
    setBusy(true);
    const p = await setReminderEnabled(on);
    setPerm(p);
    setBusy(false);
    if (on && p !== 'granted') feel.emit('formError');
  };

  const next = scheduled.find((s) => s.id.startsWith('streak-reminder-') && s.at);

  return (
    <SettingsPage testID="screen-settings-notifications" title={t('settings.notifications')}>
      <ListSection
        footer={prefs.enabled ? (next?.at ? t('settings.reminder_next', { when: describe(next.at, lang, t) }) : t('settings.reminder_none')) : null}
      >
        <ToggleRow
          label={t('settings.reminder')}
          hint={t('settings.reminder_hint')}
          value={prefs.enabled}
          onChange={(v) => void toggle(v)}
          disabled={busy}
          testID="settings-reminder-toggle"
        />
        <ControlBlock label={t('settings.reminder_time')}>
          <View style={[styles.hours, !prefs.enabled && styles.off]} accessibilityRole="radiogroup" testID="reminder-hours">
            {HOURS.map((h) => {
              const active = h === prefs.hour;
              const label = formatHour(h);
              return (
                <Tap
                  key={h}
                  testID={`reminder-hour-${h}`}
                  accessibilityRole="radio"
                  accessibilityLabel={t('settings.reminder_hour_a11y', { time: label })}
                  accessibilityState={{ checked: active, disabled: !prefs.enabled }}
                  disabled={!prefs.enabled}
                  onPress={() => {
                    if (active) return;
                    feel.emit('segmented');
                    void setReminderHour(h);
                  }}
                  style={[styles.hour, active && styles.hourActive]}
                >
                  <AppText variant="segmentedSm" color={active ? control.segmentedActiveText : eos.ash} numberOfLines={1}>
                    {String(h).padStart(2, '0')}
                  </AppText>
                </Tap>
              );
            })}
          </View>
        </ControlBlock>
      </ListSection>

      <ListSection title={t('settings.perm.title')}>
        <ControlBlock testID="reminder-permission">
          <AppText variant="body" testID={`reminder-permission-${perm ?? 'unknown'}`}>
            {perm === 'granted'
              ? t('settings.perm.granted')
              : perm === 'denied'
                ? t('settings.perm.denied')
                : t('settings.perm.undetermined')}
          </AppText>
          {perm === 'denied' ? (
            <PlateButton
              testID="reminder-open-settings"
              label={t('settings.perm.open')}
              variant="slate"
              size="sm"
              style={styles.start}
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </ControlBlock>
      </ListSection>

      {DEV_MENU ? (
        // Dev builds: what the OS actually holds (09-reminder asserts on it).
        <AppText variant="caption" testID="reminder-scheduled" style={styles.dev}>
          {t('settings.reminder_scheduled', {
            list: scheduled.length ? scheduled.map((s) => (s.at ? stamp(s.at) : s.id)).join(', ') : '—',
          })}
        </AppText>
      ) : null}
    </SettingsPage>
  );
}

/** "today at 20:00" / "tomorrow at 20:00" / "Mon 28 Oct at 20:00". */
function describe(at: Date, lang: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const time = formatHour(at.getHours(), at);
  const day = formatLocalDate(at);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (day === formatLocalDate(now)) return t('settings.reminder_today', { time });
  if (day === formatLocalDate(tomorrow)) return t('settings.reminder_tomorrow', { time });
  const date = at.toLocaleDateString(localeFor(lang), { weekday: 'short', day: 'numeric', month: 'short' });
  return t('settings.reminder_later', { date, time });
}

/** Machine-readable local time for the dev readout: 2026-10-25T20:00. */
function stamp(at: Date): string {
  return `${formatLocalDate(at)}T${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5] },
  off: { opacity: 0.5 },
  start: { alignSelf: 'flex-start' },
  hour: {
    width: '14.5%',
    flexGrow: 1,
    // 44 pt: the hit-target floor (CLAUDE.md rule 7).
    height: 44,
    borderRadius: radii.control,
    backgroundColor: eos.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourActive: { backgroundColor: control.segmentedActiveBg },
  dev: { paddingHorizontal: space[1], color: eos.dust },
});
