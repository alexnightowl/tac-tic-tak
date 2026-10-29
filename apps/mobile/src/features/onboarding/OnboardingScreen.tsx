import { eos, layout, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { feel } from '@/feel';
import { patchSettings } from '@/shell/settings';
import { AppText } from '@/ui/AppText';
import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { Tap } from '@/ui/Tap';
import { markOnboardingDismissed, setOnboardingOpen } from './gate';
import { HabitArt } from './Habit';
import { RankPath } from './RankPath';
import { Rise, StepBar, StepCopy } from './parts';
import { TrainingBoard } from './TrainingBoard';
import { WelcomeArt } from './Welcome';

// Design v2 onboarding (MobOnboarding1–4): Welcome → The training → Your
// path → The habit. Each step mounts fresh so its entrance keyframes play;
// the top bar's Skip, Android back on step 1, "Skip — start at 1200" and
// "Find my level" all mark onboardingCompleted (optimistic; the web ignored
// a failed save the same way). Placement does not exist on the backend:
// "Find my level" opens the Play tab, where the first five sessions in a
// style calibrate the rating; "Skip — start at 1200" lands on Home.

const STEPS = ['welcome', 'training', 'path', 'habit'] as const;
const LAST = STEPS.length - 1;
/** The backend's starting puzzle rating (Rating.startPuzzleRating default). */
const START_RATING = 1200;

type Finish = 'close' | 'play' | 'home';

export function OnboardingScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const finished = useRef(false);
  // Mirrors `step` for the Android back handler registered once on mount.
  const stepRef = useRef(0);

  const finish = (to: Finish) => {
    if (finished.current) return;
    finished.current = true;
    markOnboardingDismissed();
    void patchSettings({ onboardingCompleted: true });
    router.back();
    if (to === 'play') router.navigate('/play' as Href);
    else if (to === 'home') router.navigate('/' as Href);
  };

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(LAST, i));
    if (next === stepRef.current) return;
    feel.emit('tabChange');
    stepRef.current = next;
    setStep(next);
  };

  useEffect(() => {
    setOnboardingOpen(true);
    // Android back: one step back; on the first step it skips (web: X = done).
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepRef.current > 0) goTo(stepRef.current - 1);
      else finish('close');
      return true;
    });
    return () => {
      sub.remove();
      setOnboardingOpen(false);
      // Dismissed some other way (a deep link replaced it): still done, or
      // the gate would bring it straight back.
      if (!finished.current) {
        finished.current = true;
        markOnboardingDismissed();
        void patchSettings({ onboardingCompleted: true });
      }
    };
  }, []);

  const id = STEPS[step];
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID="screen-onboarding">
      <Backdrop />
      <StepBar
        step={step}
        total={STEPS.length}
        label={t('onboarding.step', { n: step + 1, total: STEPS.length })}
        skipLabel={t('onboarding.skip')}
        onSkip={() => finish('close')}
      />
      {/* key: a fresh mount per step replays the step's entrance keyframes. */}
      <View key={id} style={styles.flex} testID={`onboarding-slide-${id}`}>
        {id === 'welcome' ? (
          <>
            <View style={styles.art}>
              <WelcomeArt />
            </View>
            <StepCopy kicker={t('brand.name')} title={t('onboarding.welcome.title')} body={t('onboarding.welcome.body')} />
          </>
        ) : id === 'training' ? (
          <>
            <View style={styles.art}>
              <TrainingBoard label={t('onboarding.training.board')} pill={t('onboarding.training.pill')} />
            </View>
            <StepCopy
              kicker={t('onboarding.training.kicker')}
              title={t('onboarding.training.title')}
              body={t('onboarding.training.body')}
            />
          </>
        ) : id === 'path' ? (
          <>
            <View style={styles.art}>
              <RankPath
                names={{
                  novice: t('levels.novice'),
                  beginner: t('levels.beginner'),
                  intermediate: t('levels.intermediate'),
                  advanced: t('levels.advanced'),
                  expert: t('levels.expert'),
                }}
                you={t('onboarding.path.you', { level: t('levels.intermediate') })}
              />
            </View>
            <StepCopy kicker={t('onboarding.path.kicker')} title={t('onboarding.path.title')} body={t('onboarding.path.body')} />
          </>
        ) : (
          <>
            <View style={[styles.art, styles.habitArt]}>
              <HabitArt
                copy={{
                  days: t('onboarding.habit.days'),
                  unit: t('onboarding.habit.unit'),
                  best: t('onboarding.habit.best'),
                  weekdays: t('onboarding.habit.weekdays').split(','),
                  freezeNote: t('onboarding.habit.freeze_note'),
                  reviewTitle: t('onboarding.habit.review_title'),
                  reviewBody: t('onboarding.habit.review_body'),
                  reviewCount: t('onboarding.habit.review_count'),
                }}
              />
            </View>
            <StepCopy kicker={t('onboarding.habit.kicker')} title={t('onboarding.habit.title')} body={t('onboarding.habit.body')} />
          </>
        )}
        <Rise index={3} style={styles.cta}>
          {step < LAST ? (
            <PlateButton
              testID="onboarding-next"
              label={step === 0 ? t('onboarding.begin') : t('onboarding.continue')}
              onPress={() => goTo(step + 1)}
              size="lg"
              block
            />
          ) : (
            <>
              <PlateButton
                testID="onboarding-done"
                label={t('onboarding.find_level')}
                onPress={() => finish('play')}
                pressFeel="toggle"
                size="lg"
                block
              />
              <Tap
                testID="onboarding-skip"
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.skip_start', { rating: START_RATING })}
                onPress={() => finish('home')}
                style={styles.textButton}
              >
                <AppText variant="caption" color={eos.ash} style={styles.textButtonLabel}>
                  {t('onboarding.skip_start', { rating: START_RATING })}
                </AppText>
              </Tap>
            </>
          )}
        </Rise>
      </View>
    </View>
  );
}

/**
 * `radial-gradient(ellipse at 50% 30%, #2a2023 0%, #1d1b20 60%)`: an
 * ellipse through the farthest corner with the closest-side aspect ratio
 * (CSS's default sizing), drawn in screen points.
 */
function Backdrop() {
  const { width: w, height: h } = useWindowDimensions();
  const cx = w / 2;
  const cy = h * 0.3;
  // Closest-side ratio, then scaled so the ellipse reaches the farthest corner.
  const ratio = Math.min(cx, w - cx) / Math.min(cy, h - cy);
  const dx = Math.max(cx, w - cx);
  const dy = Math.max(cy, h - cy);
  const ry = Math.sqrt((dx / ratio) ** 2 + dy ** 2);
  const rx = ry * ratio;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="obBackdrop" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} rx={rx} ry={ry} fx={cx} fy={cy}>
          <Stop offset={0} stopColor={tone.warmGlow} />
          <Stop offset={0.6} stopColor={eos.ink} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill="url(#obBackdrop)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  habitArt: { paddingHorizontal: layout.gutter },
  cta: { paddingTop: space[6], paddingHorizontal: layout.gutter, gap: space[1] },
  textButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { fontSize: 13, lineHeight: 18 },
});
