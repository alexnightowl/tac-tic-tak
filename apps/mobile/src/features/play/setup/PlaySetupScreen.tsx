import { CALIBRATION_SESSIONS, STYLE_FORMULAS, UI_STYLE_ORDER, offFormRating, peakFloor, type BandKey, type TrainingStyle } from '@tac/core/rules';
import { eos, layout, radii, rank, semantic, space } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/platform/api';
import { useAppStore } from '@/stores/appStore';
import { AppText, Card, PlateButton, Segmented } from '@/ui';
import { Tap } from '@/ui/Tap';
import { stashFirstPuzzle } from '../pendingPuzzle';
import { initialStartRating, ratingCap, readLastStyle, resolveDuration, writeLastDuration, writeLastStyle } from '../setupPrefs';
import { startErrorKey, usePlayT } from '../strings';
import { DifficultySlider, SliderReadout } from './DifficultySlider';

// /play: minimal Phase 2 setup (web play/page.tsx PlaySetup): style,
// difficulty, duration presets, Start. Mixed mode only; theme mode,
// the custom duration and the unlock preview card arrive in Phase 5.

export function PlaySetupScreen() {
  const t = usePlayT();
  const insets = useSafeAreaInsets();
  const progressions = useAppStore((s) => s.progressions);

  // MMKV is synchronous: the stored picks are there on the first frame.
  const [style, setStyle] = useState<TrainingStyle>(readLastStyle);
  const prog = progressions[style];
  const [duration, setDuration] = useState(() => resolveDuration(style));
  const [picked, setPicked] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Until the player touches the slider it follows the progression
  // (/users/me can land after the first frame), web ratingTouched.
  const startRating = picked ?? initialStartRating(prog);
  const live = useSharedValue(startRating);
  useEffect(() => {
    live.set(startRating);
  }, [live, startRating]);

  const provisional = prog.calibrationSessionsLeft > 0;
  const unlocked = prog.unlockedStartRating;
  const cap = ratingCap(prog);
  const floor = peakFloor(unlocked);
  const showComfort = !provisional && startRating < floor;
  const showOffForm = !provisional && prog.weakSessionStreak > 0 && startRating >= floor;
  const offForm = offFormRating(unlocked);

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
    setPicked(null);
    setDuration(resolveDuration(next));
    writeLastStyle(next);
  };

  const selectDuration = (sec: number) => {
    setDuration(sec);
    writeLastDuration(style, sec);
  };

  const start = async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await api.sessions.create({ startRating, durationSec: duration, mode: 'mixed', style });
      writeLastDuration(style, duration);
      if (r.firstPuzzle) stashFirstPuzzle(r.sessionId, r.firstPuzzle);
      router.push(`/play/${r.sessionId}` as Href);
    } catch (e) {
      setErr(t(startErrorKey(e)));
    } finally {
      setLoading(false);
    }
  };

  const presets = STYLE_FORMULAS[style].durationPresetsSec;

  return (
    <View style={styles.root} testID="play-setup">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[6] }]}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="title" style={styles.center}>
          {t('play.new_session')}
        </AppText>
        <Card style={styles.card}>
          <View style={styles.section}>
            <AppText variant="sectionLabel">{t('play.style')}</AppText>
            <Segmented
              testID="setup-style"
              accessibilityLabel={t('play.style')}
              value={style}
              onChange={selectStyle}
              options={UI_STYLE_ORDER.map((s) => ({ value: s, label: t(`style.${s}.name`) }))}
            />
            <AppText variant="caption" color={eos.ash}>
              {t(`style.${style}.desc`)}
            </AppText>
          </View>

          <View style={styles.section}>
            <View style={styles.ratingHead}>
              <AppText variant="sectionLabel" style={styles.shrink} numberOfLines={1}>
                {t(`style.${style}.rating_label`)}
              </AppText>
              <SliderReadout live={live} bandLabels={bandLabels} provisional={provisional} />
            </View>
            {provisional ? (
              <AppText variant="caption" color={rank.intermediate.color} testID="setup-calibrating">
                {t('play.calibration_per_style', {
                  done: CALIBRATION_SESSIONS - prog.calibrationSessionsLeft,
                  total: CALIBRATION_SESSIONS,
                  style: t(`style.${style}.name`).toLowerCase(),
                })}
              </AppText>
            ) : (
              <>
                <DifficultySlider
                  key={style}
                  testID="setup-slider"
                  accessibilityLabel={t('play.start_rating')}
                  value={startRating}
                  live={live}
                  onChange={setPicked}
                  cap={cap}
                  currentRating={prog.currentPuzzleRating}
                  levelUpFrom={floor}
                  norm={unlocked}
                  bandLabels={bandLabels}
                />
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.swatch, styles.swatchComfort]} />
                    <AppText variant="caption" color={eos.ash}>
                      {t('play.zone_comfort')}
                    </AppText>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.swatch, styles.swatchLevelUp]} />
                    <AppText variant="caption" color={eos.ash}>
                      {t('play.zone_levelup')}
                    </AppText>
                  </View>
                </View>
                <AppText variant="caption" color={eos.dust}>
                  {`${t('play.unlocked')}: ${unlocked} · ${t('play.cap')}: ${cap}`}
                </AppText>
                {showOffForm && (
                  <View style={styles.offForm} testID="setup-off-form">
                    <AppText variant="turnTitle" color={rank.intermediate.color}>
                      {t('play.off_form_title')}
                    </AppText>
                    <AppText variant="caption" color={eos.ash}>
                      {t('play.off_form_hint', { floor })}
                    </AppText>
                    <Tap
                      testID="setup-off-form-cta"
                      accessibilityRole="button"
                      accessibilityLabel={t('play.off_form_cta', { rating: offForm })}
                      onPress={() => setPicked(offForm)}
                      pressFeel="sliderDetent"
                      style={styles.offFormCta}
                    >
                      <AppText variant="label" color={rank.intermediate.color}>
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

          <View style={styles.section}>
            <AppText variant="sectionLabel">{t('play.duration')}</AppText>
            <Segmented
              testID="setup-duration"
              accessibilityLabel={t('play.duration')}
              value={String(duration)}
              onChange={(v) => selectDuration(Number(v))}
              options={presets.map((d) => ({ value: String(d), label: `${d / 60} ${t('play.minutes')}` }))}
            />
          </View>

          {err && (
            <AppText variant="caption" color={semantic.danger} testID="setup-error">
              {err}
            </AppText>
          )}
          <PlateButton
            testID="setup-start"
            label={loading ? t('play.starting') : t('play.start')}
            onPress={() => void start()}
            loading={loading}
            size="lg"
            block
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { paddingHorizontal: layout.gutter, gap: space[5] },
  center: { textAlign: 'center' },
  card: { padding: layout.cardPadding, gap: space[6] },
  section: { gap: space[2.5] },
  ratingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  shrink: { flexShrink: 1 },
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
});
