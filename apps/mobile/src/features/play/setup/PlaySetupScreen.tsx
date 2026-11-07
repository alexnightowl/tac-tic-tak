import { CALIBRATION_SESSIONS, STYLE_FORMULAS, UI_STYLE_ORDER, bandFor, type BandKey, type TrainingStyle } from '@tac/core/rules';
import { levelFor, levelProgress } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { control, eos, layout, mixed, radii, semantic, space, surface, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronRight, CloudOff, Coffee, MinusCircle, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChallengeEntry } from '@/features/challenge/ChallengeEntry';
import { OfflineEntry } from '@/features/offline/OfflineEntry';
import { StormEntry } from '@/features/storm/StormEntry';
import { useAppStore } from '@/stores/appStore';
import { AppText, Card, Input, PlateButton, Segmented, useLang } from '@/ui';
import { fontFamily } from '@/ui/fonts';
import { Tap } from '@/ui/Tap';
import {
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  DIFFICULTY_STEP,
  clampDifficulty,
  clampMinutes,
  minuteRange,
  readLastStyle,
  resolveDurationFor,
  writeLastDuration,
  writeLastStyle,
  type SetupMode,
} from '../setupPrefs';
import { startSession, useThemePick } from '../startSession';
import { startErrorKey, usePlayT, type PlayT } from '../strings';
import { ThemeIcon } from '../themes/ThemeIcon';
import { STRONG, STYLE_ICON, TABULAR } from '../ui';
import { bandIcon } from './bandIcons';
import { DifficultyReadout, DifficultyTrack } from './DifficultyTrack';
import { ReviewEntry } from './ReviewEntry';

// /play (Play tab), design "Play — simplified" (PlayV2*): Rated / Casual /
// Themes. Rated has no slider: it starts at the player's rating and shows
// the level with the way to the next one. Casual and Themes pick any
// difficulty and never touch the rating. Then the duration, the theme for
// Themes, and the Start dock above the tab bar.

/** A difficulty pick is tied to the rating it was made against. */
type Pick = { value: number; rating: number };

const DOCK_H = layout.plateHeight.lg + space[5] + space[3];
const PRESET_SPAN = 200;

const TYPES: { mode: SetupMode; key: 'rated' | 'casual' | 'themes'; icon: LucideIcon }[] = [
  { mode: 'mixed', key: 'rated', icon: TrendingUp },
  { mode: 'casual', key: 'casual', icon: Coffee },
  { mode: 'theme', key: 'themes', icon: TrendingUp },
];

export function PlaySetupScreen() {
  const t = usePlayT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const progressions = useAppStore((s) => s.progressions);
  const theme = useThemePick((s) => s.theme);

  // MMKV is synchronous: the stored picks are there on the first frame.
  const [style, setStyle] = useState<TrainingStyle>(readLastStyle);
  const [dur, setDur] = useState(() => resolveDurationFor(readLastStyle()));
  const [mode, setMode] = useState<SetupMode>('mixed');
  // /play?mode=theme&at=<stamp> (Stats theme row with nothing to review):
  // open in theme mode, once per request. Adjusted during render, not in
  // an effect, so the first frame already shows theme mode.
  const params = useLocalSearchParams<{ mode?: string; at?: string }>();
  const [seenAt, setSeenAt] = useState<string | undefined>(undefined);
  if (params.mode === 'theme' && params.at !== seenAt) {
    setSeenAt(params.at);
    setMode('theme');
  }
  const [pick, setPick] = useState<Pick | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [netErr, setNetErr] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Only a tap on Custom opens the number pad, not a restored custom pick. */
  const [focusCustom, setFocusCustom] = useState(false);

  const prog = progressions[style];
  const rating = prog.currentPuzzleRating;
  const rated = mode === 'mixed';
  // The difficulty follows the rating until the player picks one.
  const difficulty = clampDifficulty(pick && pick.rating === rating ? pick.value : rating);
  const setDifficulty = (v: number) => setPick({ value: clampDifficulty(v), rating });

  const live = useSharedValue(difficulty);
  useEffect(() => {
    live.set(difficulty);
  }, [live, difficulty]);

  const { min: minMinutes, max: maxMinutes } = minuteRange(style);
  const effectiveDuration = dur.custom ? clampMinutes(style, dur.customMinutes) * 60 : dur.duration;
  const customInvalid = dur.custom && dur.customMinutes === '';

  const bandLabels = {
    novice: t('levels.novice'),
    beginner: t('levels.beginner'),
    intermediate: t('levels.intermediate'),
    advanced: t('levels.advanced'),
    expert: t('levels.expert'),
  } satisfies Record<BandKey, string>;

  // In the handler, not an effect: style, difficulty and duration change in one render.
  const selectStyle = (next: TrainingStyle) => {
    if (next === style) return;
    setStyle(next);
    setPick(null);
    setDur(resolveDurationFor(next));
    writeLastStyle(next);
  };

  const selectDuration = (v: string) => {
    if (v === 'custom') {
      setDur((d) => ({ ...d, custom: true }));
      setFocusCustom(true);
      return;
    }
    const sec = Number(v);
    setDur({ duration: sec, custom: false, customMinutes: String(sec / 60) });
    writeLastDuration(style, sec);
  };

  const onMinutes = (v: string) => {
    if (v === '' || /^\d{1,2}$/.test(v)) setDur((d) => ({ ...d, customMinutes: v }));
  };

  // web onBlur: '' becomes the minimum, anything else its clamped value.
  const normaliseMinutes = () => {
    const m = clampMinutes(style, dur.customMinutes);
    setDur((d) => ({ ...d, customMinutes: String(m) }));
    writeLastDuration(style, m * 60);
  };

  const start = async () => {
    setErr(null);
    setNetErr(false);
    setLoading(true);
    try {
      const id = await startSession({
        style,
        durationSec: effectiveDuration,
        mode,
        theme: mode === 'theme' ? theme : null,
        startRating: rated ? rating : difficulty,
      });
      router.push(`/play/${id}` as Href);
    } catch (e) {
      const key = startErrorKey(e);
      setErr(t(key));
      setNetErr(key === 'play.err_network');
    } finally {
      setLoading(false);
    }
  };

  const presets = STYLE_FORMULAS[style].durationPresetsSec;
  const cta = rated ? t('play.start_rated') : mode === 'casual' ? t('play.start_casual') : t('play.start_drill', { theme: themeLabel(theme, lang) });

  return (
    <View style={styles.root} testID="play-setup">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space[4], paddingBottom: DOCK_H + space[4] }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <AppText variant="title" style={styles.center} accessibilityRole="header">
          {t('play.new_session')}
        </AppText>

        <View style={styles.types} accessibilityRole="radiogroup" accessibilityLabel={t('play.type')} testID="setup-type">
          {TYPES.map((ty) => (
            <TypeButton key={ty.key} type={ty} selected={mode === ty.mode} onPress={() => setMode(ty.mode)} t={t} />
          ))}
        </View>

        <Card style={styles.card}>
          {/* 1. Style */}
          <View style={styles.section}>
            <AppText variant="sectionLabel">{t('play.style')}</AppText>
            <Segmented
              testID="setup-style"
              accessibilityLabel={t('play.style')}
              size="tight"
              value={style}
              onChange={selectStyle}
              options={UI_STYLE_ORDER.map((s) => ({ value: s, label: t(`style.${s}.name`), icon: STYLE_ICON[s] }))}
            />
          </View>

          {/* 2. Rated: the rating and the level; Casual / Themes: the difficulty */}
          {rated ? (
            <RatedCard style={style} t={t} bandLabels={bandLabels} />
          ) : (
            <View style={styles.diff}>
              <View style={styles.diffHead}>
                <AppText variant="sectionLabel">{t('play.difficulty')}</AppText>
                <DifficultyReadout live={live} bandLabels={bandLabels} />
              </View>
              <DifficultyTrack
                testID="setup-slider"
                accessibilityLabel={t('play.difficulty')}
                value={difficulty}
                live={live}
                onChange={setDifficulty}
                me={rating}
                min={DIFFICULTY_MIN}
                max={DIFFICULTY_MAX}
                step={DIFFICULTY_STEP}
                youLabel={t('play.you_marker', { rating })}
                easierLabel={t('play.easier')}
                harderLabel={t('play.harder')}
              />
              <View style={styles.presets}>
                {(
                  [
                    ['warmup', rating - PRESET_SPAN],
                    ['level', rating],
                    ['push', rating + PRESET_SPAN],
                  ] as const
                ).map(([key, v]) => {
                  const value = clampDifficulty(v);
                  const on = value === difficulty;
                  return (
                    <Tap
                      key={key}
                      testID={`setup-preset-${key}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${t(`play.preset.${key}`)}, ${value}`}
                      onPress={() => setDifficulty(value)}
                      pressFeel="sliderDetent"
                      hitSlop={{ top: 5, bottom: 5 }}
                      style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
                    >
                      <AppText variant="chip" color={on ? tone.onEmber : eos.ash}>
                        {t(`play.preset.${key}`)}
                      </AppText>
                    </Tap>
                  );
                })}
              </View>
              <View style={styles.diffNote}>
                <MinusCircle size={14} color={tone.mist} />
                <AppText variant="caption" color={tone.mist} style={styles.flex} testID="setup-diff-note">
                  {`${diffDelta(difficulty - rating, t)} · ${mode === 'theme' ? t('play.diff_themes') : t('play.diff_casual')}`}
                </AppText>
              </View>
            </View>
          )}

          {/* 3. Duration */}
          <View style={styles.section}>
            <AppText variant="sectionLabel">{t('play.duration')}</AppText>
            <Segmented
              testID="setup-duration"
              accessibilityLabel={t('play.duration')}
              size="tight"
              value={dur.custom ? 'custom' : String(dur.duration)}
              onChange={selectDuration}
              options={[
                ...presets.map((d) => ({ value: String(d), label: `${d / 60} ${t('play.minutes')}` })),
                { value: 'custom', label: t('play.custom') },
              ]}
            />
            {dur.custom && (
              <View style={styles.customRow}>
                <View style={styles.customInput}>
                  <Input
                    autoFocus={focusCustom}
                    testID="setup-custom-minutes"
                    accessibilityLabel={t('play.custom_minutes')}
                    value={dur.customMinutes}
                    onChangeText={onMinutes}
                    onBlur={normaliseMinutes}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={2}
                    returnKeyType="done"
                  />
                </View>
                <AppText variant="body" color={eos.ash} style={styles.flex}>
                  {`${t('play.minutes')} · ${minMinutes}–${maxMinutes}`}
                </AppText>
                <Tap
                  testID="setup-custom-done"
                  accessibilityRole="button"
                  accessibilityLabel={t('play.done')}
                  onPress={() => Keyboard.dismiss()}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.doneBtn}
                >
                  <AppText variant="label" color={eos.bone}>
                    {t('play.done')}
                  </AppText>
                </Tap>
              </View>
            )}
          </View>

          {/* 4. Themes: the theme */}
          {mode === 'theme' && (
            <View style={styles.section}>
              <AppText variant="sectionLabel">{t('play.theme')}</AppText>
              <Tap
                testID="setup-theme"
                accessibilityRole="button"
                accessibilityLabel={`${t('play.theme_change')}: ${themeLabel(theme, lang)}`}
                onPress={() => router.push('/play/theme-picker' as Href)}
                pressFeel="segmented"
                style={styles.themeRow}
              >
                <View style={styles.themeTile}>
                  <ThemeIcon slug={theme} size={20} color={control.segmentedActiveText} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="body" color={eos.bone} style={[STRONG, styles.themeName]} numberOfLines={1} testID="setup-theme-label">
                    {themeLabel(theme, lang)}
                  </AppText>
                  <AppText variant="caption" color={eos.ash}>
                    {t('play.theme_change')}
                  </AppText>
                </View>
                <ChevronRight size={18} color={eos.dust} />
              </Tap>
            </View>
          )}

          {err && (
            <AppText variant="caption" color={semantic.danger} testID="setup-error">
              {err}
            </AppText>
          )}
          {netErr && (
            <Tap
              testID="setup-offline-link"
              accessibilityRole="link"
              accessibilityLabel={t('offline.entry_network')}
              onPress={() => router.push('/offline' as Href)}
              hitSlop={{ top: 12, bottom: 12 }}
              style={styles.offlineLink}
            >
              <CloudOff size={16} color={eos.ember} />
              <AppText variant="captionStrong" color={eos.ember} style={styles.flex}>
                {t('offline.entry_network')}
              </AppText>
            </Tap>
          )}
        </Card>

        <StormEntry />
        <ChallengeEntry />
        <ReviewEntry />
        <OfflineEntry />
      </ScrollView>

      {/* A full-width CTA docked above the tab bar. */}
      <View style={styles.dock} pointerEvents="box-none">
        <LinearGradient
          pointerEvents="none"
          colors={[mixed.ctaDockBottom, mixed.ctaDockMid, mixed.ctaDockFade, 'transparent']}
          locations={[0, 0.55, 0.8, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <PlateButton
          testID="setup-start"
          label={loading ? t('play.starting') : cta}
          onPress={() => void start()}
          loading={loading}
          disabled={customInvalid}
          size="lg"
          block
        />
      </View>
    </View>
  );
}

function diffDelta(delta: number, t: PlayT): string {
  if (delta === 0) return t('play.diff_same');
  return delta > 0 ? t('play.diff_above', { n: delta }) : t('play.diff_below', { n: -delta });
}

function TypeButton({
  type,
  selected,
  onPress,
  t,
}: {
  type: (typeof TYPES)[number];
  selected: boolean;
  onPress: () => void;
  t: PlayT;
}) {
  const Icon = type.icon;
  const name = t(`play.type.${type.key}`);
  const desc = t(`play.type.${type.key}_desc`);
  return (
    <Tap
      testID={`setup-type-${type.key}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}. ${desc}`}
      onPress={onPress}
      pressFeel="segmented"
      style={[styles.type, selected && styles.typeOn]}
    >
      <View style={styles.typeHead}>
        {type.key === 'themes' ? (
          <ThemeIcon slug="fork" size={15} color={selected ? eos.bone : eos.ash} />
        ) : (
          <Icon size={15} color={selected ? eos.bone : eos.ash} strokeWidth={2} />
        )}
        <AppText variant="bodyStrong" color={selected ? eos.bone : eos.ash} style={styles.typeName} numberOfLines={1}>
          {name}
        </AppText>
      </View>
      <AppText variant="caption" color={selected ? eos.ash : eos.dust} style={styles.typeDesc} numberOfLines={2}>
        {desc}
      </AppText>
    </Tap>
  );
}

/** Rated: the eye, the rating and band, the level and the way to the next one. Opens "How levels work". */
function RatedCard({ style, t, bandLabels }: { style: TrainingStyle; t: PlayT; bandLabels: Record<BandKey, string> }) {
  const prog = useAppStore((s) => s.progressions[style]);
  const rating = prog.currentPuzzleRating;
  const level = levelFor(prog);
  const p = levelProgress(rating, level);
  const settling = prog.calibrationSessionsLeft;
  const styleName = t(`style.${style}.name`);
  return (
    <Tap
      testID="setup-rated"
      accessibilityRole="button"
      accessibilityLabel={`${t('play.your_rating', { style: styleName })} ${rating}, ${t('play.level', { level })}. ${t('play.level_help')}`}
      onPress={() => router.push(`/play/levels?style=${style}` as Href)}
      pressFeel="segmented"
      style={styles.rated}
    >
      <View style={styles.eyeBox}>
        <Image source={bandIcon(rating)} style={styles.eye} contentFit="contain" transition={null} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label">{t('play.your_rating', { style: styleName })}</AppText>
        <View style={styles.ratingRow}>
          <AppText variant="value" style={styles.ratingValue} testID="setup-rated-rating">
            {String(rating)}
          </AppText>
          <AppText variant="captionStrong" color={eos.ash} numberOfLines={1} style={styles.shrink}>
            {bandLabels[bandFor(rating).key]}
          </AppText>
        </View>
        <View style={styles.levelRow}>
          <AppText variant="label" style={TABULAR} testID="setup-rated-level">
            {t('play.level', { level })}
          </AppText>
          <AppText variant="label" style={TABULAR} testID="setup-rated-next">
            {t('play.to_next', { n: p.toNext, next: p.next })}
          </AppText>
        </View>
        <View style={styles.levelBar}>
          <LinearGradient colors={control.rankProgress} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.levelFill, { width: `${p.ratio * 100}%` }]} />
        </View>
        <AppText variant="caption" color={tone.mist} style={styles.ratedHint}>
          {t('play.rated_hint', { next: p.next })}
        </AppText>
        {settling > 0 && (
          <AppText variant="captionStrong" color={tone.gold} style={styles.ratedHint} testID="setup-settling">
            {t('play.settling', { n: Math.min(settling, CALIBRATION_SESSIONS) })}
          </AppText>
        )}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { paddingHorizontal: layout.gutter, gap: space[4] },
  center: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  card: { padding: layout.cardPadding, gap: 22 },
  section: { gap: space[2.5] },
  // Session type: three cards in a carved well (design .typebtn).
  types: {
    flexDirection: 'row',
    gap: space[1],
    padding: space[1],
    borderRadius: 14,
    backgroundColor: eos.well,
  },
  type: { flex: 1, minWidth: 0, gap: 3, paddingVertical: space[2.5], paddingHorizontal: space[2.5], borderRadius: 10 },
  typeOn: { backgroundColor: eos.slate, borderWidth: 1, borderColor: control.dangerBorder, margin: -1 },
  typeHead: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  typeName: { fontFamily: fontFamily('en', 'body', 800) },
  typeDesc: { fontSize: 11, lineHeight: 14 },
  // Rated card.
  rated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radii.xl,
    backgroundColor: surface.noteNeutral,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  eyeBox: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  eye: { width: 52, height: 52 },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  ratingValue: { fontSize: 30, lineHeight: 36 },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[2.5] },
  levelBar: { marginTop: space[1.5], height: 6, borderRadius: radii.full, backgroundColor: eos.well, overflow: 'hidden' },
  levelFill: { height: 6, borderRadius: radii.full },
  ratedHint: { marginTop: space[2] },
  // Casual / Themes difficulty.
  diff: { gap: space[3] },
  diffHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  presets: { flexDirection: 'row', gap: space[2] },
  chip: { flex: 1, height: 34, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: eos.ember },
  chipOff: { backgroundColor: control.chipBg, borderWidth: 1, borderColor: semantic.borderSoft },
  diffNote: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  offlineLink: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  customInput: { width: space[20] + space[6] },
  doneBtn: {
    height: space[10],
    paddingHorizontal: space[3],
    borderRadius: radii.lg,
    justifyContent: 'center',
    backgroundColor: control.ghostPressBg,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radii.lg,
    backgroundColor: control.emberTint16,
    borderWidth: 1,
    borderColor: control.dangerBorder,
  },
  themeTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: eos.ember,
  },
  themeName: { fontSize: 15 },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space[5],
    paddingBottom: space[3],
    paddingHorizontal: layout.gutter,
  },
});
