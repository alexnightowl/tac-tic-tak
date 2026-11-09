import { CALIBRATION_SESSIONS, LEVEL_GUARD_SESSIONS, LEVEL_STEP, UI_STYLE_ORDER, bandFor, paceTarget, type BandKey, type TrainingStyle } from '@tac/core/rules';
import { levelFor } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { control, eos, layout, mixed, radii, semantic, space, surface, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { ChevronRight, CloudOff, Coffee, MinusCircle, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HAS_OFFLINE } from '@/platform/capabilities';
import { ChallengeEntry } from '@/features/challenge/ChallengeEntry';
import { OfflineEntry } from '@/features/offline/OfflineEntry';
import { StormEntry } from '@/features/storm/StormEntry';
import { WoodpeckerEntry } from '@/features/woodpecker/WoodpeckerEntry';
import { useAppStore } from '@/stores/appStore';
import { AppText, Card, Input, PlateButton, Segmented } from '@/ui';
import { fontFamily } from '@/ui/fonts';
import { Tap } from '@/ui/Tap';
import { DIFFICULTY_MAX, DIFFICULTY_MIN, DIFFICULTY_STEP, clampDifficulty, type SetupMode } from '../setupPrefs';
import { type PlayT } from '../strings';
import { BlindSetup } from '../blind/BlindSetup';
import { ThemeIcon } from '../themes/ThemeIcon';
import { STRONG, STYLE_ICON, TABULAR } from '../ui';
import { bandIcon } from './bandIcons';
import { DifficultyReadout, DifficultyTrack } from './DifficultyTrack';
import { ReviewEntry } from './ReviewEntry';
import { PRESET_SPAN, diffDelta, usePlaySetup } from './usePlaySetup';

// /play (Play tab), design "Play — simplified" (PlayV2*): Rated / Casual /
// Themes. Rated has no slider: it starts at the player's level (D39) and
// shows the next mark. Casual and Themes pick any difficulty and never
// touch the level. Then the duration, the theme for
// Themes, and the Start dock above the tab bar.

const DOCK_H = layout.plateHeight.lg + space[5] + space[3];

const TYPES: { mode: SetupMode; key: 'rated' | 'casual' | 'themes'; icon: LucideIcon }[] = [
  { mode: 'mixed', key: 'rated', icon: TrendingUp },
  { mode: 'casual', key: 'casual', icon: Coffee },
  { mode: 'theme', key: 'themes', icon: TrendingUp },
];

export function PlaySetupScreen() {
  const insets = useSafeAreaInsets();
  const {
    t,
    lang,
    theme,
    style,
    selectStyle,
    dur,
    selectDuration,
    onMinutes,
    normaliseMinutes,
    focusCustom,
    minMinutes,
    maxMinutes,
    presets,
    effectiveDuration,
    customInvalid,
    mode,
    setMode,
    rated,
    level,
    difficulty,
    setDifficulty,
    live,
    bandLabels,
    start,
    loading,
    err,
    netErr,
    cta,
  } = usePlaySetup();

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

          {/* 2. Rated: the level and the next mark; Casual / Themes: the difficulty */}
          {rated ? (
            <RatedCard style={style} durationSec={effectiveDuration} t={t} bandLabels={bandLabels} />
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
                me={level}
                min={DIFFICULTY_MIN}
                max={DIFFICULTY_MAX}
                step={DIFFICULTY_STEP}
                youLabel={t('play.you_marker', { rating: level })}
                easierLabel={t('play.easier')}
                harderLabel={t('play.harder')}
              />
              <View style={styles.presets}>
                {(
                  [
                    ['warmup', level - PRESET_SPAN],
                    ['level', level],
                    ['push', level + PRESET_SPAN],
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
                  {`${diffDelta(difficulty - level, t)} · ${mode === 'theme' ? t('play.diff_themes') : t('play.diff_casual')}`}
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

          {/* 5. Free / Themes: blind mode (D40) */}
          {!rated && <BlindSetup />}

          {err && (
            <AppText variant="caption" color={semantic.danger} testID="setup-error">
              {err}
            </AppText>
          )}
          {netErr && HAS_OFFLINE && (
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

        <WoodpeckerEntry />
        <StormEntry />
        <ChallengeEntry />
        <ReviewEntry />
        {HAS_OFFLINE && <OfflineEntry />}
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

/**
 * Rated: the eye, the level and its band, the next mark and the pace a
 * level-up needs (D39: every rated session starts at the level, so the way
 * to the next mark starts empty). Opens "How levels work".
 */
function RatedCard({ style, durationSec, t, bandLabels }: { style: TrainingStyle; durationSec: number; t: PlayT; bandLabels: Record<BandKey, string> }) {
  const prog = useAppStore((s) => s.progressions[style]);
  const level = levelFor(prog);
  const next = level + LEVEL_STEP;
  const settling = prog.calibrationSessionsLeft;
  const guard = prog.levelGuard ?? 0;
  const styleName = t(`style.${style}.name`);
  return (
    <Tap
      testID="setup-rated"
      accessibilityRole="button"
      accessibilityLabel={`${t('play.your_rating', { style: styleName })} ${level}, ${t('level.next')} ${next}. ${t('play.level_help')}`}
      onPress={() => router.push(`/play/levels?style=${style}` as Href)}
      pressFeel="segmented"
      style={styles.rated}
    >
      <View style={styles.eyeBox}>
        <Image source={bandIcon(level)} style={styles.eye} contentFit="contain" transition={null} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label">{t('play.your_rating', { style: styleName })}</AppText>
        <View style={styles.ratingRow}>
          <AppText variant="value" style={styles.ratingValue} testID="setup-rated-level">
            {String(level)}
          </AppText>
          <AppText variant="captionStrong" color={eos.ash} numberOfLines={1} style={styles.shrink}>
            {bandLabels[bandFor(level).key]}
          </AppText>
        </View>
        <View style={styles.levelRow}>
          <AppText variant="label" color={guard > 0 ? tone.gold : undefined} style={TABULAR} testID="setup-rated-guard">
            {guard > 0 ? t('summary.protected', { n: guard, total: LEVEL_GUARD_SESSIONS }) : t('level.next')}
          </AppText>
          <AppText variant="label" color={eos.bone} style={TABULAR} testID="setup-rated-next">
            {String(next)}
          </AppText>
        </View>
        <AppText variant="caption" color={tone.mist} style={styles.ratedHint}>
          {t('play.rated_hint', { next, pace: paceTarget(style, durationSec) })}
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
