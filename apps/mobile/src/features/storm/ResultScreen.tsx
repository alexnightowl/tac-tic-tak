import { hardestSolved, stormAccuracy, type StormBest } from '@tac/core/storm';
import { alpha, eos, layout, mixed, radii, space, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { BackLink } from '@/features/courses/parts';
import { AppText, Card, HeroCard, PlateButton, Tap, useLang } from '@/ui';
import { useT } from '@/ui/lang';
import { stormSummaryQuery } from './api';
import { ordinal } from './format';
import { EmberChip, StatTile } from './parts';
import { useStormStore, type StormLocalRun } from './store';
import { requestStormSync } from './sync';

// /storm/result?run=<clientId> (canvas StormResult). Drawn from the run on
// the phone, so it works offline at once; the server's answer (old best,
// place among friends, the run id a dare needs) fills in when it lands.

const CHART_H = 90;
const BAR_MIN = 18;

export function ResultScreen({ clientId }: { clientId: string }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const run = useStormStore((s) => s.runs.find((r) => r.clientId === clientId) ?? null);
  if (!run) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="storm-result">
        <AppText variant="body" color={eos.ash} style={styles.centerText} testID="storm-result-missing">
          {t('storm.result.missing')}
        </AppText>
        <PlateButton testID="storm-result-back-missing" label={t('storm.result.back')} variant="slate" size="sm" onPress={() => router.replace('/storm' as Href)} />
      </View>
    );
  }
  return <Result run={run} />;
}

function Result({ run }: { run: StormLocalRun }) {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  // The last known summary stands in for the server's answer until it lands.
  const cached = useQuery({ ...stormSummaryQuery(), enabled: false });
  const [syncTried, setSyncTried] = useState(false);
  const { body, saved } = run;
  const score = body.score;

  useEffect(() => {
    if (run.saved || run.rejected) return;
    let alive = true;
    void requestStormSync('run').finally(() => alive && setSyncTried(true));
    return () => {
      alive = false;
    };
  }, [run.saved, run.rejected]);

  const isBest = saved ? saved.isBest : score > 0 && score > (cached.data?.best?.score ?? 0);
  useEffect(() => {
    if (isBest) feel.emit('normRise');
  }, [isBest]);

  const prev: StormBest | null = saved ? saved.previousBest : (cached.data?.best ?? null);
  let line: string;
  if (isBest) {
    line = prev ? t('storm.result.beat_old', { n: prev.score }) : t('storm.result.first');
    if (saved?.friendsRank && saved.friendsCount > 1) line += ` · ${t('storm.result.rank', { rank: ordinal(saved.friendsRank, lang) })}`;
  } else if (prev) {
    const d = prev.score - score;
    line = t('storm.result.best_is', { n: prev.score }) + (d > 0 ? ` · ${t('storm.result.to_go', { d })}` : '');
  } else {
    line = t('storm.result.first');
  }
  const status = saved ? null : run.rejected ? t('storm.result.rejected') : syncTried ? t('storm.result.offline') : t('storm.result.saving');

  const ratings = body.results.map((r) => run.ratings[r.i] ?? 0);
  const lo = ratings.length ? Math.min(...ratings) : 0;
  const hi = ratings.length ? Math.max(...ratings) : 0;
  const mistakes = body.results.filter((r) => !r.ok).length;
  const hardest = hardestSolved(body.results, run.ratings);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/storm' as Href));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="storm-result">
      <View style={styles.header}>
        <BackLink testID="storm-result-back" label={t('storm.result.back')} onPress={back} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 52 + 48 + space[2.5] + space[6] * 2 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <HeroCard style={styles.scoreCard} testID="storm-result-card">
          {isBest ? (
            <EmberChip testID="storm-result-new-best" style={styles.bestChip}>
              <AppText variant="captionStrong" color={tone.blush} style={styles.bestText}>
                {t('storm.result.new_best')}
              </AppText>
            </EmberChip>
          ) : null}
          <AppText variant="display" style={styles.bigScore} testID="storm-result-score">
            {String(score)}
          </AppText>
          <AppText variant="body" color={eos.ash} style={styles.centerText} testID="storm-result-line">
            {line}
          </AppText>
          {status ? (
            <AppText variant="caption" color={eos.dust} style={[styles.centerText, styles.status]} testID="storm-result-status">
              {status}
            </AppText>
          ) : null}
        </HeroCard>

        <View style={styles.stats}>
          <StatTile testID="storm-result-solved" label={t('storm.result.solved')} value={String(score)} />
          <StatTile testID="storm-result-accuracy" label={t('storm.result.accuracy')} value={`${Math.round(stormAccuracy(score, body.mistakes) * 100)}%`} />
          <StatTile testID="storm-result-combo" label={t('storm.result.best_combo')} value={String(body.bestCombo)} />
          <StatTile testID="storm-result-hardest" label={t('storm.result.hardest')} value={hardest != null ? String(hardest) : '—'} />
        </View>

        {body.results.length > 0 ? (
          <Card padding={space[3.5]} style={styles.chart} testID="storm-result-chart">
            <View style={styles.chartHead}>
              <AppText variant="label" color={eos.ash}>
                {t('storm.result.chart')}
              </AppText>
              <AppText variant="captionStrong" color={eos.dust} style={styles.tabular}>
                {`${ratings[0]} → ${ratings[ratings.length - 1]}`}
              </AppText>
            </View>
            <View style={styles.bars} accessible={mistakes === 0} accessibilityLabel={t('storm.result.chart_a11y', { n: mistakes })}>
              {body.results.map((r, k) => {
                const h = BAR_MIN + (hi > lo ? ((ratings[k] - lo) / (hi - lo)) * (CHART_H - BAR_MIN) : CHART_H - BAR_MIN);
                if (r.ok) return <View key={r.i} style={[styles.bar, { height: h, backgroundColor: tone.sageDeep }]} />;
                const id = run.ids[r.i];
                return (
                  <Tap
                    key={r.i}
                    testID={`storm-result-mistake-${r.i}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('storm.result.mistake_a11y', { n: r.i + 1, r: ratings[k] })}
                    onPress={() => router.push({ pathname: '/puzzles/[puzzleId]', params: { puzzleId: id } })}
                    hitSlop={{ top: CHART_H, bottom: 12, left: 4, right: 4 }}
                    style={[styles.barTap, { height: h }]}
                  >
                    <View style={[styles.bar, styles.barFill, { backgroundColor: eos.ember }]} />
                  </Tap>
                );
              })}
            </View>
            <View style={styles.legend}>
              <Legend color={tone.sageDeep} label={t('storm.result.legend_solved')} />
              <Legend color={eos.ember} label={t('storm.result.legend_mistake')} />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(space[6], insets.bottom) }]} pointerEvents="box-none">
        <LinearGradient
          pointerEvents="none"
          colors={[mixed.ctaDockBottom, mixed.ctaDockMid, mixed.ctaDockFade, 'transparent']}
          locations={[0, 0.55, 0.8, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <PlateButton testID="storm-result-again" label={t('storm.result.play_again')} size="lg" block onPress={() => router.replace('/storm/run' as Href)} />
        <PlateButton
          testID="storm-result-dare"
          label={t('storm.result.dare', { n: score })}
          variant="slate"
          size="md"
          block
          disabled={!saved?.runId}
          onPress={() => saved && router.push(`/challenge/new?run=${saved.runId}&score=${score}` as Href)}
        />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <AppText variant="captionStrong" color={eos.ash}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: layout.gutter, gap: space[4] },
  scoreCard: { paddingVertical: 22, paddingHorizontal: space[5], borderRadius: radii.featureTile, alignItems: 'center' },
  bestChip: { backgroundColor: alpha(eos.ember, 0.24), paddingHorizontal: space[2.5] },
  bestText: { textTransform: 'uppercase', letterSpacing: 1 },
  bigScore: { marginTop: space[2], fontSize: 72, lineHeight: 80, fontVariant: ['tabular-nums'] },
  status: { marginTop: space[1.5] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2.5] },
  chart: { borderRadius: radii.cardComponent },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  bars: { marginTop: space[3], height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { flex: 1, borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm },
  barTap: { flex: 1, justifyContent: 'flex-end' },
  barFill: { flex: 1 },
  legend: { marginTop: space[2], flexDirection: 'row', flexWrap: 'wrap', columnGap: space[3.5], rowGap: space[1] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  swatch: { width: 10, height: 10, borderRadius: radii.sm },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space[6], gap: space[2.5] },
});
