import { OFFLINE_PACK_KINDS, TOP_UP_TARGET, type OfflineSyncSummary } from '@tac/core/offline';
import { alpha, control, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { ArrowRight, Check, Flame, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, HeroCard, IconButton, PlateButton, SectionLabel } from '@/ui';
import { useT, useTn, type TFn } from '@/ui/lang';
import { plural } from './format';
import { unplayedOf, useOfflineStore, type PackKey } from './store';
import { topUp } from './sync';

// /offline/synced (OfflineSync artboard): the "Welcome back" summary after
// a sync posted results, with the server's real numbers.

const KEYS: readonly PackKey[] = [...OFFLINE_PACK_KINDS, 'review'];
const KEPT = new Set(['continued', 'same-day', 'started', 'frozen']);

function formatTime(ms: number, t: TFn): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? t('offline.time_s', { n: s }) : t('offline.time_m', { n: Math.round(s / 60) });
}

export function SyncedScreen() {
  const summary = useOfflineStore((s) => s.summary);
  if (!summary) return <View style={styles.root} testID="offline-synced" />;
  return <Synced summary={summary} />;
}

function Synced({ summary }: { summary: OfflineSyncSummary }) {
  const t = useT();
  const tn = useTn();
  const insets = useSafeAreaInsets();
  const left = useOfflineStore((s) => KEYS.reduce((n, k) => n + unplayedOf(s, k).length, 0));
  const [refilling, setRefilling] = useState(false);
  const [refillFailed, setRefillFailed] = useState(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as Href);
  };
  const refill = async () => {
    setRefilling(true);
    setRefillFailed(false);
    const r = await topUp();
    setRefilling(false);
    if (r === 'ok') router.replace('/offline' as Href);
    else setRefillFailed(true);
  };

  const streak = summary.streak;
  const kept = streak && KEPT.has(streak.outcome);
  const mistakes = summary.mistakesToReview;
  const lineParts = [
    mistakes > 0 ? plural(tn, 'offline.mistakes_sent', mistakes) : t('offline.no_mistakes'),
    summary.reviewResolved > 0 ? plural(tn, 'offline.review_cleared', summary.reviewResolved) : null,
    plural(tn, 'offline.left', left),
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(space[6], insets.bottom) }]} testID="offline-synced">
      <View style={styles.header}>
        <IconButton
          variant="plain"
          testID="offline-synced-close"
          accessibilityLabel={t('offline.close')}
          onPress={close}
          icon={<X size={18} color={eos.ash} strokeWidth={1.8} />}
        />
      </View>
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.center}>
          <View style={styles.disc}>
            <Check size={30} color={tone.sage} strokeWidth={1.8} />
          </View>
          <AppText variant="heading" style={styles.title} accessibilityRole="header">
            {t('offline.welcome')}
          </AppText>
          <AppText variant="body" color={eos.ash} style={styles.centerText} testID="offline-synced-count">
            {plural(tn, 'offline.synced', summary.synced)}
          </AppText>
        </View>

        {summary.ratings.map((r) => {
          const up = r.delta >= 0;
          const style = t(`style.${r.style}.name`);
          return (
            <HeroCard key={r.style} style={styles.hero} testID={`offline-rating-${r.style}`}>
              <SectionLabel size="section">{t('offline.rating_caught_up')}</SectionLabel>
              <View
                style={styles.ratingRow}
                accessible
                accessibilityLabel={t('offline.rating_delta_a11y', { style, before: r.before, after: r.after })}
              >
                <AppText variant="valueSm" color={eos.dust} style={styles.strike}>
                  {String(r.before)}
                </AppText>
                <ArrowRight size={16} color={eos.ash} strokeWidth={1.8} />
                <AppText variant="sectionTitle" style={styles.tabular} testID="offline-rating-after">
                  {String(r.after)}
                </AppText>
                <View style={[styles.delta, { backgroundColor: up ? control.sageTint16 : alpha(tone.rose, 0.16) }]}>
                  <AppText variant="captionStrong" color={up ? tone.sage : tone.rose} testID="offline-rating-delta">
                    {up ? `+${r.delta}` : `−${Math.abs(r.delta)}`}
                  </AppText>
                </View>
              </View>
              <AppText variant="caption" style={styles.ratingSub}>
                {t('offline.rating_order', { style })}
              </AppText>
            </HeroCard>
          );
        })}

        {summary.total > 0 ? (
          <View style={styles.stats}>
            <Stat label={t('offline.stat_solved')} value={`${summary.solved} / ${summary.total}`} testID="offline-stat-solved" />
            <Stat label={t('offline.stat_accuracy')} value={`${Math.round(summary.accuracy * 100)}%`} testID="offline-stat-accuracy" />
            <Stat label={t('offline.stat_time')} value={formatTime(summary.timeMs, t)} testID="offline-stat-time" />
          </View>
        ) : null}

        {streak ? (
          <View style={styles.streak} testID="offline-streak">
            <Flame size={20} color={tone.rose} strokeWidth={1.8} />
            <AppText variant="caption" color={eos.ash} style={styles.flex}>
              {kept ? (
                <>
                  <AppText variant="captionStrong" color={eos.bone}>
                    {plural(tn, 'offline.streak_kept', streak.days)}
                  </AppText>
                  {` ${t('offline.streak_rule')}`}
                </>
              ) : (
                t('offline.streak_late')
              )}
            </AppText>
          </View>
        ) : null}

        <AppText variant="caption" color={eos.ash} testID="offline-synced-line">
          {lineParts.filter(Boolean).join(' ')}
        </AppText>
        {refillFailed ? (
          <AppText variant="caption" color={tone.rose} testID="offline-refill-failed">
            {t('offline.refill_failed')}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.bottom}>
        <PlateButton
          testID="offline-refill"
          label={t('offline.refill', { n: TOP_UP_TARGET })}
          size="lg"
          block
          loading={refilling}
          onPress={() => void refill()}
        />
        {mistakes > 0 ? (
          <PlateButton
            testID="offline-review-mistakes"
            label={plural(tn, 'offline.review_mistakes', mistakes)}
            variant="slate"
            size="md"
            block
            onPress={() => router.dismissTo('/review' as Href)}
          />
        ) : null}
      </View>
    </View>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="label" color={eos.ash}>
        {label}
      </AppText>
      <AppText variant="valueSm" style={styles.tabular} testID={testID} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  main: { paddingTop: space[3], paddingHorizontal: layout.gutter, paddingBottom: space[4], gap: space[4] },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center', marginTop: space[1.5] },
  disc: { width: space[16], height: space[16], borderRadius: radii.full, backgroundColor: control.sageTint16, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: space[3.5], textAlign: 'center' },
  hero: { padding: space[4] },
  ratingRow: { marginTop: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  strike: { textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  delta: { height: space[6], paddingHorizontal: 9, borderRadius: radii.full, justifyContent: 'center' },
  ratingSub: { marginTop: space[1] },
  stats: { flexDirection: 'row', gap: space[2.5] },
  stat: { flex: 1, minWidth: 0, padding: space[3], borderRadius: radii.xl, backgroundColor: eos.slate, gap: space[0.5] },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3.5],
    paddingVertical: space[3],
    borderRadius: radii.xl,
    backgroundColor: eos.shade,
    borderWidth: 1,
    borderColor: eos.seam,
  },
  bottom: { paddingHorizontal: layout.gutter, gap: space[2.5] },
});
