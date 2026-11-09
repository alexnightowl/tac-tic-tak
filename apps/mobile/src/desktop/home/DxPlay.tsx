import { UI_STYLE_ORDER, bandFor, paceTarget } from '@tac/core/rules';
import { levelFor, levelProgress } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { BarChart3, BookOpen, Info, MinusCircle, RefreshCcw, Search, Swords, Target } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useIncomingChallenges } from '@/features/challenge/api';
import { plural } from '@/features/offline/format';
import { DIFFICULTY_MAX, DIFFICULTY_MIN, DIFFICULTY_STEP, clampDifficulty, type SetupMode } from '@/features/play/setupPrefs';
import { useThemePick } from '@/features/play/startSession';
import { bandIcon } from '@/features/play/setup/bandIcons';
import { DifficultyReadout, DifficultyTrack } from '@/features/play/setup/DifficultyTrack';
import { PRESET_SPAN, diffDelta, usePlaySetup, type PlaySetup } from '@/features/play/setup/usePlaySetup';
import { ThemeIcon } from '@/features/play/themes/ThemeIcon';
import { pickerItems, themeStatsQuery, type ThemeItem, type ThemeTab } from '@/features/play/themes/ThemePickerSheet';
import { reviewApi, reviewKeys } from '@/features/review/api';
import { stormSummaryQuery } from '@/features/storm/api';
import { Bolt } from '@/features/storm/parts';
import { feel } from '@/feel';
import { PlateButton } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { useHotkeys } from '../hotkeys';
import { Bar, Card, Chip, DText, Hover, KeyHints, Label, Num, Seg, TextButton } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { DxLevelsPanel } from './DxLevelsPanel';
import { STYLE_GLYPH } from './styleGlyph';
import { Card2, Col, DInput, ModeLink, OptionCard, SummaryRow } from './parts';
import { useTwoColumns } from './useTwoColumns';

// /play on a desktop window: DXPlayRated / DXPlayFree / DXPlayThemes. The
// same setup as the phone (usePlaySetup: modes, style, duration incl.
// custom minutes, difficulty, Start), laid out as mode cards, the
// per-mode card, other modes, and a summary column with the Start plate.
// Space starts, 1 2 3 pick the mode; "How levels work" docks DXLevelsInfo
// as a right panel.

const MODES: { mode: SetupMode; key: 'rated' | 'casual' | 'themes'; icon: ReactNode; iconOn: ReactNode }[] = [
  { mode: 'mixed', key: 'rated', icon: <BarChart3 size={18} color={eos.bone} strokeWidth={1.8} />, iconOn: <BarChart3 size={18} color={tone.cream} strokeWidth={1.8} /> },
  { mode: 'casual', key: 'casual', icon: <Target size={18} color={eos.bone} strokeWidth={1.8} />, iconOn: <Target size={18} color={tone.cream} strokeWidth={1.8} /> },
  { mode: 'theme', key: 'themes', icon: <BookOpen size={18} color={eos.bone} strokeWidth={1.8} />, iconOn: <BookOpen size={18} color={tone.cream} strokeWidth={1.8} /> },
];

export function DxPlay({ levelsOpen = false, onLevelsClose }: { levelsOpen?: boolean; onLevelsClose?: () => void } = {}) {
  const s = usePlaySetup();
  const { t } = s;
  const [levels, setLevels] = useState(levelsOpen);
  const two = useTwoColumns(900);
  const closeLevels = () => {
    setLevels(false);
    onLevelsClose?.();
  };

  useHotkeys(
    {
      ' ': () => void s.start(),
      '1': () => s.setMode('mixed'),
      '2': () => s.setMode('casual'),
      '3': () => s.setMode('theme'),
    },
    !levels,
  );

  const summary = <Summary s={s} onLevels={() => setLevels(true)} />;

  return (
    <>
      <DesktopPage title={t('play.new_session')} subtitle={t('dx.home.play_sub')} aside={two ? summary : undefined} asideWidth={320} testID="dx-play">
      <Col>
          <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel={t('play.type')}>
            {MODES.map((m) => {
              const on = s.mode === m.mode;
              return (
                <OptionCard
                  key={m.key}
                  testID={`dx-play-mode-${m.key}`}
                  title={t(`play.type.${m.key}`)}
                  desc={t(`dx.home.mode.${m.key}_desc`)}
                  icon={on ? m.iconOn : m.icon}
                  on={on}
                  onPress={() => {
                    if (!on) feel.emit('segmented');
                    s.setMode(m.mode);
                  }}
                  style={styles.flex}
                />
              );
            })}
          </View>

          <View style={styles.pickers}>
            <View style={styles.flex}>
              <Label style={styles.lblGap}>{t('play.style')}</Label>
              <Seg
                testID="dx-play-style"
                accessibilityLabel={t('play.style')}
                value={s.style}
                onChange={(v) => {
                  feel.emit('segmented');
                  s.selectStyle(v);
                }}
                options={UI_STYLE_ORDER.map((v) => ({ value: v, label: t(`style.${v}.name`), icon: STYLE_GLYPH[v] }))}
              />
            </View>
            <View style={styles.flex}>
              <Label style={styles.lblGap}>{t('play.duration')}</Label>
              <Seg
                testID="dx-play-duration"
                accessibilityLabel={t('play.duration')}
                value={s.dur.custom ? 'custom' : String(s.dur.duration)}
                onChange={(v) => {
                  feel.emit('segmented');
                  s.selectDuration(v);
                }}
                options={[
                  ...s.presets.map((d) => ({ value: String(d), label: `${d / 60} ${t('play.minutes')}` })),
                  { value: 'custom', label: t('play.custom') },
                ]}
              />
              {s.dur.custom ? (
                <View style={styles.customRow}>
                  <DInput
                    testID="dx-play-custom-minutes"
                    accessibilityLabel={t('play.custom_minutes')}
                    autoFocus={s.focusCustom}
                    value={s.dur.customMinutes}
                    onChangeText={s.onMinutes}
                    onBlur={s.normaliseMinutes}
                    inputMode="numeric"
                    maxLength={2}
                    height={36}
                    style={styles.customInput}
                  />
                  <DText size={13} color={dx.ash}>
                    {t('dx.home.minutes_range', { min: s.minMinutes, max: s.maxMinutes })}
                  </DText>
                </View>
              ) : null}
            </View>
          </View>

          {s.rated ? <RatedCard s={s} /> : <DifficultyCard s={s} />}
          {s.mode === 'theme' ? <ThemeGrid /> : null}

          {s.err ? (
            <DText size={13.5} color={tone.danger} testID="dx-play-error" accessibilityLiveRegion="polite">
              {s.err}
            </DText>
          ) : null}

          <Label style={styles.othersLabel}>{t('dx.home.other_modes')}</Label>
          <OtherModes />

          {two ? null : <View style={styles.stackedAside}>{summary}</View>}
      </Col>
      </DesktopPage>
      {levels ? <DxLevelsPanel style={s.style} onClose={closeLevels} /> : null}
    </>
  );
}

/** Rated: the eye, rating, band and level, the bar to the next level. */
function RatedCard({ s }: { s: PlaySetup }) {
  const { t } = s;
  const level = levelFor(s.prog);
  const p = levelProgress(s.rating, level);
  return (
    <Card texture style={styles.rated} testID="dx-play-rated">
      <Image source={bandIcon(s.rating)} style={styles.eye} contentFit="contain" transition={null} />
      <View style={styles.flex}>
        <Label>{t('play.your_rating', { style: t(`style.${s.style}.name`) })}</Label>
        <View style={styles.ratingRow}>
          <Num size={34}>{String(s.rating)}</Num>
          <DText size={14} color={dx.ash} numberOfLines={1} style={styles.shrink}>
            {t('dx.home.rated_line', { band: s.bandLabels[bandFor(s.rating).key], level: t('play.level', { level }) })}
          </DText>
        </View>
        <Bar value={p.ratio} style={styles.mt10} />
        <View style={styles.barFoot}>
          <DText size={12} color={dx.dust} numberOfLines={1} style={styles.shrink}>
            {t('dx.home.rated_hint', { next: p.next, pace: paceTarget(s.style, s.effectiveDuration) })}
          </DText>
          <DText size={12} color={dx.dust} tabular>{`${level} → ${p.next}`}</DText>
        </View>
      </View>
    </Card>
  );
}

/** Casual / Themes: the phone's difficulty slider, presets and the unrated note. */
function DifficultyCard({ s }: { s: PlaySetup }) {
  const { t } = s;
  const presets = [
    ['warmup', s.rating - PRESET_SPAN, '−200'],
    ['level', s.rating, ''],
    ['push', s.rating + PRESET_SPAN, '+200'],
  ] as const;
  return (
    <Card style={styles.diff} testID="dx-play-difficulty">
      <View style={styles.diffHead}>
        <Label>{t('play.difficulty')}</Label>
        <View style={styles.flex} />
        <DifficultyReadout live={s.live} bandLabels={s.bandLabels} />
      </View>
      <View style={styles.track}>
        <DifficultyTrack
          testID="dx-play-slider"
          accessibilityLabel={t('play.difficulty')}
          value={s.difficulty}
          live={s.live}
          onChange={s.setDifficulty}
          me={s.rating}
          min={DIFFICULTY_MIN}
          max={DIFFICULTY_MAX}
          step={DIFFICULTY_STEP}
          youLabel={t('play.you_marker', { rating: s.rating })}
          easierLabel={t('play.easier')}
          harderLabel={t('play.harder')}
        />
      </View>
      <View style={styles.chips}>
        {presets.map(([key, v, suffix]) => {
          const value = clampDifficulty(v);
          const label = suffix ? `${t(`play.preset.${key}`)} ${suffix}` : t(`play.preset.${key}`);
          return (
            <Chip
              key={key}
              testID={`dx-play-preset-${key}`}
              accessibilityLabel={`${t(`play.preset.${key}`)}, ${value}`}
              label={label}
              on={value === s.difficulty}
              onPress={() => {
                feel.emit('sliderDetent');
                s.setDifficulty(value);
              }}
            />
          );
        })}
      </View>
      <View style={styles.note}>
        <MinusCircle size={14} color={dx.dust} strokeWidth={1.8} />
        <DText size={12.5} color={dx.dust} style={styles.flex} testID="dx-play-diff-note">
          {`${diffDelta(s.difficulty - s.rating, t)} · ${s.mode === 'theme' ? t('play.diff_themes') : t('play.diff_casual')}`}
        </DText>
      </View>
    </Card>
  );
}

/** Themes: the theme picker inline (Weakest / Popular / All, search, 4-column grid). */
function ThemeGrid() {
  const s = usePlaySetupT();
  const { t, lang } = s;
  const theme = useThemePick((st) => st.theme);
  const setTheme = useThemePick((st) => st.setTheme);
  const [tab, setTab] = useState<ThemeTab>('weakest');
  const [query, setQuery] = useState('');
  const stats = useQuery(themeStatsQuery);
  const { items, tactical } = pickerItems(stats.data, tab, query, lang);
  const allCount = pickerItems(stats.data, 'all', '', lang).items.length;
  const needsStats = tab !== 'all';
  const maxAttempts = Math.max(1, ...tactical.map((r) => r.attempts));

  const grid = (list: ThemeItem[], lens: ThemeTab) => (
    <View style={styles.grid}>
      {list.map((it) => (
        <ThemeTile
          key={it.slug}
          item={it}
          tab={lens}
          on={it.slug === theme}
          maxAttempts={maxAttempts}
          onPress={() => {
            feel.emit('segmented');
            setTheme(it.slug);
          }}
        />
      ))}
    </View>
  );

  let body: ReactNode;
  if (needsStats && stats.isPending) body = <ActivityIndicator color={dx.ash} style={styles.state} />;
  else if (needsStats && stats.isError) body = <StateText text={t('play.themes_error')} />;
  else if (needsStats && stats.isSuccess && tactical.length === 0) {
    // Nothing played yet: say so, and still offer every theme (the phone's All tab).
    body = (
      <>
        <StateText text={t('play.themes_no_stats')} testID="dx-play-themes-no-stats" />
        {grid(pickerItems(stats.data, 'all', query, lang).items, 'all')}
      </>
    );
  } else if (items.length === 0) body = <StateText text={t('play.no_themes_match')} />;
  else body = grid(items, tab);

  return (
    <Card style={styles.themes} testID="dx-play-themes">
      <View style={styles.themesHead}>
        <Label>{t('play.theme')}</Label>
        <View style={styles.flex} />
        <Seg
          small
          testID="dx-play-theme-tab"
          accessibilityLabel={t('play.choose_theme')}
          value={tab}
          onChange={setTab}
          style={styles.tabs}
          options={[
            { value: 'weakest', label: t('play.themes_tab_weakest') },
            { value: 'popular', label: t('play.themes_tab_popular') },
            { value: 'all', label: t('dx.home.themes_all', { n: allCount }) },
          ]}
        />
        <DInput
          testID="dx-play-theme-search"
          accessibilityLabel={t('play.search_themes')}
          placeholder={t('play.search_themes')}
          value={query}
          onChangeText={setQuery}
          icon={Search}
          height={36}
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.search}
        />
      </View>
      {body}
      <DText size={12} color={dx.dust} style={styles.mt12}>
        {t(`dx.home.themes_note.${tab}`)}
      </DText>
    </Card>
  );
}

function ThemeTile({ item, tab, on, maxAttempts, onPress }: { item: ThemeItem; tab: ThemeTab; on: boolean; maxAttempts: number; onPress: () => void }) {
  const { t, lang } = usePlaySetupT();
  const label = themeLabel(item.slug, lang);
  const r = item.row;
  let stat: string | null = null;
  let aria: string | null = null;
  let bar: { value: number; color: string } | null = null;
  if (r && tab === 'weakest') {
    const pct = Math.round((1 - r.failureRate) * 100);
    stat = `${pct}%`;
    aria = t('dx.home.theme_acc_aria', { pct });
    bar = { value: pct / 100, color: pct < 50 ? tone.emberGlow : pct < 65 ? dx.barTo : tone.sageDeep };
  } else if (r && tab === 'popular') {
    stat = String(r.attempts);
    aria = t('play.theme_attempts_aria', { n: r.attempts });
    bar = { value: r.attempts / maxAttempts, color: dx.barTo };
  } else if (r && tab === 'all' && r.rating > 0) {
    stat = String(Math.round(r.rating));
    aria = t('play.theme_rating_aria', { n: Math.round(r.rating) });
  }
  return (
    <Hover
      testID={`dx-play-theme-${item.slug}`}
      accessibilityRole="radio"
      accessibilityLabel={aria ? `${label}, ${aria}` : label}
      selected={on}
      onPress={onPress}
      style={[styles.tile, on && styles.tileOn]}
      hoverStyle={on ? undefined : styles.tileHover}
    >
      <View style={styles.tileIcon}>
        <ThemeIcon slug={item.slug} size={16} color={on ? tone.rose : eos.ash} />
      </View>
      <View style={styles.flex}>
        <DText size={13.5} weight={700} numberOfLines={2} lh={17}>
          {label}
        </DText>
        {bar ? <Bar value={bar.value} height={4} colors={[bar.color, bar.color]} style={styles.mt6} /> : null}
      </View>
      {stat ? (
        <DText size={11.5} weight={800} color={dx.dust} tabular>
          {stat}
        </DText>
      ) : null}
    </Hover>
  );
}

function StateText({ text, testID }: { text: string; testID?: string }) {
  return (
    <DText size={13} color={dx.dust} style={styles.state} testID={testID}>
      {text}
    </DText>
  );
}

/** Storm, Challenge, Review: the phone's entry rows as three cards. */
export function OtherModes() {
  const s = usePlaySetupT();
  const { t } = s;
  const tn = useTn();
  const storm = useQuery(stormSummaryQuery());
  const best = storm.data?.best?.score;
  const { count } = useIncomingChallenges();
  const review = useQuery({ queryKey: reviewKeys.themes(), queryFn: () => reviewApi.themes() });
  const waiting = review.data ? review.data.reduce((n, r) => n + r.count, 0) : null;
  const reviewSub = waiting == null ? t('learn.review_entry.hint') : waiting > 0 ? plural(tn, 'learn.review_entry.waiting', waiting) : t('learn.review_entry.empty');
  return (
    <View style={styles.others}>
      <ModeLink
        testID="dx-play-storm"
        title={t('storm.title')}
        sub={best != null ? t('dx.home.storm_sub', { n: best }) : t('storm.entry.hint')}
        glyph={<Bolt size={18} color={tone.rose} />}
        onPress={() => router.push('/storm' as Href)}
      />
      <ModeLink
        testID="dx-play-challenge"
        title={t('challenge.entry.title')}
        sub={count > 0 ? plural(tn, 'challenge.entry.incoming', count) : t('challenge.entry.hint')}
        icon={Swords}
        onPress={() => router.push('/challenge/new' as Href)}
      />
      <ModeLink testID="dx-play-review" title={t('review.title')} sub={reviewSub} icon={RefreshCcw} onPress={() => router.push('/review' as Href)} />
    </View>
  );
}

/** Summary column: the picks, Start, the key hints, the calibration note, "How levels work". */
function Summary({ s, onLevels }: { s: PlaySetup; onLevels: () => void }) {
  const { t } = s;
  const tn = useTn();
  const minutes = Math.round(s.effectiveDuration / 60);
  const modeName = s.mode === 'theme' ? `${t('play.type.themes')} · ${themeLabel(s.theme, s.lang)}` : t(`play.type.${s.rated ? 'rated' : 'casual'}`);
  const settling = s.prog.calibrationSessionsLeft;
  return (
    <Card style={styles.summary} testID="dx-play-summary">
      <Label>{t('dx.home.summary')}</Label>
      <View style={styles.mt4}>
        <SummaryRow label={t('dx.home.sum.mode')} value={modeName} testID="dx-play-sum-mode" />
        <SummaryRow label={t('dx.home.sum.style')} value={t(`style.${s.style}.name`)} />
        <SummaryRow label={t('dx.home.sum.duration')} value={`${minutes} ${t('play.minutes')}`} testID="dx-play-sum-duration" />
        <SummaryRow label={t('dx.home.sum.difficulty')} value={s.rated ? `~${s.rating}` : String(s.difficulty)} testID="dx-play-sum-difficulty" />
        <SummaryRow label={t('dx.home.sum.rating')} value={s.rated ? t('dx.home.sum.changes') : t('dx.home.sum.unchanged')} last />
      </View>
      <PlateButton
        testID="dx-play-start"
        label={s.loading ? t('play.starting') : s.cta}
        onPress={() => void s.start()}
        loading={s.loading}
        disabled={s.customInvalid}
        size="lg"
        block
        style={styles.mt20}
      />
      <KeyHints
        style={styles.mt12}
        items={[
          { keys: ['Space'], label: t('dx.home.key_start') },
          { keys: ['1', '2', '3'], label: t('dx.home.key_mode') },
        ]}
      />
      {s.rated && settling > 0 ? (
        <Card2 style={styles.calib} testID="dx-play-settling">
          <Info size={16} color={tone.gold} strokeWidth={1.8} />
          <DText size={12.5} lh={18} color={dx.ash} style={styles.flex}>
            {plural(tn, 'dx.home.calibration', settling)}
          </DText>
        </Card2>
      ) : null}
      <TextButton
        testID="dx-play-levels"
        accessibilityLabel={t('play.level_help')}
        label={t('play.level_help')}
        icon={Info}
        size={12.5}
        underline
        onPress={onLevels}
        style={styles.levelsLink}
      />
    </Card>
  );
}

/** t + lang without the whole setup state (sub-components that only print). */
function usePlaySetupT() {
  const t = useT();
  const { lang } = useLang();
  return { t, lang };
}


const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt20: { marginTop: 20 },
  lblGap: { marginBottom: 10 },
  modes: { flexDirection: 'row', gap: 12 },
  pickers: { flexDirection: 'row', gap: 16 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  customInput: { width: 72 },
  rated: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 20, paddingHorizontal: 22 },
  eye: { width: 64, height: 64 },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 },
  barFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  diff: { paddingVertical: 20, paddingHorizontal: 22 },
  diffHead: { flexDirection: 'row', alignItems: 'center' },
  track: { marginTop: 14 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 16 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  themes: { paddingVertical: 20, paddingHorizontal: 22 },
  themesHead: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  tabs: { width: 300 },
  search: { width: 200 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  tile: {
    flexBasis: '23%',
    flexGrow: 1,
    minWidth: 150,
    maxWidth: '25%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  tileOn: { backgroundColor: dx.pickedBg, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: dx.ember, inset: true }] },
  tileHover: { backgroundColor: dx.ghostHover },
  tileIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: eos.rise },
  state: { paddingTop: 16, paddingBottom: 2 },
  othersLabel: { marginTop: 6 },
  others: { flexDirection: 'row', gap: 12 },
  stackedAside: { marginTop: 8 },
  summary: { padding: 22 },
  calib: { flexDirection: 'row', gap: 10, marginTop: 18, paddingVertical: 12, paddingHorizontal: 14 },
  levelsLink: { alignSelf: 'center', marginTop: 10 },
});
