import { isApiError, type SessionDetail } from '@tac/core/api';
import { control, eos, layout, radii, space } from '@tac/core/tokens';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { Check, ChevronRight, CloudOff, SearchX, X } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { reviewKeys, sessionApi } from '@/features/review/api';
import { Skeleton, StateView } from '@/features/review/states';
import { AppText, Card, PlateButton, stackHeader } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { formatSessionTitle, pct, responseTime, sessionThemeLabel } from './format';

/** MobSessions / MobSessionDetail: the `.float` round back button. */
const FLOAT_HEADER = stackHeader('float');

type Attempt = SessionDetail['attempts'][number];

/**
 * /sessions/[id] (push): headline stats, the mistakes CTA and the attempt
 * list. fix: the web showed a bare '…' forever on 404 and hard-coded every
 * string; here loading, error and not-found are designed states.
 */
export function SessionDetailScreen({ id }: { id: string }) {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const q = useQuery({
    queryKey: reviewKeys.session(id),
    queryFn: () => sessionApi.detail(id),
    retry: (n, e) => !(isApiError(e) && e.status === 404) && n < 1,
  });
  // Shared with the mistakes runner (the web used two different fetches).
  const items = useQuery({
    queryKey: reviewKeys.sessionReviewItems(id),
    queryFn: () => sessionApi.reviewItems(id),
    staleTime: 60_000,
    enabled: q.isSuccess,
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    try {
      await Promise.all([q.refetch(), items.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const title = <Stack.Screen options={{ title: t('sessions.detail_title'), header: FLOAT_HEADER }} />;

  if (q.isPending) {
    return (
      <View style={styles.root} testID="screen-session">
        {title}
        <View style={styles.pad} testID="session-loading">
          <Skeleton style={styles.skTitle} />
          <View style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} style={styles.skStat} />
            ))}
          </View>
          <Skeleton style={styles.skBlock} />
        </View>
      </View>
    );
  }
  if (q.isError && !q.data) {
    const missing = isApiError(q.error) && q.error.status === 404;
    return (
      <View style={styles.root} testID="screen-session">
        {title}
        <StateView
          testID={missing ? 'session-not-found' : 'session-error'}
          icon={missing ? <SearchX size={24} color={eos.ash} /> : <CloudOff size={24} color={eos.ash} />}
          title={missing ? t('sessions.not_found') : t('sessions.error')}
          action={
            missing
              ? { label: t('review.back'), testID: 'session-back', onPress: () => router.back() }
              : { label: t('sessions.retry'), testID: 'session-retry', onPress: () => void q.refetch() }
          }
          style={styles.flex}
        />
      </View>
    );
  }

  const s = q.data;
  const failed = items.data?.items.filter((i) => i.reason === 'failed').length ?? 0;
  const slow = (items.data?.items.length ?? 0) - failed;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <AppText variant="title" accessibilityRole="header" testID="session-title">
          {formatSessionTitle(s.startedAt, lang)}
        </AppText>
        <AppText variant="body" color={eos.ash} testID="session-subtitle">
          {`${sessionThemeLabel(s.theme, lang, t('sessions.mixed'))} · ${t('sessions.minutes', { n: Math.round(s.durationSec / 60) })}`}
        </AppText>
      </View>
      <View style={styles.grid}>
        <Stat label={t('sessions.start')} value={String(s.startRating)} testID="session-start" />
        <Stat label={t('sessions.peak')} value={String(s.peakRating)} testID="session-peak" />
        <Stat label={t('sessions.accuracy')} value={pct(s.accuracy)} testID="session-accuracy" />
        <Stat label={t('sessions.avg_response')} value={responseTime(s.avgResponseMs)} testID="session-avg" />
        <Stat label={t('sessions.solved')} value={String(s.solved)} color={eos.sage} testID="session-solved" />
        <Stat label={t('sessions.failed')} value={String(s.failed)} color={eos.rose} testID="session-failed" />
      </View>
      {items.data && items.data.items.length > 0 ? (
        <Card style={styles.cta} testID="session-review-cta">
          <AppText variant="eyebrow">{t('review.session_heading')}</AppText>
          <AppText variant="body" color={eos.ash}>
            {t('review.session_hint', { failed, slow })}
          </AppText>
          <PlateButton
            label={t('review.session_cta')}
            testID="session-review-mistakes"
            variant="ember"
            size="md"
            block
            onPress={() => router.push(`/sessions/${encodeURIComponent(id)}/review` as Href)}
          />
        </Card>
      ) : null}
      <View style={styles.attemptsHead}>
        <AppText variant="sectionLabel">{t('sessions.attempts')}</AppText>
        <AppText variant="caption" testID="session-attempt-count">
          {String(s.attempts.length)}
        </AppText>
      </View>
    </View>
  );

  return (
    <View style={styles.root} testID="screen-session">
      {title}
      <FlashList
        data={s.attempts}
        keyExtractor={(a) => a.id}
        renderItem={({ item, index }) => <AttemptRow attempt={item} index={index} t={t} />}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <AppText variant="body" color={eos.ash} style={styles.empty} testID="session-no-attempts">
            {t('sessions.no_attempts')}
          </AppText>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space[6] }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ember} colors={[eos.ember]} />}
        testID="session-attempts"
      />
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function Stat({ label, value, color, testID }: { label: string; value: string; color?: string; testID: string }) {
  return (
    <Card style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="value" color={color} testID={testID} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </Card>
  );
}

function AttemptRow({ attempt: a, index, t }: { attempt: Attempt; index: number; t: TFn }) {
  const time = responseTime(a.responseMs);
  return (
    <Tap
      testID={`session-attempt-${index}`}
      accessibilityRole="button"
      accessibilityLabel={t('sessions.attempt_a11y', {
        n: index + 1,
        result: t(a.correct ? 'sessions.attempt_correct' : 'sessions.attempt_wrong'),
        rating: a.puzzleRating,
        time,
      })}
      onPress={() => router.push(`/puzzles/${encodeURIComponent(a.puzzleId)}` as Href)}
    >
      <Card style={styles.row}>
        <AppText variant="caption" style={styles.index}>
          {String(index + 1)}
        </AppText>
        <View style={[styles.mark, { backgroundColor: a.correct ? control.sageTint16 : control.emberTint16 }]}>
          {a.correct ? <Check size={14} color={eos.sage} /> : <X size={14} color={eos.rose} />}
        </View>
        <AppText variant="body" style={styles.rowRating}>
          {String(a.puzzleRating)}
        </AppText>
        <AppText variant="caption" style={styles.tabular} testID={`session-attempt-${index}-time`}>
          {time}
        </AppText>
        <ChevronRight size={16} color={eos.dust} />
      </Card>
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  pad: { padding: layout.gutter, gap: space[3] },
  listContent: { paddingHorizontal: layout.gutter },
  header: { gap: space[3], paddingTop: space[3], paddingBottom: space[3] },
  titleBlock: { gap: space[1] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2.5] },
  stat: { flexBasis: '47%', flexGrow: 1, gap: space[1], padding: space[3] },
  cta: { gap: space[2.5], marginTop: space[1] },
  attemptsHead: { flexDirection: 'row', alignItems: 'baseline', gap: space[2], marginTop: space[2] },
  gap: { height: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2.5], paddingHorizontal: space[3], borderRadius: radii.xl },
  index: { width: space[5], textAlign: 'right' },
  mark: { width: space[7], height: space[7], borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  rowRating: { flex: 1, fontVariant: ['tabular-nums'] },
  tabular: { fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: space[4], textAlign: 'center' },
  skTitle: { height: space[12] },
  skStat: { height: space[16] + space[2], flexBasis: '47%', flexGrow: 1 },
  skBlock: { height: space[20] * 2 },
});
