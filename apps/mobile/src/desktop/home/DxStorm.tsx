import { localeFor } from '@tac/core/format';
import { initPuzzle } from '@tac/core/puzzle';
import type { StormWeekRow } from '@tac/core/storm';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { BarChart3, Clock3, Heart, Swords, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { plural } from '@/features/offline/format';
import { Avatar } from '@/features/profile/Avatar';
import { stormApi, useStormSummary } from '@/features/storm/api';
import { nameOf, shortDate } from '@/features/storm/format';
import { useStormLaunch } from '@/features/storm/launch';
import { Bolt } from '@/features/storm/parts';
import { useStormStore, type StormLocalRun } from '@/features/storm/store';
import { useStormResult } from '@/features/storm/useResult';
import { PlateButton } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { useHotkeys } from '../hotkeys';
import { Card, DText, Hover, Label, Num, TextButton, Tile } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { MiniBoard } from './MiniBoard';
import { Card2, Col } from './parts';
import { useTwoColumns } from './useTwoColumns';

// /storm (DXStormIntro) and /storm/result (DXStormResult) on a desktop
// window. Same data and actions as the phone's StartScreen / ResultScreen:
// the summary query, useStormLaunch, the run on the device (useStormResult).

const backToPlay = () => (router.canGoBack() ? router.back() : router.replace('/play' as Href));

export function DxStormIntro() {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const { launching, launch } = useStormLaunch();
  const q = useStormSummary();
  const sum = q.data;
  // The hero needs ~560 px beside the 380 px column: stacked below a 1440 window.
  const two = useTwoColumns(1000);
  useHotkeys({ ' ': () => void launch() });

  const rules: { key: string; icon: ReactNode }[] = [
    { key: 'clock', icon: <Clock3 size={18} color={tone.rose} strokeWidth={1.8} /> },
    { key: 'ladder', icon: <BarChart3 size={18} color={tone.rose} strokeWidth={1.8} /> },
    { key: 'combo', icon: <Bolt size={18} color={tone.rose} /> },
    { key: 'lives', icon: <Heart size={18} color={tone.rose} strokeWidth={1.8} /> },
  ];

  const week = sum?.week ?? [];
  const top = week.slice(0, 3).map((row, i) => ({ row, pos: i + 1 }));
  const mePos = week.findIndex((r) => r.me);
  if (mePos >= 3) top.push({ row: week[mePos], pos: mePos + 1 });
  else if (week.length > 3) top.push({ row: week[3], pos: 4 });

  const aside = (
    <>
      <View style={styles.tiles}>
        <Tile style={styles.flex} testID="dx-storm-best">
          <Label size={10}>{t('storm.best')}</Label>
          <Num size={34} style={styles.mt6}>
            {sum?.best ? String(sum.best.score) : '—'}
          </Num>
          <DText size={12} color={dx.dust}>
            {sum?.best ? shortDate(sum.best.at, lang) : t('storm.best_none')}
          </DText>
        </Tile>
        <Tile style={styles.flex} testID="dx-storm-today">
          <Label size={10}>{t('storm.today')}</Label>
          <Num size={34} style={styles.mt6}>
            {sum ? String(sum.today.best) : '—'}
          </Num>
          <DText size={12} color={dx.dust}>
            {plural(tn, 'storm.runs', sum?.today.runs ?? 0)}
          </DText>
        </Tile>
      </View>
      <Card style={styles.week} testID="dx-storm-week">
        <View style={styles.rowCenter}>
          <Label>{t('storm.week')}</Label>
          <View style={styles.flex} />
          <TextButton testID="dx-storm-week-all" accessibilityLabel={t('storm.week_all_a11y')} label={t('storm.week_all')} size={12.5} onPress={() => router.push('/storm/friends' as Href)} style={styles.allBtn} />
        </View>
        {top.length === 0 ? (
          <DText size={13} color={dx.dust} style={styles.mt10} testID="dx-storm-week-empty">
            {sum ? t('storm.week_empty') : ' '}
          </DText>
        ) : (
          <View style={styles.mt6}>
            {top.map(({ row, pos }, i) => (
              <WeekLine key={row.user.id} row={row} pos={pos} first={i === 0} />
            ))}
          </View>
        )}
      </Card>
    </>
  );

  return (
    <DesktopPage title={t('storm.title')} back={{ label: t('storm.back'), onPress: backToPlay }} aside={two ? aside : undefined} asideWidth={380} testID="dx-storm">
      <Col>
        <Card texture style={styles.hero} testID="dx-storm-hero">
          <View style={styles.emblem}>
            <Bolt size={34} color={tone.blush} />
          </View>
          <View style={styles.flex}>
            <DText serif weight={700} size={30} accessibilityRole="header">
              {t('storm.title')}
            </DText>
            <DText size={15} color={dx.ash} style={styles.mt4}>
              {t('storm.tagline')}
            </DText>
          </View>
          <PlateButton testID="dx-storm-start" label={t('storm.start')} icon={<Bolt size={18} color={tone.plateInk} />} size="lg" loading={launching} onPress={() => void launch()} style={styles.startPlate} />
        </Card>
        <Card style={styles.rules} testID="dx-storm-rules">
          {rules.map((r, i) => (
            <View key={r.key} style={[styles.rule, i > 0 && styles.ruleSeam]} accessible accessibilityLabel={`${t(`storm.rule.${r.key}`)}. ${t(`storm.rule.${r.key}_sub`)}`}>
              <View style={styles.ruleIcon}>{r.icon}</View>
              <View style={styles.flex}>
                <DText size={14.5} weight={800}>
                  {t(`storm.rule.${r.key}`)}
                </DText>
                <DText size={13} color={dx.ash}>
                  {t(`storm.rule.${r.key}_sub`)}
                </DText>
              </View>
            </View>
          ))}
        </Card>
        {two ? null : <View style={styles.stacked}>{aside}</View>}
      </Col>
    </DesktopPage>
  );
}

function WeekLine({ row, pos, first }: { row: StormWeekRow; pos: number; first: boolean }) {
  const t = useT();
  const name = row.me ? t('storm.you', { name: nameOf(row.user) }) : nameOf(row.user);
  return (
    <View
      style={[styles.weekRow, !first && styles.ruleSeam, row.me && styles.weekMe]}
      testID={row.me ? 'dx-storm-week-me' : `dx-storm-week-${pos}`}
      accessible
      accessibilityLabel={t('storm.row_a11y', { pos, name, score: row.score })}
    >
      <DText size={14} weight={800} color={dx.dust} style={styles.pos}>
        {String(pos)}
      </DText>
      <Avatar nickname={row.user.nickname} avatarUrl={row.user.avatarUrl} size={30} />
      <DText size={14} weight={700} numberOfLines={1} style={styles.flex}>
        {name}
      </DText>
      <Num size={16}>{String(row.score)}</Num>
    </View>
  );
}

// ── Result ──────────────────────────────────────────────────────────────

export function DxStormResult({ clientId }: { clientId: string }) {
  const t = useT();
  const run = useStormStore((s) => s.runs.find((r) => r.clientId === clientId) ?? null);
  if (!run) {
    return (
      <DesktopPage title={t('dx.home.storm_result')} back={{ label: t('storm.result.back'), onPress: () => router.replace('/storm' as Href) }} testID="dx-storm-result">
        <Card style={styles.missing} testID="dx-storm-result-missing">
          <DText size={15} color={dx.ash}>
            {t('storm.result.missing')}
          </DText>
          <PlateButton testID="dx-storm-result-back" label={t('storm.result.back')} variant="slate" size="sm" onPress={() => router.replace('/storm' as Href)} />
        </Card>
      </DesktopPage>
    );
  }
  return <Result run={run} />;
}

const CHART_H = 120;
const BAR_MIN = 18;
const MISTAKES = 6;

function Result({ run }: { run: StormLocalRun }) {
  const t = useT();
  const { lang } = useLang();
  const { launching, launch } = useStormLaunch();
  const r = useStormResult(run);
  const two = useTwoColumns(900);
  useHotkeys({ ' ': () => void launch({ replace: true }) });
  const { body } = run;
  const day = body.localDay ? new Date(`${body.localDay}T12:00:00`) : new Date();
  const subtitle = day.toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'long' });
  const misses = body.results.filter((x) => !x.ok).slice(0, MISTAKES);
  const dare = () => r.saved && router.push(`/challenge/new?run=${r.saved.runId}&score=${r.score}` as Href);

  const right =
    body.results.length > 0 ? (
      <Card style={styles.chartCard} testID="dx-storm-result-chart">
        <View style={styles.rowCenter}>
          <Label>{t('storm.result.chart')}</Label>
          <View style={styles.flex} />
          <DText size={12} weight={700} color={dx.dust} tabular>{`${r.ratings[0]} → ${r.ratings[r.ratings.length - 1]}`}</DText>
        </View>
        <View style={styles.bars} accessible={r.mistakes === 0} accessibilityLabel={t('storm.result.chart_a11y', { n: r.mistakes })}>
          {body.results.map((x, k) => {
            const h = BAR_MIN + (r.hi > r.lo ? ((r.ratings[k] - r.lo) / (r.hi - r.lo)) * (CHART_H - BAR_MIN) : CHART_H - BAR_MIN);
            if (x.ok) return <View key={x.i} style={[styles.bar, styles.barOk, { height: h }]} />;
            const id = run.ids[x.i];
            return (
              <Hover
                key={x.i}
                testID={`dx-storm-result-mistake-${x.i}`}
                accessibilityLabel={t('storm.result.mistake_a11y', { n: x.i + 1, r: r.ratings[k] })}
                onPress={() => router.push({ pathname: '/puzzles/[puzzleId]', params: { puzzleId: id } })}
                style={[styles.bar, styles.barMiss, { height: h }]}
                hoverStyle={styles.barHover}
              >
                <View />
              </Hover>
            );
          })}
        </View>
        <View style={styles.legend}>
          <Legend color={tone.sageDeep} label={t('storm.result.legend_solved')} />
          <Legend color={eos.ember} label={t('storm.result.legend_mistake')} />
        </View>
        {misses.length > 0 ? (
          <>
            <Label style={styles.mt22}>{t('dx.home.mistakes')}</Label>
            <MistakeGrid run={run} misses={misses} />
          </>
        ) : null}
      </Card>
    ) : null;

  return (
    <DesktopPage
      title={t('dx.home.storm_result')}
      back={{ label: t('storm.result.back'), onPress: () => (router.canGoBack() ? router.back() : router.replace('/storm' as Href)) }}
      right={
        <DText size={13.5} color={dx.ash} testID="dx-storm-result-date">
          {subtitle}
        </DText>
      }
      testID="dx-storm-result"
    >
      <View style={[styles.resultCols, !two && styles.resultStack]}>
        <View style={two ? styles.flex : undefined}>
          <Card texture style={styles.score} testID="dx-storm-result-card">
            {r.isBest ? (
              <Label color={tone.gold} style={styles.center}>
                {t('storm.result.new_best')}
              </Label>
            ) : null}
            <Num size={96} style={styles.bigScore}>
              {String(r.score)}
            </Num>
            <DText size={15} color={dx.ash} align="center" testID="dx-storm-result-line">
              {r.line}
            </DText>
            {r.status ? (
              <DText size={12.5} color={dx.dust} align="center" style={styles.mt6} testID="dx-storm-result-status">
                {r.status}
              </DText>
            ) : null}
          </Card>
          <View style={styles.stats}>
            <Stat label={t('storm.result.solved')} value={String(r.score)} testID="dx-storm-result-solved" />
            <Stat label={t('storm.result.accuracy')} value={`${r.accuracy}%`} testID="dx-storm-result-accuracy" />
            <Stat label={t('dx.home.combo')} value={`×${body.bestCombo}`} testID="dx-storm-result-combo" />
            <Stat label={t('dx.home.hardest')} value={r.hardest != null ? String(r.hardest) : '—'} testID="dx-storm-result-hardest" />
          </View>
          <View style={styles.actions}>
            <PlateButton
              testID="dx-storm-result-again"
              label={t('storm.result.play_again')}
              icon={<Bolt size={18} color={tone.plateInk} />}
              size="md"
              loading={launching}
              onPress={() => void launch({ replace: true })}
              style={styles.again}
            />
            <PlateButton
              testID="dx-storm-result-dare"
              label={t('storm.result.dare', { n: r.score })}
              icon={<Swords size={16} color={tone.plateInk} strokeWidth={1.8} />}
              variant="slate"
              size="md"
              disabled={!r.saved?.runId}
              onPress={dare}
              style={styles.flex}
            />
          </View>
        </View>
        {right ? <View style={two ? styles.flex : undefined}>{right}</View> : null}
      </View>
    </DesktopPage>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <Tile style={styles.stat} testID={testID}>
      <Label size={10}>{label}</Label>
      <Num size={22} style={styles.mt6}>
        {value}
      </Num>
    </Tile>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <DText size={12} color={dx.dust}>
        {label}
      </DText>
    </View>
  );
}

/** The run's mistakes as small boards (the puzzle at the move the player missed). */
function MistakeGrid({ run, misses }: { run: StormLocalRun; misses: StormLocalRun['body']['results'] }) {
  const [w, setW] = useState(0);
  const cell = w > 0 ? Math.floor((w - 20) / 3) : 0;
  return (
    <View style={styles.boards} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {cell > 0 ? misses.map((m) => <Mistake key={m.i} streamId={run.body.streamId} id={run.ids[m.i]} index={m.i} rating={run.ratings[m.i] ?? 0} cell={cell} />) : null}
    </View>
  );
}

function Mistake({ streamId, id, index, rating, cell }: { streamId: string; id: string; index: number; rating: number; cell: number }) {
  const t = useT();
  // The run's own stream (one request for every board): the position after the setup move.
  const q = useQuery({ queryKey: ['storm', 'stream', streamId], queryFn: () => stormApi.streamById(streamId), staleTime: Infinity, retry: false, meta: { persist: false } });
  const p = q.data?.puzzles[index];
  const fen = p && p.id === id ? initPuzzle({ ...p, gameUrl: null }).postFen : null;
  const board = cell - 20;
  return (
    <Hover
      testID={`dx-storm-result-board-${index}`}
      accessibilityLabel={t('dx.home.mistake_open', { n: index + 1, r: rating })}
      onPress={() => router.push({ pathname: '/puzzles/[puzzleId]', params: { puzzleId: id } })}
      style={[styles.mistake, { width: cell }]}
      hoverStyle={styles.mistakeHover}
    >
      <Card2 style={styles.mistakeInner}>
        {fen ? <MiniBoard fen={fen} size={board} /> : <View style={[styles.boardStub, { width: board, height: board }]} />}
        <View style={styles.mistakeFoot}>
          <View style={styles.missDot}>
            <X size={10} color={tone.cream} strokeWidth={3} />
          </View>
          <DText size={12} weight={700} tabular>
            {String(rating)}
          </DText>
        </View>
      </Card2>
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt10: { marginTop: 10 },
  mt22: { marginTop: 22 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  stacked: { gap: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 24, padding: 30 },
  emblem: { width: 76, height: 76, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: eos.embers },
  startPlate: { minWidth: 260, alignSelf: 'center' },
  rules: { paddingVertical: 6, paddingHorizontal: 22 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  ruleSeam: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  ruleIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: dx.ghost },
  tiles: { flexDirection: 'row', gap: 12 },
  week: { paddingVertical: 16, paddingHorizontal: 20 },
  allBtn: { height: 28, paddingHorizontal: 6 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  weekMe: { backgroundColor: alpha(eos.ember, 0.12), marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  pos: { width: 18 },
  missing: { padding: 28, gap: 16, alignItems: 'flex-start' },
  resultCols: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  resultStack: { flexDirection: 'column', alignItems: 'stretch' },
  score: { padding: 36, alignItems: 'center' },
  bigScore: { lineHeight: 100, marginTop: 8 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 14 },
  stat: { flex: 1, minWidth: 0 },
  again: { minWidth: 150 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  chartCard: { paddingVertical: 20, paddingHorizontal: 22 },
  bars: { marginTop: 18, height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bar: { flex: 1, maxWidth: 40, borderRadius: 3 },
  barOk: { backgroundColor: alpha(tone.sageDeep, 0.62) },
  barMiss: { backgroundColor: eos.ember },
  barHover: { backgroundColor: tone.rose },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  boards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  mistake: { borderRadius: 12 },
  mistakeHover: { opacity: 0.88 },
  mistakeInner: { padding: 10, gap: 8 },
  boardStub: { backgroundColor: dx.track, borderRadius: 4 },
  mistakeFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: eos.ember },
});
