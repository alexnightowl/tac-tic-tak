import type { Progression } from '@tac/core/api';
import { CALIBRATION_SESSIONS, STYLE_FORMULAS, UI_STYLE_ORDER, offFormRating, peakFloor, type BandKey, type TrainingStyle } from '@tac/core/rules';
import { themeLabel } from '@tac/core/themes';
import { control, eos, layout, mixed, radii, rank, semantic, space, text } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/stores/appStore';
import { AppText, Card, Input, PlateButton, Segmented, useLang } from '@/ui';
import { Tap } from '@/ui/Tap';
import { clampMinutes, initialStartRating, minuteRange, ratingCap, readLastStyle, resolveDurationFor, writeLastDuration, writeLastStyle } from '../setupPrefs';
import { startSession, useThemePick } from '../startSession';
import { startErrorKey, usePlayT } from '../strings';
import { ThemeIcon } from '../themes/ThemeIcon';
import { StyleIcon, STRONG } from '../ui';
import { DifficultySlider, SliderReadout } from './DifficultySlider';
import { CalibrationPreview, NextUnlockPreview, ThemePracticeNote } from './Previews';

// /play (Play tab): web play/page.tsx PlaySetup at full parity — style
// with calibration pills, difficulty (slider, zones, off-form, comfort),
// duration presets + custom minutes, mixed / theme mode (theme picker
// sheet), the preview card, and a Start dock above the tab bar.

type Mode = 'mixed' | 'theme';
/** A slider pick is tied to the progression it was made against (web ratingTouched). */
type Pick = { value: number; key: string };

/**
 * By content, not identity: every ['me'] revalidation (app foreground,
 * Home focus) stores fresh objects, and that must not throw the player's
 * pick away. A finished session moves these numbers and resets it.
 */
const progKey = (p: Progression) =>
  `${p.currentPuzzleRating}|${p.startPuzzleRating}|${p.unlockedStartRating}|${p.calibrationSessionsLeft}|${p.weakSessionStreak}`;

const DOCK_H = layout.plateHeight.lg + space[5] + space[3];

export function PlaySetupScreen() {
  const t = usePlayT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const progressions = useAppStore((s) => s.progressions);
  const theme = useThemePick((s) => s.theme);

  // MMKV is synchronous: the stored picks are there on the first frame.
  const [style, setStyle] = useState<TrainingStyle>(readLastStyle);
  const [dur, setDur] = useState(() => resolveDurationFor(readLastStyle()));
  const [mode, setMode] = useState<Mode>('mixed');
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
  const [loading, setLoading] = useState(false);
  /** Only a tap on Custom opens the number pad, not a restored custom pick. */
  const [focusCustom, setFocusCustom] = useState(false);

  const prog = progressions[style];
  const provisional = prog.calibrationSessionsLeft > 0;
  const unlocked = prog.unlockedStartRating;
  const cap = ratingCap(prog, mode);
  const floor = peakFloor(unlocked);
  // Until the player moves the slider it follows the progression (which
  // /users/me and every attempt patch). fix: the value is always clamped
  // to the current cap, so a theme → mixed switch can't send the server
  // a rating above norm + 200 (the web's raw 400).
  const key = progKey(prog);
  const startRating = Math.min(cap, pick && pick.key === key ? pick.value : initialStartRating(prog));
  const setStartRating = (v: number) => setPick({ value: v, key });

  const live = useSharedValue(startRating);
  useEffect(() => {
    live.set(startRating);
  }, [live, startRating]);

  const rated = mode !== 'theme';
  const showComfort = rated && !provisional && startRating < floor;
  const showOffForm = rated && !provisional && prog.weakSessionStreak > 0 && startRating >= floor;
  const offForm = offFormRating(unlocked);
  // While calibrating, mixed sessions take the server's rating: no slider.
  const hideSlider = provisional && mode === 'mixed';

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

  // In the handler, not an effect: style, rating and duration change in one render.
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
    setLoading(true);
    try {
      const id = await startSession({
        style,
        durationSec: effectiveDuration,
        mode,
        theme: mode === 'theme' ? theme : null,
        startRating,
      });
      router.push(`/play/${id}` as Href);
    } catch (e) {
      setErr(t(startErrorKey(e)));
    } finally {
      setLoading(false);
    }
  };

  const presets = STYLE_FORMULAS[style].durationPresetsSec;
  const calDone = CALIBRATION_SESSIONS - prog.calibrationSessionsLeft;

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
        <Card style={styles.card}>
          {/* 1. Style */}
          <View style={styles.section}>
            <AppText variant="sectionLabel">{t('play.style')}</AppText>
            <View>
              <Segmented
                testID="setup-style"
                accessibilityLabel={t('play.style')}
                value={style}
                onChange={selectStyle}
                options={UI_STYLE_ORDER.map((s) => ({ value: s, label: t(`style.${s}.name`) }))}
              />
              <CalibrationPills progressions={progressions} active={style} t={t} />
            </View>
            <View style={styles.blurb}>
              <View style={styles.blurbIcon}>
                <StyleIcon style={style} size={16} color={eos.ash} />
              </View>
              <View style={styles.flex}>
                <AppText variant="caption" color={eos.bone}>
                  {t(`style.${style}.desc`)}
                </AppText>
                <AppText variant="label" color={eos.dust} style={styles.blurbRange}>
                  {`${minMinutes}–${maxMinutes} ${t('play.minutes')}`}
                </AppText>
              </View>
            </View>
          </View>

          {/* 2. Rating */}
          <View style={styles.section}>
            <View style={styles.ratingHead}>
              <AppText variant="sectionLabel" style={styles.shrink} numberOfLines={1}>
                {t(`style.${style}.rating_label`)}
              </AppText>
              <SliderReadout live={live} bandLabels={bandLabels} provisional={provisional} />
            </View>
            {hideSlider ? (
              <AppText variant="caption" color={rank.intermediate.color} testID="setup-calibrating">
                {t('play.calibration_per_style', {
                  done: calDone,
                  total: CALIBRATION_SESSIONS,
                  style: t(`style.${style}.name`).toLowerCase(),
                })}
              </AppText>
            ) : (
              <>
                <DifficultySlider
                  key={`${style}-${mode}`}
                  testID="setup-slider"
                  accessibilityLabel={t('play.start_rating')}
                  value={startRating}
                  live={live}
                  onChange={setStartRating}
                  cap={cap}
                  levelUpFrom={rated ? floor : undefined}
                  norm={rated ? unlocked : undefined}
                  bandLabels={bandLabels}
                />
                {rated && (
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.swatch, styles.swatchComfort]} />
                      <AppText variant="caption">{t('play.zone_comfort')}</AppText>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.swatch, styles.swatchLevelUp]} />
                      <AppText variant="caption">{t('play.zone_levelup')}</AppText>
                    </View>
                  </View>
                )}
                {rated ? (
                  <AppText variant="caption" color={eos.dust} testID="setup-cap">
                    {`${t('play.unlocked')}: `}
                    <AppText variant="caption" color={eos.bone}>
                      {String(unlocked)}
                    </AppText>
                    {`  ·  ${t('play.cap')}: `}
                    <AppText variant="caption" color={eos.bone}>
                      {String(cap)}
                    </AppText>
                  </AppText>
                ) : (
                  <AppText variant="caption">{t('play.theme_unrated_hint')}</AppText>
                )}
                {showOffForm && (
                  <View style={styles.offForm} testID="setup-off-form">
                    <AppText variant="body" color={rank.intermediate.color} style={STRONG}>
                      {t('play.off_form_title')}
                    </AppText>
                    <AppText variant="caption" color={eos.bone}>
                      {t('play.off_form_hint', { floor })}
                    </AppText>
                    <Tap
                      testID="setup-off-form-cta"
                      accessibilityRole="button"
                      accessibilityLabel={t('play.off_form_cta', { rating: offForm })}
                      onPress={() => setStartRating(offForm)}
                      pressFeel="sliderDetent"
                      hitSlop={{ top: 6, bottom: 6 }}
                      style={styles.offFormCta}
                    >
                      <AppText variant="caption" color={rank.intermediate.color} style={STRONG}>
                        {t('play.off_form_cta', { rating: offForm })}
                      </AppText>
                    </Tap>
                  </View>
                )}
                {showComfort && (
                  <AppText variant="caption" color={rank.intermediate.color} testID="setup-comfort">
                    {t('play.comfort_notice', { floor })}
                  </AppText>
                )}
              </>
            )}
          </View>

          {/* 3. Duration */}
          <View style={styles.section}>
            <AppText variant="sectionLabel">{t('play.duration')}</AppText>
            <Segmented
              testID="setup-duration"
              accessibilityLabel={t('play.duration')}
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

          {/* 4. Mode */}
          <View style={styles.section}>
            <AppText variant="sectionLabel">{t('play.mode')}</AppText>
            <Segmented
              testID="setup-mode"
              accessibilityLabel={t('play.mode')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'mixed', label: t('play.mode.mixed') },
                { value: 'theme', label: t('play.mode.theme') },
              ]}
            />
            {mode === 'theme' && (
              <Tap
                testID="setup-theme"
                accessibilityRole="button"
                accessibilityLabel={`${t('play.theme_change')}: ${themeLabel(theme, lang)}`}
                onPress={() => router.push('/play/theme-picker' as Href)}
                pressFeel="segmented"
                style={styles.themeRow}
              >
                <View style={styles.themeTile}>
                  <ThemeIcon slug={theme} size={18} color={control.segmentedActiveText} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="label">{t('play.theme')}</AppText>
                  <AppText variant="body" color={eos.bone} style={STRONG} numberOfLines={1} testID="setup-theme-label">
                    {themeLabel(theme, lang)}
                  </AppText>
                </View>
                <ChevronRight size={18} color={eos.dust} />
              </Tap>
            )}
          </View>

          {/* 5. Preview */}
          {mode === 'mixed' ? (
            provisional ? (
              <CalibrationPreview done={calDone} total={CALIBRATION_SESSIONS} style={style} t={t} />
            ) : (
              <NextUnlockPreview style={style} durationSec={effectiveDuration} unlockedTo={unlocked} t={t} />
            )
          ) : (
            <ThemePracticeNote t={t} />
          )}

          {err && (
            <AppText variant="caption" color={semantic.danger} testID="setup-error">
              {err}
            </AppText>
          )}
        </Card>
      </ScrollView>

      {/* web MobileStartBar: a full-width CTA docked above the tab bar. */}
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
          label={loading ? t('play.starting') : t('play.start')}
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

/** web '?{done}/5' pills on the style tabs while a style is calibrating. */
function CalibrationPills({ progressions, active, t }: { progressions: Record<TrainingStyle, Progression>; active: TrainingStyle; t: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <View style={styles.pills} pointerEvents="none">
      {UI_STYLE_ORDER.map((s) => {
        const left = progressions[s].calibrationSessionsLeft;
        const done = CALIBRATION_SESSIONS - left;
        const on = s === active;
        return (
          <View key={s} style={styles.pillCell}>
            {left > 0 && (
              <View
                style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
                testID={`setup-cal-pill-${s}`}
                accessible
                accessibilityLabel={t('play.calibration_progress_aria', { done, total: CALIBRATION_SESSIONS })}
              >
                <AppText variant="label" color={on ? control.segmentedActiveText : rank.intermediate.color} style={styles.pillText}>
                  {`?${done}/${CALIBRATION_SESSIONS}`}
                </AppText>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { paddingHorizontal: layout.gutter, gap: space[5] },
  center: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  card: { padding: layout.cardPadding, gap: space[6] },
  section: { gap: space[2.5] },
  ratingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  shrink: { flexShrink: 1 },
  blurb: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2.5],
    borderRadius: radii.xl,
    backgroundColor: control.platePressEmber,
  },
  blurbIcon: {
    width: space[8],
    height: space[8],
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: control.ghostPressBg,
  },
  blurbRange: { marginTop: space[1] },
  pills: { ...StyleSheet.absoluteFill, flexDirection: 'row', paddingHorizontal: layout.segmentedTrackPadding },
  pillCell: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: space[1] },
  pill: { paddingHorizontal: space[1], paddingVertical: 1, borderRadius: radii.sm * 2 },
  pillOn: { backgroundColor: control.platePressEmber },
  pillOff: { backgroundColor: rank.intermediate.glow },
  pillText: { fontSize: text.label.fontSize - 2, letterSpacing: 0 },
  legend: { flexDirection: 'row', gap: space[4] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  swatch: { width: space[4], height: space[1.5], borderRadius: radii.full },
  swatchComfort: { backgroundColor: eos.dust },
  swatchLevelUp: { backgroundColor: eos.ember, borderWidth: 1, borderColor: rank.intermediate.glow },
  offForm: {
    padding: space[3],
    gap: space[1],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: rank.intermediate.glow,
    backgroundColor: rank.intermediate.glow,
  },
  offFormCta: {
    alignSelf: 'flex-start',
    marginTop: space[1],
    height: space[8],
    paddingHorizontal: space[3],
    borderRadius: radii.lg,
    justifyContent: 'center',
    backgroundColor: rank.intermediate.glow,
  },
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
    width: layout.themeTile,
    height: layout.themeTile,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: eos.ember,
  },
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

