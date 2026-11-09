import { isApiError, type SessionDetail } from '@tac/core/api';
import { alpha, eos } from '@tac/core/tokens';
import { router, Stack, type Href } from 'expo-router';
import { Check, ChevronRight, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { formatSessionTitle, pct, responseTime, sessionKindLabel } from '@/features/sessions/format';
import { useSessionDetail } from '@/features/sessions/useSessionDetail';
import { PlateButton } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { Card, DText, Hover, Label, Num, StatTile, TextButton, Tile } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { TWO_COLUMN_MIN, useWidth } from './layout';

/** The desktop page draws its own header. */
const NO_HEADER = { headerShown: false } as const;

type Attempt = SessionDetail['attempts'][number];

/**
 * /sessions/[id] on a desktop window (no artboard; the DX visual language):
 * "← History", the six headline tiles in a row, the attempts table and, on
 * the right, the "repeat this session" card. Same data as the phone screen
 * (useSessionDetail).
 */
export function DxSessionDetail({ id }: { id: string }) {
  const t = useT();
  const { lang } = useLang();
  const { q, items, failed, slow } = useSessionDetail(id);
  const [width, onLayout] = useWidth();
  const two = width === 0 || width >= TWO_COLUMN_MIN;
  const back = { label: t('sessions.title'), onPress: () => (router.canGoBack() ? router.back() : router.navigate('/sessions' as Href)) };

  if (q.isPending || (q.isError && !q.data)) {
    const missing = q.isError && isApiError(q.error) && q.error.status === 404;
    return (
      <DesktopPage title={t('sessions.detail_title')} back={back} testID="screen-session">
        <Stack.Screen options={NO_HEADER} />
        {q.isPending ? (
          <Card style={styles.placeholder} testID="session-loading" />
        ) : (
          <Card style={styles.state} testID={missing ? 'session-not-found' : 'session-error'}>
            <DText size={14} color={dx.ash}>
              {missing ? t('sessions.not_found') : t('sessions.error')}
            </DText>
            {!missing ? (
              <TextButton label={t('sessions.retry')} testID="session-retry" accessibilityLabel={t('sessions.retry')} onPress={() => void q.refetch()} />
            ) : null}
          </Card>
        )}
      </DesktopPage>
    );
  }

  const s = q.data!;
  const subtitle = `${sessionKindLabel(s, lang, t)} · ${t('sessions.minutes', { n: Math.round(s.durationSec / 60) })}`;
  const review =
    items.data && items.data.items.length > 0 ? (
      <Card texture style={styles.cta} testID="session-review-cta">
        <Label color={dx.rose}>{t('review.session_heading')}</Label>
        <DText size={13.5} color={dx.ash} lh={20}>
          {t('review.session_hint', { failed, slow })}
        </DText>
        <PlateButton
          label={t('review.session_cta')}
          testID="session-review-mistakes"
          variant="ember"
          size="md"
          block
          onPress={() => router.push(`/sessions/${encodeURIComponent(id)}/review` as Href)}
        />
      </Card>
    ) : null;

  return (
    <DesktopPage title={formatSessionTitle(s.startedAt, lang)} back={back} testID="screen-session">
      <Stack.Screen options={NO_HEADER} />
      <View style={styles.body} onLayout={onLayout}>
        <DText size={13.5} color={dx.ash} testID="session-subtitle">
          {subtitle}
        </DText>
        <View style={styles.tiles}>
          <StatTile style={styles.tile} label={t('sessions.start')} value={String(s.startRating)} testID="session-start" />
          <StatTile style={styles.tile} label={t('sessions.peak')} value={String(s.peakRating)} testID="session-peak" />
          <StatTile style={styles.tile} label={t('sessions.accuracy')} value={pct(s.accuracy)} testID="session-accuracy" />
          <StatTile style={styles.tile} label={t('sessions.avg_response')} value={responseTime(s.avgResponseMs)} testID="session-avg" />
          <ColorTile label={t('sessions.solved')} value={String(s.solved)} color={dx.sage} testID="session-solved" />
          <ColorTile label={t('sessions.failed')} value={String(s.failed)} color={dx.rose} testID="session-failed" />
        </View>
        <View style={two ? styles.cols : styles.stack}>
          {!two ? review : null}
          <Card style={styles.flex} testID="session-attempts">
            <View style={styles.head}>
              <Label>{t('sessions.attempts')}</Label>
              <DText size={12} color={dx.dust} tabular testID="session-attempt-count">
                {String(s.attempts.length)}
              </DText>
            </View>
            {s.attempts.length === 0 ? (
              <DText size={14} color={dx.ash} style={styles.empty} testID="session-no-attempts">
                {t('sessions.no_attempts')}
              </DText>
            ) : null}
            {s.attempts.map((a, i) => (
              <AttemptLine key={a.id} attempt={a} index={i} t={t} />
            ))}
          </Card>
          {two && review ? <View style={styles.aside}>{review}</View> : null}
        </View>
      </View>
    </DesktopPage>
  );
}

/** A headline tile whose number wears the phone's colour (Solved sage, Failed rose). */
function ColorTile({ label, value, color, testID }: { label: string; value: string; color: string; testID: string }) {
  return (
    <Tile style={styles.tile} testID={testID}>
      <Label size={10.5}>{label}</Label>
      <Num color={color} style={styles.mt8}>
        {value}
      </Num>
    </Tile>
  );
}

function AttemptLine({ attempt: a, index, t }: { attempt: Attempt; index: number; t: TFn }) {
  const time = responseTime(a.responseMs);
  return (
    <Hover
      testID={`session-attempt-${index}`}
      accessibilityLabel={t('sessions.attempt_a11y', {
        n: index + 1,
        result: t(a.correct ? 'sessions.attempt_correct' : 'sessions.attempt_wrong'),
        rating: a.puzzleRating,
        time,
      })}
      onPress={() => router.push(`/puzzles/${encodeURIComponent(a.puzzleId)}` as Href)}
      style={styles.row}
    >
      <DText size={12.5} color={dx.dust} tabular style={styles.idx}>
        {String(index + 1)}
      </DText>
      <View style={[styles.mark, { backgroundColor: alpha(a.correct ? dx.sage : eos.ember, 0.16) }]}>
        {a.correct ? <Check size={14} color={dx.sage} /> : <X size={14} color={dx.rose} />}
      </View>
      <DText size={13.5} color={dx.ash} style={styles.result}>
        {t(a.correct ? 'sessions.attempt_correct' : 'sessions.attempt_wrong')}
      </DText>
      <DText size={14} weight={800} tabular style={styles.flex}>
        {String(a.puzzleRating)}
      </DText>
      <DText size={13} tabular color={dx.ash} testID={`session-attempt-${index}-time`}>
        {time}
      </DText>
      <ChevronRight size={16} color={dx.dust} />
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  body: { gap: 16 },
  mt8: { marginTop: 8 },
  placeholder: { height: 320 },
  state: { padding: 28, alignItems: 'center', gap: 14 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: 140 },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  stack: { gap: 16 },
  aside: { width: 340 },
  cta: { padding: 22, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  empty: { padding: 18, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: dx.rowRule },
  idx: { width: 22, textAlign: 'right' },
  mark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  result: { width: 100 },
});
