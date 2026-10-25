import { eos, layout, radii, rank, space, surface } from '@tac/core/tokens';
import { router } from 'expo-router';
import { Compass, Flame, Layers, Sparkles, Swords, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { patchSettings } from '@/shell/settings';
import { AppText } from '@/ui/AppText';
import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { Tap } from '@/ui/Tap';
import { markOnboardingDismissed, setOnboardingOpen } from './gate';

// Port of the web OnboardingModal (5 slides) as a full-screen modal pager:
// swipe or Back/Next, dots stretch with the scroll offset (UI thread),
// icons drift a little slower than the page. Skip, the close button and
// "Let's go" all mark onboardingCompleted (optimistic; the web ignored a
// failed save the same way); "Let's go" lands on the Play tab.

type Slide = { id: string; Icon: LucideIcon; color: string };

// Web: amber-300 for welcome / calibration / streak, the accent for the
// other two. Amber is the intermediate rank gold here (no amber token).
const AMBER = rank.intermediate.color;
const SLIDES: readonly Slide[] = [
  { id: 'welcome', Icon: Sparkles, color: AMBER },
  { id: 'styles', Icon: Layers, color: eos.ember },
  { id: 'calibration', Icon: Compass, color: AMBER },
  { id: 'streak', Icon: Flame, color: AMBER },
  { id: 'start', Icon: Swords, color: eos.ember },
];

const DOT = 6;
const DOT_ACTIVE = 24;

export function OnboardingScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  const finished = useRef(false);
  const last = SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.value = e.contentOffset.x;
    },
  });

  const finish = (toPlay: boolean) => {
    if (finished.current) return;
    finished.current = true;
    markOnboardingDismissed();
    void patchSettings({ onboardingCompleted: true });
    router.back();
    if (toPlay) router.navigate('/play');
  };

  useEffect(() => {
    setOnboardingOpen(true);
    // Android back = skip (web: X and Skip both persist "done").
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish(false);
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

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(last, i));
    if (next === step) return;
    feel.emit('tabChange');
    setStep(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: !reduced });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="screen-onboarding">
      <View style={styles.topBar}>
        <AppText variant="caption" testID="onboarding-step" accessibilityLiveRegion="polite">
          {t('onboarding.step', { n: step + 1, total: SLIDES.length })}
        </AppText>
        <Tap
          testID="screen-onboarding-close"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
          onPress={() => finish(false)}
          style={styles.close}
        >
          <X size={22} color={eos.ash} />
        </Tap>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== step) {
            feel.emit('tabChange');
            setStep(i);
          }
        }}
        style={styles.pager}
        testID="onboarding-pager"
      >
        {SLIDES.map((s, i) => (
          <SlideView key={s.id} slide={s} index={i} width={width} x={x} t={t} active={i === step} still={reduced} />
        ))}
      </Animated.ScrollView>

      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {SLIDES.map((s, i) => (
          <Dot key={s.id} i={i} x={x} width={width} />
        ))}
      </View>

      <View style={styles.controls}>
        <Tap
          testID="onboarding-skip"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
          onPress={() => finish(false)}
          style={styles.skip}
        >
          <AppText variant="caption" color={eos.dust}>
            {t('onboarding.skip')}
          </AppText>
        </Tap>
        <View style={styles.buttons}>
          {step > 0 ? (
            <PlateButton testID="onboarding-back" label={t('onboarding.back')} variant="slate" onPress={() => goTo(step - 1)} />
          ) : null}
          {step < last ? (
            <PlateButton testID="onboarding-next" label={t('onboarding.next')} onPress={() => goTo(step + 1)} />
          ) : (
            <PlateButton testID="onboarding-done" label={t('onboarding.done')} onPress={() => finish(true)} pressFeel="toggle" />
          )}
        </View>
      </View>
    </View>
  );
}

function SlideView({
  slide,
  index,
  width,
  x,
  t,
  active,
  still,
}: {
  slide: Slide;
  index: number;
  width: number;
  x: SharedValue<number>;
  t: (k: string) => string;
  active: boolean;
  /** Reduced motion: no parallax. */
  still: boolean;
}) {
  const { Icon } = slide;
  // Parallax: the icon tile lags the page by 35 %.
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: still ? 0 : interpolate(x.value, [(index - 1) * width, index * width, (index + 1) * width], [-width * 0.35, 0, width * 0.35]) }],
  }));
  return (
    <View
      style={[styles.slide, { width }]}
      testID={`onboarding-slide-${slide.id}`}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.tile, drift]}>
        <Icon size={28} color={slide.color} strokeWidth={1.8} />
      </Animated.View>
      <AppText variant="title" accessibilityRole="header" style={styles.center} testID={active ? 'onboarding-title' : undefined}>
        {t(`onboarding.${slide.id}.title`)}
      </AppText>
      <AppText variant="body" color={eos.ash} style={[styles.center, styles.body]}>
        {t(`onboarding.${slide.id}.body`)}
      </AppText>
    </View>
  );
}

/** Web dot: 6 → 24 pt wide and accent when active; here interpolated from the scroll offset. */
function Dot({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(x.value / Math.max(1, width) - i));
    return {
      width: interpolate(d, [0, 1], [DOT_ACTIVE, DOT]),
      backgroundColor: d < 0.5 ? eos.ember : surface.heroRing,
      opacity: interpolate(d, [0, 1], [1, 0.9]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: layout.gutter, paddingRight: space[2] },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pager: { flex: 1 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: layout.gutter * 2, gap: space[3] },
  tile: {
    width: 64,
    height: 64,
    borderRadius: radii['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: eos.seam,
    marginBottom: space[2],
  },
  center: { textAlign: 'center' },
  body: { maxWidth: 360, lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[1.5], height: space[6] },
  dot: { height: DOT, borderRadius: radii.full },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingTop: space[4],
    minHeight: 60,
  },
  skip: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space[1] },
  buttons: { flexDirection: 'row', gap: space[2] },
});
