import { bucketByLocalDay, radarBounds, RADAR_MIN_THEMES, selectRadarThemes } from '@tac/core/charts';
import { fmtResponseTime } from '@tac/core/format';
import { isMetaTheme, themeLabel } from '@tac/core/themes';
import { control, eos, feedback, layout, radii, semantic, space } from '@tac/core/tokens';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { feel } from '@/feel';
import { ThemeIcon } from '@/features/review/ThemeIcon';
import { AppText, textStyle } from '@/ui/AppText';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT, useTn } from '@/ui/lang';
import { Segmented } from '@/ui/Segmented';
import { Card, HeroCard } from '@/ui/Surfaces';
import { Tap } from '@/ui/Tap';
import { ActivityHeatmap } from './ActivityHeatmap';
import {
  overviewQuery,
  recommendationQuery,
  themesQuery,
  timelineQuery,
  toRatingPoints,
  type StyleFilter,
  type ThemeRow,
} from './api';
import { CountUp, groupInt } from './CountUp';
import { startThemeDrill } from './drill';
import { STRUCTURED_RECOMMENDATIONS } from './flags';
import { barGrow } from './motion';
import { RadarChart } from './RadarChart';
import { RatingHistoryChart } from './RatingHistoryChart';
import { STYLE_ORDER } from './StyleIcon';

type ThemesTab = 'weakest' | 'strongest' | 'all';

/** Web's no-value mark (not copy, so not in the dictionaries). */
const DASH = '—';

/** Web ThemesList rules: tactical themes only; weakest/strongest top 20. */
function visibleThemes(themes: ThemeRow[], tab: ThemesTab): ThemeRow[] {
  const tactical = themes.filter((th) => !isMetaTheme(th.slug));
  if (tab === 'strongest') {
    return tactical.filter((th) => th.attempts > 0).sort((a, b) => a.weakness - b.weakness).slice(0, 20);
  }
  const sorted = [...tactical].sort((a, b) => b.weakness - a.weakness);
  return tab === 'all' ? sorted : sorted.slice(0, 20);
}

/** Web colour buckets: rose ≥ .66, amber ≥ .33, sage below. */
function weaknessTone(w: number) {
  if (w >= 0.66) return { bar: semantic.accent, icon: eos.rose };
  if (w >= 0.33) return { bar: feedback.hint, icon: feedback.hint };
  return { bar: eos.sage, icon: eos.sage };
}

/**
 * Stats tab body (web analytics StatsTab): style filter, heatmap, rating
 * history, lifetime grid, recommendation, radar, themes list. One FlashList
 * whose header holds the charts, so the (possibly long) "all themes" list is
 * virtualised and the whole page pulls to refresh.
 */
export function StatsView() {
  const t = useT();
  const [filter, setFilter] = useState<StyleFilter>('all');
  const [themesTab, setThemesTab] = useState<ThemesTab>('weakest');

  const overview = useQuery(overviewQuery(filter));
  const themes = useQuery(themesQuery(filter));
  const rec = useQuery(recommendationQuery(filter));
  const timeline = useQuery(timelineQuery());
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    await Promise.allSettled([overview.refetch(), themes.refetch(), rec.refetch(), timeline.refetch()]);
    setRefreshing(false);
  };

  const failed = overview.isError && !overview.data && timeline.isError && !timeline.data;
  const rows = visibleThemes(themes.data ?? [], themesTab);

  const filterOptions = [
    { value: 'all' as const, label: t('stats.filter_all') },
    ...STYLE_ORDER.map((s) => ({ value: s, label: t(`style.${s}.name`) })),
  ];

  const header = (
    <View style={styles.header}>
      <Segmented
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        size="sm"
        testID="stats-filter"
        accessibilityLabel={t('stats.filter_label')}
      />
      {failed ? (
        <Card style={styles.card} testID="stats-error">
          <AppText variant="body" color={eos.ash}>
            {t('stats.error')}
          </AppText>
          <Tap
            testID="stats-retry"
            accessibilityRole="button"
            accessibilityLabel={t('stats.retry')}
            onPress={() => void onRefresh()}
            style={styles.retry}
          >
            <AppText variant="label" color={eos.bone}>
              {t('stats.retry')}
            </AppText>
          </Tap>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="label">{t('stats.activity')}</AppText>
        <AppText variant="caption" color={eos.dust} style={styles.hint}>
          {t('stats.activity_hint')}
        </AppText>
        {timeline.data ? (
          <ActivityHeatmap data={bucketByLocalDay(timeline.data)} weeks={52} testID="stats-heatmap" />
        ) : (
          <Placeholder height={130} />
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="label">{t('stats.rating_history')}</AppText>
        <AppText variant="caption" color={eos.dust} style={styles.hint}>
          {t('stats.rating_history_hint')}
        </AppText>
        {timeline.data ? (
          <RatingHistoryChart
            data={toRatingPoints(timeline.data)}
            highlightStyle={filter === 'all' ? null : filter}
            testID="stats-rating"
          />
        ) : (
          <Placeholder height={230} />
        )}
      </Card>

      {overview.data?.lifetime ? <Lifetime key={filter} lifetime={overview.data.lifetime} /> : null}

      <Recommendation theme={rec.data?.theme ?? null} reason={rec.data?.reason ?? ''} rows={themes.data ?? []} />

      <Card style={styles.card}>
        <AppText variant="label">{t('stats.by_theme')}</AppText>
        <RadarBlock themes={themes.data} />
      </Card>

      <View style={styles.listHead}>
        <AppText variant="sectionLabel">{t('stats.theme_list')}</AppText>
        <Segmented
          options={[
            { value: 'weakest' as const, label: t('stats.themes_tab_weakest') },
            { value: 'strongest' as const, label: t('stats.themes_tab_strongest') },
            { value: 'all' as const, label: t('stats.themes_tab_all') },
          ]}
          value={themesTab}
          onChange={setThemesTab}
          size="sm"
          testID="stats-themes-tab"
          accessibilityLabel={t('stats.themes_tabs_label')}
        />
      </View>
      {themes.data && rows.length === 0 ? (
        <AppText variant="body" color={eos.dust} testID="stats-themes-empty">
          {t('stats.no_data')}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <FlashList
      data={rows}
      keyExtractor={(r) => r.slug}
      renderItem={({ item }) => <ThemeRowCard row={item} />}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ash} />}
      testID="stats-list"
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function Placeholder({ height }: { height: number }) {
  return <View style={[styles.placeholder, { height }]} />;
}

/** Keyed on the filter by the caller, so each switch counts up again. */
function Lifetime({
  lifetime,
}: {
  lifetime: { solved: number; attempts: number; accuracy: number; peakRating: number; sessions: number };
}) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const value = textStyle('value', lang);
  const played = lifetime.attempts > 0;
  return (
    <View>
      <AppText variant="sectionLabel" style={styles.sectionLabel}>
        {t('stats.lifetime')}
      </AppText>
      <View style={styles.grid}>
        <Card style={styles.tile}>
          <AppText variant="label">{t('stats.lifetime.solved')}</AppText>
          <CountUp value={lifetime.solved} lang={lang} style={value} testID="stats-solved" />
          <AppText variant="caption" color={eos.dust}>
            {played ? `${groupInt(lifetime.attempts, lang)} ${tn('stats.attempt_word', lifetime.attempts)}` : ' '}
          </AppText>
        </Card>
        <Card style={styles.tile}>
          <AppText variant="label">{t('stats.lifetime.accuracy')}</AppText>
          {played ? (
            <CountUp value={Math.round(lifetime.accuracy * 100)} suffix="%" lang={lang} style={value} testID="stats-accuracy" />
          ) : (
            <AppText variant="value" testID="stats-accuracy">
              {DASH}
            </AppText>
          )}
        </Card>
        <Card style={styles.tile}>
          <AppText variant="label">{t('stats.lifetime.sessions')}</AppText>
          <CountUp value={lifetime.sessions} lang={lang} style={value} testID="stats-sessions" />
        </Card>
        <Card style={styles.tile}>
          <AppText variant="label">{t('stats.lifetime.peak')}</AppText>
          <AppText variant="value" testID="stats-peak">
            {lifetime.peakRating > 0 ? String(lifetime.peakRating) : DASH}
          </AppText>
        </Card>
      </View>
    </View>
  );
}

/**
 * Recommended focus. The server's `reason` is English-only; until B13 ships
 * structured fields (STRUCTURED_RECOMMENDATIONS), the reason is rebuilt in
 * the UI language from the same theme's row (the server derives it from
 * those numbers), falling back to the server text.
 */
function Recommendation({ theme, reason, rows }: { theme: string | null; reason: string; rows: ThemeRow[] }) {
  const t = useT();
  const { lang } = useLang();
  if (!theme) return null;
  const row = rows.find((r) => r.slug === theme);
  const text =
    !STRUCTURED_RECOMMENDATIONS && row
      ? t('stats.recommend_reason', {
          weakness: Math.round(row.weakness * 100),
          fail: Math.round(row.failureRate * 100),
          avg: fmtResponseTime(row.avgResponseMs),
        })
      : reason;
  const label = themeLabel(theme, lang);
  return (
    <HeroCard testID="stats-recommend">
      <View style={styles.recRow}>
        <View style={styles.recIcon}>
          <ThemeIcon slug={theme} size={24} color={eos.rose} />
        </View>
        <View style={styles.flex}>
          <AppText variant="eyebrow">{t('stats.recommend')}</AppText>
          <AppText variant="title" numberOfLines={2} testID="stats-recommend-theme">
            {label}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" color={eos.ash} style={styles.recText}>
        {text}
      </AppText>
      <Tap
        testID="stats-recommend-drill"
        accessibilityRole="button"
        accessibilityLabel={`${t('stats.recommend_cta')}: ${label}`}
        onPress={() => void startThemeDrill(theme)}
        style={styles.recCta}
      >
        <AppText variant="label" color={eos.bone}>
          {t('stats.recommend_cta')}
        </AppText>
        <ChevronRight size={14} color={eos.ash} />
      </Tap>
    </HeroCard>
  );
}

function RadarBlock({ themes }: { themes: ThemeRow[] | undefined }) {
  const t = useT();
  const { lang } = useLang();
  if (!themes) return <Placeholder height={300} />;
  const data = selectRadarThemes(themes, lang);
  if (data.length < RADAR_MIN_THEMES) {
    return (
      <AppText variant="body" color={eos.dust} style={styles.noData} testID="stats-radar-empty">
        {t('stats.no_data')}
      </AppText>
    );
  }
  const b = radarBounds(data);
  return <RadarChart data={data} min={b.min} max={b.max} testID="stats-radar" />;
}

function ThemeRowCard({ row }: { row: ThemeRow }) {
  const t = useT();
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const w = Math.max(0, Math.min(1, row.weakness));
  const tone = weaknessTone(w);
  const grow = useSharedValue(reduced ? w : 0);
  useEffect(() => {
    grow.set(reduced ? w : withTiming(w, barGrow));
  }, [w, reduced, grow]);
  const bar = useAnimatedStyle(() => ({ width: `${Math.round(grow.get() * 100)}%` }));
  const label = themeLabel(row.slug, lang);
  const pct = Math.round(row.failureRate * 100);
  return (
    <Tap
      testID={`theme-row-${row.slug}`}
      accessibilityRole="button"
      accessibilityLabel={t('stats.theme_drill_a11y', { theme: label, attempts: row.attempts, pct })}
      onPress={() => void startThemeDrill(row.slug)}
    >
      <Card style={styles.themeRow}>
        <View style={styles.themeIcon}>
          <ThemeIcon slug={row.slug} size={20} color={tone.icon} />
        </View>
        <View style={styles.flex}>
          <AppText variant="body" numberOfLines={1} style={styles.themeName}>
            {label}
          </AppText>
          <AppText variant="caption" color={eos.dust} numberOfLines={1}>
            {`${row.attempts} · ${t('stats.themes_fail', { pct })} · ${fmtResponseTime(row.avgResponseMs)}`}
          </AppText>
        </View>
        <View style={styles.themeRight}>
          {row.rating > 0 ? (
            <AppText variant="body" color={eos.ash} style={styles.tabular}>
              {String(row.rating)}
            </AppText>
          ) : null}
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { backgroundColor: tone.bar }, bar]} />
          </View>
        </View>
      </Card>
    </Tap>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingBottom: space[10] },
  header: { gap: space[4], paddingTop: space[3], paddingBottom: space[3] },
  card: { gap: space[1] },
  hint: { marginBottom: space[2] },
  placeholder: { borderRadius: radii.control, backgroundColor: control.ghostPressBg },
  sectionLabel: { marginBottom: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: { flexBasis: '47%', flexGrow: 1, gap: space[1] },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  recIcon: {
    width: layout.themeTile + 8,
    height: layout.themeTile + 8,
    borderRadius: radii.xl,
    backgroundColor: eos.rise,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recText: { marginTop: space[3] },
  recCta: { flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-start', minHeight: 44, marginTop: space[1] },
  flex: { flex: 1, minWidth: 0 },
  noData: { textAlign: 'center', paddingVertical: space[6] },
  listHead: { gap: space[2] },
  gap: { height: space[2] },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3] },
  themeIcon: {
    width: layout.themeTile,
    height: layout.themeTile,
    borderRadius: radii.xl,
    backgroundColor: eos.rise,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeName: { fontFamily: fontFamily('en', 'body', 600) },
  themeRight: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  tabular: { fontVariant: ['tabular-nums'] },
  barTrack: { width: 72, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: semantic.borderSoft },
  barFill: { height: '100%', borderRadius: 4 },
});
