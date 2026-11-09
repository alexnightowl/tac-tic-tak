import { bucketByLocalDay } from '@tac/core/charts';
import { localeFor, streakState } from '@tac/core/format';
import { isTrainingStyle } from '@tac/core/rules';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemeIcon } from '@/features/review/ThemeIcon';
import {
  overviewQuery,
  recommendationQuery,
  themesQuery,
  timelineQuery,
  toRatingPoints,
  type StyleFilter,
  type ThemeRow,
  type TimelinePoint,
} from '@/features/stats/api';
import { groupInt } from '@/features/stats/CountUp';
import { startThemeDrill } from '@/features/stats/drill';
import { RatingHistoryChart } from '@/features/stats/RatingHistoryChart';
import { visibleThemes } from '@/features/stats/StatsView';
import { STYLE_ORDER } from '@/features/stats/StyleIcon';
import { useAppStore } from '@/stores/appStore';
import { useLang, useT, useTn, type TFn } from '@/ui/lang';
import { Bar, Card, DText, GhostButton, Hover, Label, Seg, StatTile } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { DxHeatmap, weeksFor } from './Heatmap';
import { TWO_COLUMN_MIN, useWidth } from './layout';

type Period = '7' | '30' | '365';
type ThemesTab = 'weakest' | 'strongest';

const DAY_MS = 86_400_000;
const DASH = '—';
const PROFILE_ROWS = 6;

/** Theme accuracy bar colour: strong sage, middling ember, weak rose. */
function accTone(acc: number): string {
  if (acc >= 0.8) return dx.accHigh;
  if (acc >= 0.5) return dx.accMid;
  return dx.accLow;
}

/** Mean answer time over a style's theme rows, weighted by attempts. */
function meanResponseMs(rows: ThemeRow[] | undefined): number | null {
  if (!rows) return null;
  let n = 0;
  let sum = 0;
  for (const r of rows) {
    if (r.attempts <= 0 || r.avgResponseMs <= 0) continue;
    n += r.attempts;
    sum += r.avgResponseMs * r.attempts;
  }
  return n > 0 ? sum / n : null;
}

/**
 * Stats on a desktop window (DXStats): style and period switches, five KPI
 * tiles, the rating chart beside the activity heatmap, the theme profile
 * (weakest / strongest accuracy bars) beside time per puzzle and the
 * recommendation. Same queries as the phone's StatsView; the period trims
 * the rating chart and the KPI deltas (the lifetime totals stay lifetime).
 */
export function DxStats({ switcher }: { switcher: ReactNode }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const [filter, setFilter] = useState<StyleFilter>('all');
  const [period, setPeriod] = useState<Period>('30');
  const [themesTab, setThemesTab] = useState<ThemesTab>('weakest');
  const [width, onLayout] = useWidth();
  const [heatW, onHeatLayout] = useWidth();
  const two = width === 0 || width >= TWO_COLUMN_MIN;

  const overview = useQuery(overviewQuery(filter));
  const themes = useQuery(themesQuery(filter));
  const rec = useQuery(recommendationQuery(filter));
  const timeline = useQuery(timelineQuery());
  const perStyle = useQueries({ queries: STYLE_ORDER.map((s) => themesQuery(s)) });
  const streak = useAppStore((s) => s.streak);

  // The period's start, from the moment the page opened (render stays pure).
  const [openedAt] = useState(() => Date.now());
  const cutoff = openedAt - Number(period) * DAY_MS;
  const inStyle = (p: TimelinePoint) => filter === 'all' || p.style === filter;
  const recent = (timeline.data ?? []).filter((p) => inStyle(p) && new Date(p.endedAt).getTime() >= cutoff);
  const periodWord = t(`dx.rivals.stats.per_${period}`);
  const plus = (n: number) => t('dx.rivals.stats.plus', { n: groupInt(n, lang), period: periodWord });

  const life = overview.data?.lifetime;
  const played = !!life && life.attempts > 0;

  // Peak caption: the style and day of the best session in the filter.
  let peakCaption = ' ';
  const best = (timeline.data ?? []).filter((p) => inStyle(p) && isTrainingStyle(p.style)).sort((a, b) => b.peakRating - a.peakRating)[0];
  if (best && life && life.peakRating > 0) {
    const day = new Date(best.endedAt).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short' });
    peakCaption = `${t(`style.${best.style}.name`)} · ${day}`;
  }

  const st = streakState(streak.days, streak.lastDay);
  const streakDays = st === 'secured' || st === 'at_risk' ? streak.days : 0;
  const streakCaption = st === 'secured' ? t('dx.shell.streak_done') : st === 'at_risk' ? t('dx.shell.streak_today') : t('dx.shell.streak_none');

  const ratingPoints = toRatingPoints(timeline.data).filter((p) => new Date(p.endedAt).getTime() >= cutoff);
  const weeks = weeksFor(Math.max(0, heatW - 44));
  const failed = overview.isError && !overview.data && timeline.isError && !timeline.data;

  const filterOptions = [
    { value: 'all' as const, label: t('stats.filter_all') },
    ...STYLE_ORDER.map((s) => ({ value: s, label: t(`style.${s}.name`) })),
  ];

  const ratingCard = (
    <Card style={[styles.card, two && styles.wide]} testID="dx-stats-rating">
      <Label>{t('stats.rating_history')}</Label>
      <View style={styles.mt18}>
        {timeline.data ? (
          <RatingHistoryChart data={ratingPoints} highlightStyle={filter === 'all' ? null : filter} testID="dx-stats-rating-chart" />
        ) : (
          <View style={styles.ph} />
        )}
      </View>
    </Card>
  );

  const activityCard = (
    <View style={[styles.flexCol, two && styles.narrow]} onLayout={onHeatLayout}>
      <Card style={[styles.card, styles.grow]} testID="dx-stats-activity">
        <View style={styles.row}>
          <Label>{t('stats.activity')}</Label>
          <View style={styles.flex} />
          <DText size={12} color={dx.dust}>
            {tn('dx.rivals.stats.weeks', weeks).split('{n}').join(String(weeks))}
          </DText>
        </View>
        <View style={styles.mt16}>
          {timeline.data && heatW > 0 ? (
            <DxHeatmap data={bucketByLocalDay(timeline.data)} weeks={weeks} testID="dx-stats-heatmap" />
          ) : (
            <View style={styles.ph} />
          )}
        </View>
      </Card>
    </View>
  );

  const profile = visibleThemes(themes.data ?? [], themesTab).slice(0, PROFILE_ROWS);
  const profileCard = (
    <Card style={[styles.cardTight, two && styles.wide]} testID="dx-stats-themes">
      <View style={styles.row}>
        <Label>{t('stats.by_theme')}</Label>
        <View style={styles.flex} />
        <Seg
          small
          options={[
            { value: 'weakest' as const, label: t('stats.themes_tab_weakest') },
            { value: 'strongest' as const, label: t('stats.themes_tab_strongest') },
          ]}
          value={themesTab}
          onChange={setThemesTab}
          testID="dx-stats-themes-tab"
          accessibilityLabel={t('stats.themes_tabs_label')}
          style={styles.segThemes}
        />
      </View>
      <View style={styles.mt6}>
        {themes.data && profile.length === 0 ? (
          <DText size={13.5} color={dx.dust} style={styles.empty} testID="dx-stats-themes-empty">
            {t('stats.no_data')}
          </DText>
        ) : null}
        {profile.map((r, i) => (
          <ThemeLine key={r.slug} row={r} first={i === 0} t={t} />
        ))}
      </View>
    </Card>
  );

  const times = perStyle.map((q) => meanResponseMs(q.data));
  const maxTime = Math.max(1, ...times.map((x) => x ?? 0));
  const recRow = rec.data?.theme ? (themes.data ?? []).find((r) => r.slug === rec.data!.theme) : undefined;
  const recLabel = rec.data?.theme ? themeLabel(rec.data.theme, lang) : '';
  const timeCard = (
    <Card style={[styles.card, two && styles.narrow]} testID="dx-stats-time">
      <Label>{t('dx.rivals.stats.time_title')}</Label>
      {STYLE_ORDER.map((s, i) => (
        <View key={s} style={[styles.row, styles.mt14, styles.gap12]}>
          <DText size={13} color={dx.ash} style={styles.timeName}>
            {t(`style.${s}.name`)}
          </DText>
          <Bar value={(times[i] ?? 0) / maxTime} height={10} style={styles.flex} />
          <DText size={13} weight={800} tabular align="right" style={styles.timeVal} testID={`dx-stats-time-${s}`}>
            {times[i] != null ? t('dx.rivals.stats.secs', { n: Math.round(times[i]! / 1000) }) : DASH}
          </DText>
        </View>
      ))}
      {rec.data?.theme ? (
        <View style={styles.tip} testID="dx-stats-tip">
          <DText size={13} lh={19} color={dx.ash}>
            <DText size={13} lh={19} weight={800} color={tone.gold}>
              {`${t('dx.rivals.stats.tip_label')} `}
            </DText>
            {recRow
              ? t('dx.rivals.stats.tip', {
                  theme: recLabel,
                  fail: Math.round(recRow.failureRate * 100),
                  secs: Math.round(recRow.avgResponseMs / 1000),
                })
              : rec.data.reason}
          </DText>
          <GhostButton
            label={t('stats.recommend_cta')}
            accessibilityLabel={`${t('stats.recommend_cta')}: ${recLabel}`}
            testID="dx-stats-tip-drill"
            onPress={() => void startThemeDrill(rec.data!.theme!)}
            height={34}
            style={styles.tipBtn}
          />
        </View>
      ) : null}
    </Card>
  );

  return (
    <DesktopPage title={t('stats.title')} subtitle={t('dx.rivals.stats_sub')} right={switcher} testID="dx-stats">
      <View onLayout={onLayout} style={styles.body}>
        <View style={styles.row}>
          <Seg options={filterOptions} value={filter} onChange={setFilter} testID="dx-stats-filter" accessibilityLabel={t('stats.filter_label')} style={styles.segFilter} />
          <View style={styles.flex} />
          <Seg
            options={[
              { value: '7' as const, label: t('dx.rivals.stats.period_7') },
              { value: '30' as const, label: t('dx.rivals.stats.period_30') },
              { value: '365' as const, label: t('dx.rivals.stats.period_365') },
            ]}
            value={period}
            onChange={setPeriod}
            testID="dx-stats-period"
            accessibilityLabel={t('dx.rivals.stats.period_label')}
            style={styles.segPeriod}
          />
        </View>
        {failed ? (
          <Card style={styles.card} testID="dx-stats-error">
            <DText size={14} color={dx.ash}>
              {t('stats.error')}
            </DText>
          </Card>
        ) : null}
        <View style={styles.kpis}>
          <StatTile
            style={styles.kpi}
            label={t('stats.lifetime.solved')}
            value={life ? groupInt(life.solved, lang) : DASH}
            caption={plus(recent.reduce((s, p) => s + p.solved, 0))}
            testID="dx-stats-solved"
          />
          <StatTile
            style={styles.kpi}
            label={t('stats.lifetime.accuracy')}
            value={played ? `${Math.round(life!.accuracy * 100)}%` : DASH}
            caption={played ? `${groupInt(life!.attempts, lang)} ${tn('stats.attempt_word', life!.attempts)}` : ' '}
            testID="dx-stats-accuracy"
          />
          <StatTile
            style={styles.kpi}
            label={t('stats.lifetime.sessions')}
            value={life ? groupInt(life.sessions, lang) : DASH}
            caption={plus(recent.length)}
            testID="dx-stats-sessions"
          />
          <StatTile
            style={styles.kpi}
            label={t('stats.lifetime.peak')}
            value={life && life.peakRating > 0 ? String(life.peakRating) : DASH}
            caption={peakCaption}
            testID="dx-stats-peak"
          />
          <StatTile
            style={styles.kpi}
            label={t('dx.shell.streak')}
            value={tn('dx.shell.streak_days', streakDays).split('{n}').join(String(streakDays))}
            caption={streakCaption}
            testID="dx-stats-streak"
          />
        </View>
        <View style={two ? styles.pair : styles.stack}>
          {ratingCard}
          {activityCard}
        </View>
        <View style={two ? styles.pair : styles.stack}>
          {profileCard}
          {timeCard}
        </View>
      </View>
    </DesktopPage>
  );
}

function ThemeLine({ row, first, t }: { row: ThemeRow; first: boolean; t: TFn }) {
  const tn = useTn();
  const { lang } = useLang();
  const label = themeLabel(row.slug, lang);
  const acc = Math.max(0, Math.min(1, 1 - row.failureRate));
  const pct = Math.round(acc * 100);
  return (
    <Hover
      testID={`dx-stats-theme-${row.slug}`}
      accessibilityLabel={t('stats.theme_drill_a11y', { theme: label, attempts: row.attempts, pct: Math.round(row.failureRate * 100) })}
      onPress={() => void startThemeDrill(row.slug)}
      style={[styles.themeRow, !first && styles.rule]}
    >
      <View style={styles.themeIcon}>
        <ThemeIcon slug={row.slug} size={15} color={eos.bone} />
      </View>
      <DText size={13.5} weight={700} numberOfLines={1} style={styles.flex}>
        {label}
      </DText>
      <DText size={12} color={dx.dust} style={styles.themeN} numberOfLines={1}>
        {tn('dx.rivals.stats.puzzles', row.attempts).split('{n}').join(String(row.attempts))}
      </DText>
      <Bar value={acc} colors={[accTone(acc), accTone(acc)]} style={styles.themeBar} />
      <DText size={13} weight={800} tabular align="right" style={styles.themePct}>
        {`${pct}%`}
      </DText>
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexCol: { minWidth: 0 },
  grow: { flex: 1 },
  body: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  gap12: { gap: 12 },
  mt6: { marginTop: 6 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  segFilter: { width: 360 },
  segPeriod: { width: 240 },
  segThemes: { width: 240 },
  kpis: { flexDirection: 'row', gap: 12 },
  kpi: { flex: 1, minWidth: 0 },
  pair: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  stack: { gap: 16 },
  wide: { flex: 1.25, minWidth: 0 },
  narrow: { flex: 1, minWidth: 0 },
  card: { paddingVertical: 20, paddingHorizontal: 22 },
  cardTight: { paddingVertical: 16, paddingHorizontal: 22 },
  ph: { height: 160, borderRadius: 10, backgroundColor: dx.track },
  empty: { paddingVertical: 24, textAlign: 'center' },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8 },
  rule: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  themeIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: dx.ghost, alignItems: 'center', justifyContent: 'center' },
  themeN: { width: 72 },
  themeBar: { width: 140 },
  themePct: { width: 40 },
  timeName: { width: 70 },
  timeVal: { width: 50 },
  tip: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
    gap: 10,
  },
  tipBtn: { alignSelf: 'flex-start' },
});

