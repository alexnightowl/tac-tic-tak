import { localeFor, streakState, type SessionRow } from '@tac/core/format';
import { localized, suggestedCourse, type CourseSummary } from '@tac/core/library';
import { CALIBRATION_SESSIONS, LEVEL_STEP, UI_STYLE_ORDER, isTrainingStyle, type TrainingStyle } from '@tac/core/rules';
import type { Progression } from '@tac/core/api';
import type { RunnerSnapshot } from '@tac/core/runner';
import { levelFor } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { BarChart3, Check, ChevronRight, History, Target, Trophy, Zap } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { meQuery } from '@/features/auth/session';
import { overviewQuery, readLastSeenRatings, writeLastSeenRatings, type Overview, type SeenRatings } from '@/features/home/api';
import { ResumeCard } from '@/features/home/ResumeCard';
import { lastPlayedIn } from '@/features/library/model';
import { lessonTotals, useCourseProgressMap, useLearnCourses } from '@/features/learn/data';
import { openOnboarding } from '@/features/onboarding/gate';
import { plural } from '@/features/offline/format';
import { bandIcon } from '@/features/play/setup/bandIcons';
import { clampMinutes, readLastSetup, readLastStyle, repeatStartRating, resolveDurationFor, type SessionSetup } from '@/features/play/setupPrefs';
import { startSession } from '@/features/play/startSession';
import { startErrorKey } from '@/features/play/strings';
import { ThemeIcon } from '@/features/play/themes/ThemeIcon';
import { Avatar, VerifiedBadge } from '@/features/profile/Avatar';
import { pct, responseTime } from '@/features/sessions/format';
import { reviewApi, reviewKeys } from '@/features/review/api';
import { friendsQuery, leagueQuery, type LeagueRow } from '@/features/social/api';
import { readBoardScope } from '@/features/social/prefs';
import { timelineQuery } from '@/features/stats/api';
import { readActiveSnapshot } from '@/runner';
import { toast } from '@/shell/toast/store';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { PlateButton } from '@/ui';
import { useLang, useT, useTn, type TFn } from '@/ui/lang';
import { useHotkeys } from '../hotkeys';
import { levelDelta, toLevelPoints } from '../level';
import { Bar, Card, DText, GhostButton, Hover, Label, Num, Pill, Seg, StatTile, TextButton } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { MiniBoard } from './MiniBoard';
import { RatingLine } from './RatingChart';
import { STYLE_GLYPH } from './styleGlyph';
import { Col } from './parts';
import { useTwoColumns } from './useTwoColumns';

// "/" on a desktop window: DXHome (a player with sessions) or DXHomeEmpty
// (a new account). The phone Home's data (/users/me ratings, /analytics
// overview), plus the Stats timeline for the chart, the Review themes, the
// weekly league and the course store for the right column.

/** The phone Home lists five. */
const RECENT = 5;
const LEAGUE_ROWS = 4;
type Range = '7d' | '30d' | 'all';
const RANGE_DAYS: Record<Range, number | null> = { '7d': 7, '30d': 30, all: null };

const PIECES = {
  pawn: require('../../../assets/learn/pieces/pawn.png'),
  knight: require('../../../assets/learn/pieces/knight.png'),
  queen: require('../../../assets/learn/pieces/queen.png'),
  king: require('../../../assets/learn/pieces/king.png'),
  bishop: require('../../../assets/learn/pieces/pawn.png'),
  rook: require('../../../assets/learn/pieces/pawn.png'),
} as const;

/** The empty hero's picture: a quiet middlegame (decorative). */
const HERO_FEN = 'r1b2rk1/pp3ppp/2n1pq2/3p4/3P4/2PBPN2/PPQ2PPP/R3K2R w KQ - 0 12';

/**
 * The phone Home's quick start: repeats the whole last setup (rated,
 * casual or a theme drill, with its duration and start rating). Before the
 * first session there is none, so it is a rated start with the remembered
 * style and its duration (Play's Rated with the last picks).
 */
function useQuickStart() {
  const t = useT();
  const progressions = useAppStore((s) => s.progressions);
  const [starting, setStarting] = useState(false);
  const last = readLastSetup();
  const lastStyle = readLastStyle();
  const d = resolveDurationFor(lastStyle);
  const ratedSetup: SessionSetup = {
    style: lastStyle,
    durationSec: d.custom ? clampMinutes(lastStyle, d.customMinutes) * 60 : d.duration,
    mode: 'mixed',
    theme: null,
    startRating: progressions[lastStyle].currentPuzzleRating,
  };
  const setup = last ?? ratedSetup;
  const run = async (s: SessionSetup) => {
    if (starting) return;
    setStarting(true);
    try {
      const id = await startSession({ ...s, startRating: repeatStartRating(s, progressions[s.style]) });
      router.push(`/play/${id}` as Href);
    } catch (e) {
      toast.show({ title: t(startErrorKey(e)) });
    } finally {
      setStarting(false);
    }
  };
  return {
    setup,
    /** True when `setup` is the device's last setup (the phone shows Quick start only then). */
    repeat: !!last,
    style: setup.style,
    durationSec: setup.durationSec,
    starting,
    start: () => run(setup),
    /** A rated start with the last style (the first-run card's calibration session). */
    startRated: () => run(last?.mode === 'mixed' ? last : ratedSetup),
    ratedMinutes: Math.round((last?.mode === 'mixed' ? last : ratedSetup).durationSec / 60),
  };
}
type QuickStart = ReturnType<typeof useQuickStart>;

/**
 * The phone Home's "since last visit" deltas: each visit compares the
 * levels (D39) with what the previous visit showed (the device record the
 * phone keeps).
 */
function useSeenRatings(): SeenRatings {
  const [seen, setSeen] = useState<SeenRatings>({});
  useFocusEffect(
    useCallback(() => {
      const uid = useAuthStore.getState().user?.id ?? '';
      const now = useAppStore.getState().progressions;
      setSeen(readLastSeenRatings(uid));
      writeLastSeenRatings(uid, { bullet: levelFor(now.bullet), blitz: levelFor(now.blitz), rapid: levelFor(now.rapid) });
    }, []),
  );
  return seen;
}

export function DxHome() {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const user = useAuthStore((s) => s.user);
  const streak = useAppStore((s) => s.streak);
  const showStreak = useAppStore((s) => s.settings.showStreak);
  useQuery(meQuery);
  const overview = useQuery({ ...overviewQuery, enabled: !!user });
  const [snap, setSnap] = useState<RunnerSnapshot | null>(readActiveSnapshot);
  // The quick start re-reads the device prefs on each visit (Play may have changed them).
  const [, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setSnap(readActiveSnapshot());
      setVisit((n) => n + 1);
    }, []),
  );
  const quick = useQuickStart();
  const seen = useSeenRatings();
  useHotkeys({ ' ': () => void quick.start() });
  const two = useTwoColumns(900);

  const name = user?.displayName?.trim() || user?.nickname || '';
  const badge = <VerifiedBadge verified={user?.verified} size={20} />;
  const data = overview.data;
  const empty = !!data && (data.lifetime?.sessions ?? data.recentSessions.length) === 0;
  const resume = snap ? <ResumeCard snap={snap} onGone={() => setSnap(null)} t={t} /> : null;

  if (overview.isPending && !data) {
    return (
      <DesktopPage title={greeting(t, name)} titleAfter={badge} testID="dx-home">
        <ActivityIndicator color={dx.ash} style={styles.loading} />
      </DesktopPage>
    );
  }

  if (empty) return <DxHomeEmpty name={name} badge={badge} resume={resume} quick={quick} seen={seen} data={data} two={two} />;

  const date = new Date().toLocaleDateString(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long' });
  const days = showStreak && streak.days > 0 && streakState(streak.days, streak.lastDay) !== 'broken' ? streak.days : 0;
  const subtitle = [cap(date), days ? plural(tn, 'dx.home.streak', days) : null].filter(Boolean).join(' · ');
  const recent = data?.recentSessions ?? [];

  const aside = (
    <>
      <ReviewCard />
      <LeagueCard />
      <CourseCard />
    </>
  );

  return (
    <DesktopPage title={greeting(t, name)} titleAfter={badge} subtitle={subtitle} aside={two ? aside : undefined} testID="dx-home">
      <Col>
        {resume}
        <Hero quick={quick} seen={seen} />
        <StyleTiles selected={quick.style} seen={seen} data={data} />
        <ChartCard style={quick.style} />
        <RecentCard rows={recent} error={overview.isError && !data} retry={() => void overview.refetch()} />
        {two ? null : <View style={styles.stacked}>{aside}</View>}
      </Col>
    </DesktopPage>
  );
}

// ── Data rich ───────────────────────────────────────────────────────────

/** The quick start's plate label and its one-line setup (the phone's "Blitz · 5 min · Fork"). */
function describeSetup(t: TFn, lang: 'en' | 'uk', setup: SessionSetup, prog: Progression) {
  const themeName = setup.mode === 'theme' && setup.theme ? themeLabel(setup.theme, lang) : null;
  // Casual and theme drills repeat their picked difficulty (the phone's repeatStartRating).
  const startRating = setup.mode === 'mixed' ? null : repeatStartRating(setup, prog);
  const plate = setup.mode === 'mixed' ? t('play.start_rated') : themeName ? t('play.start_drill', { theme: themeName }) : t('play.start_casual');
  const label = [
    t(`style.${setup.style}.name`),
    `${Math.round(setup.durationSec / 60)} ${t('play.minutes')}`,
    themeName ?? t(setup.mode === 'casual' ? 'play.type.casual' : 'play.mode.mixed'),
    startRating != null ? String(startRating) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { startRating, plate, label };
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function Hero({ quick, seen }: { quick: QuickStart; seen: SeenRatings }) {
  const t = useT();
  const { lang } = useLang();
  const { setup } = quick;
  const prog = useAppStore((s) => s.progressions[setup.style]);
  const level = levelFor(prog);
  const delta = levelDelta(seen, setup.style, level);
  // Two sessions in a row under level − 50 drop it; after the first one the hero warns.
  const guarded = (prog.levelGuard ?? 0) > 0;
  const styleName = t(`style.${setup.style}.name`);
  const minutes = `${Math.round(setup.durationSec / 60)} ${t('play.minutes')}`;
  const Glyph = STYLE_GLYPH[setup.style];
  const { startRating, plate, label: setupLabel } = describeSetup(t, lang, setup, prog);
  // Below ~760 px (a 1280 window with the right column, or a 1024 one) the
  // Start group leaves the row and runs full width under the rating.
  const [w, setW] = useState(0);
  const narrow = w > 0 && w < 760;
  const ghostH = narrow ? 44 : 40;
  return (
    <Card texture style={[styles.hero, narrow && styles.heroNarrow]} testID="dx-home-hero">
      <View style={StyleSheet.absoluteFill} onLayout={(e) => setW(e.nativeEvent.layout.width)} pointerEvents="none" />
      <View style={styles.glow} pointerEvents="none">
        <Svg width={340} height={340}>
          <Defs>
            <RadialGradient id="dx-home-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tone.emberGlow} stopOpacity={0.25} />
              <Stop offset="0.65" stopColor={eos.ink} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={170} cy={170} r={170} fill="url(#dx-home-glow)" />
        </Svg>
      </View>
      <Image source={bandIcon(level)} style={styles.heroEye} contentFit="contain" transition={null} />
      <View style={styles.flex}>
        <Label color={tone.rose}>{t('dx.home.level_label', { style: styleName })}</Label>
        <View style={styles.heroRating}>
          <Num size={44} style={styles.lh50}>
            {String(level)}
          </Num>
          {delta ? <Pill tone={delta > 0 ? 'sage' : 'rose'} label={t('dx.home.since_visit', { delta: signed(delta) })} /> : null}
        </View>
        <View style={[styles.heroBar, styles.heroFoot]}>
          <DText size={12.5} color={dx.ash} numberOfLines={2}>
            {t('dx.home.level_start', { level })}
          </DText>
          <DText size={12.5} color={guarded ? tone.rose : dx.dust} numberOfLines={2} testID="dx-home-level-next">
            {guarded ? t('dx.home.level_guard') : t('dx.home.next_mark', { next: level + LEVEL_STEP })}
          </DText>
        </View>
      </View>
      <View style={narrow ? styles.heroCtasNarrow : styles.heroCtas}>
        <PlateButton
          testID="dx-home-play"
          label={plate}
          accessibilityLabel={quick.repeat ? t('home.quick_start_aria', { setup: setupLabel }) : plate}
          // One row with the ghosts when narrow: one height (44) and one centre line.
          size={narrow ? 'md' : 'lg'}
          block={!narrow}
          loading={quick.starting}
          onPress={() => void quick.start()}
          style={narrow ? styles.flex : undefined}
        />
        <View style={[styles.row8, narrow && styles.flex]}>
          <GhostButton
            testID="dx-home-duration"
            height={ghostH}
            accessibilityLabel={t('dx.home.change_setup', { value: minutes })}
            label={minutes}
            onPress={() => router.navigate('/play' as Href)}
            style={styles.flex}
          />
          <GhostButton
            testID="dx-home-style"
            height={ghostH}
            accessibilityLabel={t('dx.home.change_setup', { value: styleName })}
            label={styleName}
            icon={Glyph}
            onPress={() => router.navigate('/play' as Href)}
            style={styles.flex}
          />
          {startRating != null ? (
            <GhostButton
              testID="dx-home-start-rating"
            height={ghostH}
              accessibilityLabel={t('dx.home.change_setup', { value: `${t('play.difficulty')} ${startRating}` })}
              label={String(startRating)}
              icon={Target}
              onPress={() => router.navigate('/play' as Href)}
              style={styles.flex}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/** The three style levels (with the change since the last visit), then the phone's Peak and Sessions tiles. */
function StyleTiles({ selected, seen, data, empty }: { selected: TrainingStyle; seen: SeenRatings; data: Overview | undefined; empty?: boolean }) {
  const t = useT();
  const tn = useTn();
  const progressions = useAppStore((s) => s.progressions);
  const sessions = data?.lifetime?.sessions ?? data?.recentSessions.length ?? 0;
  return (
    <View style={styles.tiles}>
      {UI_STYLE_ORDER.map((st) => {
        const prog = progressions[st];
        const level = levelFor(prog);
        const delta = levelDelta(seen, st, level);
        const settling = prog.calibrationSessionsLeft;
        return (
          <StatTile
            key={st}
            testID={`dx-home-style-${st}`}
            label={t(`style.${st}.name`)}
            value={String(level)}
            icon={STYLE_GLYPH[st]}
            caption={empty && settling > 0 ? plural(tn, 'dx.home.settling', settling) : t('dx.home.next_mark', { next: level + LEVEL_STEP })}
            // A blank keeps the label rows of all the tiles the same height.
            delta={delta ? signed(delta) : ' '}
            deltaColor={delta < 0 ? tone.rose : dx.sage}
            picked={st === selected}
            style={styles.tile}
          />
        );
      })}
      <StatTile testID="dx-home-peak" label={t('profile.peak')} value={data?.allTimePeak ? String(data.allTimePeak) : '—'} caption={t('dx.home.peak_caption')} icon={Trophy} delta=" " style={styles.tile} />
      <StatTile testID="dx-home-sessions" label={t('dashboard.sessions')} value={String(sessions)} icon={History} delta=" " style={styles.tile} />
    </View>
  );
}

function ChartCard({ style }: { style: TrainingStyle }) {
  const t = useT();
  const [range, setRange] = useState<Range>('30d');
  const timeline = useQuery(timelineQuery());
  const days = RANGE_DAYS[range];
  const since = rangeStart(days);
  const points = toLevelPoints(timeline.data).filter((p) => p.style === style && +new Date(p.endedAt) >= since);
  const styleName = t(`style.${style}.name`);
  return (
    <Card style={styles.chart} testID="dx-home-chart">
      <View style={styles.rowCenter}>
        <Label>{t('dx.home.chart_title', { style: styleName, range: t(`dx.home.range_long.${range}`) })}</Label>
        <View style={styles.flex} />
        <Seg
          small
          testID="dx-home-range"
          accessibilityLabel={t('dx.home.chart_range')}
          value={range}
          onChange={setRange}
          style={styles.range}
          options={(['7d', '30d', 'all'] as const).map((r) => ({ value: r, label: t(`dx.home.range.${r}`) }))}
        />
      </View>
      <View style={styles.chartBody}>
        {timeline.isPending ? (
          <ActivityIndicator color={dx.ash} />
        ) : points.length < 2 ? (
          <DText size={13} color={dx.dust} testID="dx-home-chart-empty">
            {t('dx.home.chart_empty')}
          </DText>
        ) : (
          <RatingLine
            points={points}
            testID="dx-home-chart-line"
            accessibilityLabel={t('dx.home.chart_a11y', { style: styleName, from: points[0].rating, to: points[points.length - 1].rating, n: points.length })}
          />
        )}
      </View>
    </Card>
  );
}

function RecentCard({ rows, error, retry }: { rows: readonly SessionRow[]; error: boolean; retry: () => void }) {
  const t = useT();
  const shown = rows.slice(0, RECENT);
  return (
    <Card style={styles.recent} testID="dx-home-recent">
      <View style={styles.rowCenter}>
        <Label>{t('dashboard.recent')}</Label>
        <View style={styles.flex} />
        {shown.length > 0 ? (
          <Hover testID="dx-home-all-sessions" accessibilityRole="link" accessibilityLabel={t('home.all_sessions')} onPress={() => router.push('/sessions' as Href)} style={styles.allLink}>
            <DText size={13} color={dx.ash}>
              {t('dx.home.all')}
            </DText>
            <ChevronRight size={14} color={dx.ash} strokeWidth={1.8} />
          </Hover>
        ) : null}
      </View>
      {error ? (
        <View style={styles.recentState}>
          <DText size={13} color={dx.dust}>
            {t('home.error')}
          </DText>
          <TextButton testID="dx-home-retry" accessibilityLabel={t('home.retry')} label={t('home.retry')} onPress={retry} />
        </View>
      ) : shown.length === 0 ? (
        <DText size={13} color={dx.dust} style={styles.recentState}>
          {t('dashboard.empty')}
        </DText>
      ) : (
        <View style={styles.mt6}>
          {shown.map((r, i) => (
            <SessionLine key={r.id} row={r} first={i === 0} />
          ))}
        </View>
      )}
    </Card>
  );
}

/** A recent session: the phone's SessionRow data (start → peak, accuracy, avg time, duration) as a table row. */
function SessionLine({ row, first }: { row: SessionRow; first: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const style = row.style && isTrainingStyle(row.style) ? row.style : null;
  const styleName = style ? t(`style.${style}.name`) : '';
  const title =
    row.mode === 'theme' && row.theme
      ? `${t('play.theme')} · ${themeLabel(row.theme, lang)}`
      : [t(row.mode === 'casual' ? 'play.type.casual' : 'play.type.rated'), styleName].filter(Boolean).join(' · ');
  const when = whenLabel(row.startedAt, lang, t);
  const total = row.solved + row.failed;
  const acc = pct(row.accuracy);
  const avg = responseTime(row.avgResponseMs);
  const duration = t('sessions.minutes', { n: Math.round(row.durationSec / 60) });
  const delta = row.peakRating - row.startRating;
  const deltaColor = delta > 0 ? dx.sage : delta < 0 ? tone.rose : tone.mist;
  const Glyph = row.mode === 'theme' ? Target : style ? STYLE_GLYPH[style] : Target;
  return (
    <Hover
      testID={`dx-home-session-${row.id}`}
      accessibilityRole="link"
      accessibilityLabel={t('dx.home.row_a11y', { title, when, solved: row.solved, total, acc, start: row.startRating, peak: row.peakRating, avg, duration })}
      onPress={() => router.push(`/sessions/${encodeURIComponent(row.id)}` as Href)}
      style={[styles.session, !first && styles.sessionRule]}
      hoverStyle={styles.sessionHover}
    >
      <View style={styles.sessionIcon}>
        {row.mode === 'theme' && row.theme ? <ThemeIcon slug={row.theme} size={16} color={tone.rose} /> : <Glyph size={17} color={tone.rose} strokeWidth={1.8} />}
      </View>
      <View style={styles.flex}>
        <DText size={14} weight={700} numberOfLines={1}>
          {title}
        </DText>
        <DText size={12} color={dx.dust} numberOfLines={1}>
          {[when, duration, avg].join(' · ')}
        </DText>
      </View>
      <DText size={13} color={dx.ash} tabular style={styles.colSolved}>{`${row.solved}/${total}`}</DText>
      <DText size={13} color={dx.ash} tabular style={styles.colAcc}>
        {acc}
      </DText>
      <View style={styles.colRating}>
        <DText size={13} color={dx.ash} tabular>
          {String(row.startRating)}
        </DText>
        <ChevronRight size={12} color={dx.dust} strokeWidth={1.8} />
        <DText size={13} weight={700} color={delta === 0 ? dx.bone : deltaColor} tabular>
          {String(row.peakRating)}
        </DText>
      </View>
      <DText size={13.5} weight={800} tabular color={deltaColor} style={styles.colDelta}>
        {delta === 0 ? '—' : signed(delta)}
      </DText>
    </Hover>
  );
}

// ── Right column ────────────────────────────────────────────────────────

function ReviewCard() {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const q = useQuery({ queryKey: reviewKeys.themes(), queryFn: () => reviewApi.themes() });
  const rows = q.data ?? [];
  const waiting = rows.reduce((n, r) => n + r.count, 0);
  const top = [...rows].sort((a, b) => b.count - a.count).slice(0, 3);
  return (
    <Card style={styles.side} testID="dx-home-review">
      <View style={styles.rowCenter}>
        <Label>{t('review.title')}</Label>
        <View style={styles.flex} />
        {waiting > 0 ? <Pill tone="rose" label={plural(tn, 'dx.home.review_waiting', waiting)} /> : null}
      </View>
      <DText size={13.5} lh={20} color={dx.ash} style={styles.mt10}>
        {q.data && waiting === 0 ? t('dx.home.review_empty') : t('dx.home.review_body')}
      </DText>
      {top.length > 0 ? (
        <View style={styles.chips}>
          {top.map((r) => (
            <View key={r.slug} style={styles.themeChip}>
              <ThemeIcon slug={r.slug} size={13} color={tone.rose} />
              <DText size={12} weight={700} color={dx.ash} numberOfLines={1}>{`${themeLabel(r.slug, lang)} ·${r.count}`}</DText>
            </View>
          ))}
        </View>
      ) : null}
      {waiting > 0 ? (
        <PlateButton testID="dx-home-review-cta" label={t('dx.home.review_cta')} variant="slate" size="sm" block onPress={() => router.push('/review' as Href)} style={styles.mt14} />
      ) : null}
    </Card>
  );
}

function weekLeft(t: TFn, endIso: string): string {
  const h = Math.max(0, Math.floor((new Date(endIso).getTime() - Date.now()) / 3600_000));
  return h >= 24 ? t('league.left_dh', { d: Math.floor(h / 24), h: h % 24 }) : t('league.left_h', { h: Math.max(1, h) });
}

function LeagueCard() {
  const t = useT();
  const q = useQuery(leagueQuery(readBoardScope()));
  const rows = q.data?.rows ?? [];
  const self = q.data?.self ?? rows.find((r) => r.isSelf) ?? null;
  let shown: LeagueRow[] = rows.slice(0, LEAGUE_ROWS);
  if (self && !shown.some((r) => r.isSelf) && self.rank != null) shown = [...rows.slice(0, LEAGUE_ROWS - 1), self];
  return (
    <Card style={styles.side} testID="dx-home-league">
      <Hover testID="dx-home-league-open" accessibilityRole="link" accessibilityLabel={t('dx.home.league')} onPress={() => router.navigate('/rivals' as Href)} style={styles.rowCenter}>
        <Label>{t('dx.home.league')}</Label>
        <View style={styles.flex} />
        {q.data ? (
          <DText size={12} color={dx.dust}>
            {t('dx.home.league_left', { left: weekLeft(t, q.data.weekEnd) })}
          </DText>
        ) : null}
      </Hover>
      {q.data && shown.length === 0 ? (
        <DText size={13} color={dx.dust} style={styles.mt10}>
          {t('dx.home.league_empty')}
        </DText>
      ) : (
        <View style={styles.mt10}>
          {shown.map((r, i) => (
            <Hover
              key={r.user.id}
              testID={r.isSelf ? 'dx-home-league-me' : `dx-home-league-${i + 1}`}
              accessibilityRole="link"
              accessibilityLabel={t('league.rank_a11y', { rank: r.rank ?? '—', name: r.isSelf ? t('dx.home.you') : r.user.displayName || r.user.nickname, xp: r.xp })}
              onPress={() => router.push(`/profile/${encodeURIComponent(r.user.nickname)}` as Href)}
              style={[styles.leagueRow, r.isSelf && styles.leagueMe]}
              hoverStyle={r.isSelf ? styles.leagueMe : styles.sessionHover}
            >
              <DText size={12.5} weight={800} color={dx.dust} tabular style={styles.rank}>
                {r.rank != null ? String(r.rank) : '—'}
              </DText>
              <Avatar nickname={r.user.nickname} avatarUrl={r.user.avatarUrl} size={26} />
              <DText size={13.5} weight={700} numberOfLines={1} style={styles.flex}>
                {r.isSelf ? t('dx.home.you') : r.user.displayName || r.user.nickname}
              </DText>
              <DText size={12.5} weight={700} color={dx.ash} tabular>
                {t('dx.home.xp', { n: r.xp.toLocaleString() })}
              </DText>
            </Hover>
          ))}
        </View>
      )}
    </Card>
  );
}

/** The course played last (Continue), else the suggested one for the player's level. */
function CourseCard() {
  const t = useT();
  const { lang } = useLang();
  const data = useLearnCourses();
  const progress = useCourseProgressMap(data);
  const prog = useAppStore((s) => s.progressions[readLastStyle()]);
  const level = prog ? levelFor(prog) : null;
  const courses = data.courses ?? [];
  if (courses.length === 0) return null;
  const lastId = lastPlayedIn(data.attempts, new Set(courses.map((c) => c.id)));
  const current = courses.find((c) => c.id === lastId) ?? null;
  const p = current ? progress.get(current.id) : null;
  if (current && p) {
    const { done, total } = lessonTotals(p);
    const next = p.next;
    const where = next && next.chapterIndex < current.chapters.length ? t('dx.home.chapter', { n: next.chapterIndex + 1 }) : t('dx.home.exam');
    return (
      <Hover
        testID="dx-home-course"
        accessibilityRole="link"
        accessibilityLabel={`${t('dx.home.continue_course')}: ${localized(current.title, lang)}`}
        onPress={() => router.push(`/course/${encodeURIComponent(current.id)}` as Href)}
        style={[styles.card, styles.course]}
        hoverStyle={styles.cardHover}
      >
        <Image source={PIECES[current.piece]} style={styles.coursePiece} contentFit="contain" transition={null} />
        <View style={styles.flex}>
          <Label color={tone.rose}>{t('dx.home.continue_course')}</Label>
          <DText size={14.5} weight={700} numberOfLines={1} style={styles.mt2}>{`${localized(current.title, lang)} · ${where}`}</DText>
          <Bar value={total ? done / total : 0} height={4} style={styles.mt8} />
        </View>
      </Hover>
    );
  }
  const suggest = suggestedCourse(courses, level);
  return suggest && level != null ? <SuggestCard course={suggest} level={level} /> : null;
}

function SuggestCard({ course, level }: { course: CourseSummary; level: number }) {
  const t = useT();
  const { lang } = useLang();
  const title = localized(course.title, lang);
  const MARK = '\u0001';
  const [pre, post = ''] = t('dx.home.suggest', { level, course: MARK }).split(MARK);
  return (
    <Card style={styles.side} testID="dx-home-suggest">
      <Label>{t('learn.title')}</Label>
      <DText size={13.5} lh={20} color={dx.ash} style={styles.mt8}>
        {pre}
        <DText size={13.5} lh={20} weight={700}>
          {title}
        </DText>
        {post}
      </DText>
      <Hover
        testID="dx-home-suggest-open"
        accessibilityRole="link"
        accessibilityLabel={title}
        onPress={() => router.push(`/course/${encodeURIComponent(course.id)}` as Href)}
        style={styles.suggestRow}
        hoverStyle={styles.sessionHover}
      >
        <Image source={PIECES[course.piece]} style={styles.suggestPiece} contentFit="contain" transition={null} />
        <View style={styles.flex}>
          <DText size={14} weight={700}>
            {title}
          </DText>
          <DText size={12} color={dx.dust}>
            {t('dx.home.course_meta', { min: course.ratingMin, max: course.ratingMax, n: course.puzzleCount })}
          </DText>
        </View>
      </Hover>
    </Card>
  );
}

// ── New account (DXHomeEmpty) ───────────────────────────────────────────

function DxHomeEmpty({
  name,
  badge,
  resume,
  quick,
  seen,
  data,
  two,
}: {
  name: string;
  badge: ReactNode;
  resume: ReactNode;
  quick: QuickStart;
  seen: SeenRatings;
  data: Overview | undefined;
  two: boolean;
}) {
  const t = useT();
  // The board picture needs the text column beside it to stay readable.
  const roomy = useTwoColumns(1100);
  const aside = (
    <>
      <Checklist />
      <CourseCard />
    </>
  );
  return (
    <DesktopPage title={t('dx.home.welcome', { name })} titleAfter={badge} subtitle={t('dx.home.welcome_sub')} aside={two ? aside : undefined} testID="dx-home-empty">
      <Col>
        {resume}
        <Card texture style={styles.first} testID="dx-home-first">
          <View style={styles.flex}>
            <Label color={tone.rose}>{t('dx.home.first_session')}</Label>
            <DText serif weight={700} size={32} lh={40} style={styles.mt8}>
              {t('dx.home.first_title', { n: quick.ratedMinutes })}
            </DText>
            <DText size={15} lh={23} color={dx.ash} style={styles.firstBody}>
              {t('dx.home.first_body', { n: CALIBRATION_SESSIONS })}
            </DText>
            <View style={styles.firstCtas}>
              <PlateButton testID="dx-home-first-start" label={t('dashboard.start')} size="md" loading={quick.starting} onPress={() => void quick.startRated()} style={styles.firstPlate} />
              <GhostButton testID="dx-home-first-levels" height={44} accessibilityLabel={t('play.level_help')} label={t('play.level_help')} onPress={() => router.push('/play/levels' as Href)} />
            </View>
            {quick.repeat && quick.setup.mode !== 'mixed' ? <QuickStartButton quick={quick} /> : null}
          </View>
          {roomy ? <MiniBoard fen={HERO_FEN} size={260} shadow /> : null}
        </Card>
        <StyleTiles selected={quick.style} seen={seen} data={data} empty />
        <Card style={styles.soon} testID="dx-home-chart-soon">
          <BarChart3 size={22} color={dx.dust} strokeWidth={1.8} />
          <DText size={15} weight={700} style={styles.mt10}>
            {t('dx.home.chart_soon')}
          </DText>
          <DText size={13.5} color={dx.dust} style={styles.mt4}>
            {t('dx.home.chart_soon_sub')}
          </DText>
        </Card>
        {two ? null : <View style={styles.stacked}>{aside}</View>}
      </Col>
    </DesktopPage>
  );
}

/** First run after a casual or theme session: the phone's Quick start repeats it. */
function QuickStartButton({ quick }: { quick: QuickStart }) {
  const t = useT();
  const { lang } = useLang();
  const prog = useAppStore((s) => s.progressions[quick.setup.style]);
  const { label } = describeSetup(t, lang, quick.setup, prog);
  return (
    <GhostButton
      testID="dx-home-quick-start"
      height={44}
      accessibilityLabel={t('home.quick_start_aria', { setup: label })}
      label={`${t('home.quick_start')} · ${label}`}
      icon={Zap}
      onPress={() => void quick.start()}
      style={styles.quickRow}
    />
  );
}

function Checklist() {
  const t = useT();
  const onboarded = useAppStore((s) => s.settings.onboardingCompleted);
  const overview = useQuery(overviewQuery);
  const sessions = overview.data ? (overview.data.lifetime?.sessions ?? overview.data.recentSessions.length) : 0;
  const review = useQuery({ queryKey: reviewKeys.themes(), queryFn: () => reviewApi.themes() });
  const waiting = review.data ? review.data.reduce((n, r) => n + r.count, 0) : null;
  const friends = useQuery(friendsQuery());
  const steps: { key: string; done: boolean; go?: () => void }[] = [
    { key: 'account', done: true },
    { key: 'onboarding', done: onboarded, go: openOnboarding },
    { key: 'session', done: sessions > 0, go: () => router.navigate('/play' as Href) },
    { key: 'review', done: sessions > 0 && waiting === 0, go: () => router.push('/review' as Href) },
    { key: 'friend', done: (friends.data?.length ?? 0) > 0, go: () => router.push('/friends/search' as Href) },
  ];
  return (
    <Card style={styles.checklist} testID="dx-home-checklist">
      <Label>{t('dx.home.checklist')}</Label>
      {steps.map((s, i) => {
        const label = t(`dx.home.step.${s.key}`);
        const body: ReactNode = (
          <>
            <View style={[styles.stepMark, s.done ? styles.stepDone : styles.stepOpen]}>
              {s.done ? (
                <Check size={14} color={tone.cream} strokeWidth={2.4} />
              ) : (
                <DText size={12} weight={800}>
                  {String(i + 1)}
                </DText>
              )}
            </View>
            <DText size={14} color={s.done ? dx.dust : dx.bone} style={s.done ? styles.strike : undefined}>
              {label}
            </DText>
          </>
        );
        return s.done || !s.go ? (
          <View key={s.key} style={styles.step} accessible accessibilityLabel={s.done ? t('dx.home.step_done', { step: label }) : label} testID={`dx-home-step-${s.key}`}>
            {body}
          </View>
        ) : (
          <Hover key={s.key} testID={`dx-home-step-${s.key}`} accessibilityRole="link" accessibilityLabel={label} onPress={s.go} style={styles.step} hoverStyle={styles.stepHover}>
            {body}
          </Hover>
        );
      })}
    </Card>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Epoch ms the chart's range starts at (0: all time). */
function rangeStart(days: number | null): number {
  return days ? Date.now() - days * 86_400_000 : 0;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function greeting(t: TFn, name: string): string {
  const h = new Date().getHours();
  const key = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : h < 23 ? 'evening' : 'night';
  return t(`dx.home.greet_${key}`, { name });
}

/** "Сьогодні, 09:12" / "Вчора, 21:40" / "7 лист., 20:05". */
function whenLabel(iso: string, lang: 'en' | 'uk', t: TFn): string {
  const d = new Date(iso);
  const locale = localeFor(lang);
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  const date = diff === 0 ? t('dx.home.today_day') : diff === 1 ? t('dx.home.yesterday') : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return `${date}, ${time}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt14: { marginTop: 14 },
  lh50: { lineHeight: 50 },
  row8: { flexDirection: 'row', gap: 8 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  loading: { marginTop: 80 },
  stacked: { gap: 16 },
  card: {
    backgroundColor: dx.card,
    borderRadius: 14,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  cardHover: { backgroundColor: dx.sideCardHover },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 28, paddingVertical: 26, paddingHorizontal: 28 },
  glow: {
    position: 'absolute',
    right: -60,
    top: -80,
    width: 340,
    height: 340,
  },
  heroEye: { width: 92, height: 92 },
  heroRating: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  heroBar: { maxWidth: 420, marginTop: 12 },
  heroFoot: { flexDirection: 'row', alignItems: 'baseline', gap: 16 },
  heroCtas: { width: 280, gap: 10 },
  heroNarrow: { flexWrap: 'wrap', rowGap: 20 },
  heroCtasNarrow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: { flexGrow: 1, flexBasis: 128, minWidth: 0 },
  chart: { paddingVertical: 20, paddingHorizontal: 22 },
  range: { width: 220 },
  chartBody: { marginTop: 18, minHeight: 160, justifyContent: 'center' },
  recent: { paddingVertical: 18, paddingHorizontal: 22 },
  allLink: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 4, height: 24 },
  recentState: { paddingVertical: 14, gap: 8, alignItems: 'flex-start' },
  session: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 8 },
  sessionRule: { borderTopWidth: 1, borderTopColor: dx.rowRule, borderRadius: 0 },
  sessionHover: { backgroundColor: alpha(eos.bone, 0.03) },
  sessionIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: dx.ghost },
  colSolved: { width: 70 },
  colAcc: { width: 56 },
  colRating: { width: 104, flexDirection: 'row', alignItems: 'center', gap: 3 },
  colDelta: { width: 52, textAlign: 'right' },
  side: { paddingVertical: 18, paddingHorizontal: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 8 },
  leagueMe: { backgroundColor: alpha(eos.ember, 0.16) },
  rank: { minWidth: 14 },
  course: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18 },
  coursePiece: { width: 44, height: 44 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, padding: 4, borderRadius: 8 },
  suggestPiece: { width: 40, height: 40 },
  first: { flexDirection: 'row', alignItems: 'center', gap: 36, padding: 40 },
  firstBody: { marginTop: 12, maxWidth: 440 },
  firstCtas: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' },
  firstPlate: { minWidth: 200 },
  quickRow: { alignSelf: 'flex-start', maxWidth: '100%', marginTop: 12 },
  soon: { padding: 40, alignItems: 'center' },
  checklist: { padding: 20 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, borderRadius: 8 },
  stepHover: { opacity: 0.85 },
  stepMark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: dx.ember },
  stepOpen: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: dx.barOff, inset: true }] },
  strike: { textDecorationLine: 'line-through' },
});

