import { queryKeys } from '@tac/core/api';
import { fmtDuration, formatLocalDate } from '@tac/core/format';
import type { RunnerSnapshot } from '@tac/core/runner';
import { control, eos, layout, radii, space } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { NoteCard, StyleIcon, STRONG } from '@/features/play/ui';
import { feel } from '@/feel';
import { api } from '@/platform/api';
import { queryClient } from '@/platform/query';
import { clearActiveSnapshot } from '@/runner';
import { toast } from '@/shell/toast/store';
import { AppText, PlateButton } from '@/ui';
import type { TFn } from '@/ui/lang';
import { Tap } from '@/ui/Tap';

/**
 * PLAN §2.10 resume card, from the runner's kill-safe snapshot: Resume
 * restores the same puzzle and the remaining time (paused, so the player
 * starts the clock); Finish saves it as it stands; Discard drops it.
 */
export function ResumeCard({ snap, onGone, t }: { snap: RunnerSnapshot; onGone: () => void; t: TFn }) {
  const [busy, setBusy] = useState(false);
  const { solved, failed } = snap.counters;
  const time = fmtDuration(Math.max(0, Math.ceil(snap.remainingMs / 1000)));
  const what = [
    snap.style ? t(`style.${snap.style}.name`) : null,
    snap.sessionMode === 'theme' ? t('play.mode.theme') : t('play.mode.mixed'),
  ]
    .filter(Boolean)
    .join(' · ');

  const discard = async () => {
    setBusy(true);
    try {
      await api.sessions.finish(snap.sessionId, { save: false, localDate: formatLocalDate(new Date()) });
    } catch (e) {
      // Already gone server-side (swept, or ended elsewhere): nothing to keep.
      const status = (e as { status?: number }).status;
      if (status !== 404 && status !== 400) {
        setBusy(false);
        toast.show({ title: t('home.discard_failed') });
        return;
      }
    }
    feel.emit('discard');
    clearActiveSnapshot();
    // The server rolled the rating back to the session's start.
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    onGone();
  };

  const confirmDiscard = () => {
    feel.emit('exitSheet');
    Alert.alert(t('home.discard_title'), t('home.discard_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('home.discard'), style: 'destructive', onPress: () => void discard() },
    ]);
  };

  const id = encodeURIComponent(snap.sessionId);
  return (
    <NoteCard tone="accent" testID="home-resume-card" style={styles.card}>
      <View style={styles.head}>
        {snap.style && <StyleIcon style={snap.style} size={16} color={eos.bone} />}
        <View style={styles.flex}>
          <AppText variant="body" color={eos.bone} style={STRONG}>
            {t('home.resume_title')}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {what}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" color={eos.ash} testID="home-resume-hint">
        {t('home.resume_hint', { time, solved, failed })}
      </AppText>
      <PlateButton
        testID="home-resume"
        label={t('home.resume')}
        onPress={() => router.push(`/play/${id}` as Href)}
        disabled={busy}
        size="md"
        block
      />
      <View style={styles.actions}>
        <PlateButton
          testID="home-finish"
          label={t('home.finish')}
          variant="slate"
          onPress={() => router.push(`/play/${id}?finish=1` as Href)}
          disabled={busy}
          size="sm"
          style={styles.flex}
        />
        <Tap
          testID="home-discard"
          accessibilityRole="button"
          accessibilityLabel={t('home.discard')}
          onPress={confirmDiscard}
          disabled={busy}
          style={[styles.flex, styles.discard]}
        >
          <AppText variant="label" color={control.dangerText}>
            {t('home.discard')}
          </AppText>
        </Tap>
      </View>
    </NoteCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2.5] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  discard: {
    minHeight: layout.plateHeight.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: control.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
