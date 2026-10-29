import { alpha, black, eos, radii, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/ui/AppText';
import { PATH, ease, kf, useTrack } from './motion';
import { HEAVY, RadialDisc, svgStop } from './parts';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const W = 402;
const H = 330;
const TRAIL_LEN = 420;
const TRAIL = svgStop(alpha(tone.rose, 0.28));

type Eye = {
  id: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  left: number;
  top: number;
  size: number;
  source: number;
  opacity: number;
};

// Canvas positions inside the 402 × 330 stage. The eyes are the canvas's own
// 512 px art (crisper than the faded icons/tomoe-* set), sized per eye; the
// two locked ones have its grayscale(1) brightness(.55) baked in.
const EYES: readonly Eye[] = [
  { id: 'novice', left: 14, top: 206, size: 56, source: require('../../../assets/onboarding/eye-novice.webp'), opacity: 0.85 },
  { id: 'beginner', left: 84, top: 162, size: 64, source: require('../../../assets/onboarding/eye-beginner.webp'), opacity: 0.85 },
  { id: 'intermediate', left: 160, top: 112, size: 82, source: require('../../../assets/onboarding/eye-intermediate.webp'), opacity: 1 },
  { id: 'advanced', left: 250, top: 82, size: 64, source: require('../../../assets/onboarding/eye-advanced-locked.webp'), opacity: 0.7 },
  { id: 'expert', left: 326, top: 40, size: 64, source: require('../../../assets/onboarding/eye-expert-locked.webp'), opacity: 0.7 },
];

const SPARKS = [
  { left: 196, top: 190 },
  { left: 230, top: 175 },
  { left: 176, top: 170 },
  { left: 214, top: 200 },
] as const;

const GLOW_STOPS = [
  [0, alpha(tone.emberGlow, 0.5)],
  [0.65, alpha(eos.ink, 0)],
] as const;

/**
 * MobOnboarding3: the five rank eyes climbing a faint rose trail. Each eye
 * pops in turn; "you" (Intermediate) spins slowly inside a breathing glow
 * with embers drifting up; the two ranks above are greyed out. The 402 pt
 * stage scales down on narrower phones.
 */
export function RankPath({ names, you }: { names: Record<Eye['id'], string>; you: string }) {
  const { width } = useWindowDimensions();
  const k = Math.min(1, width / W);
  const trail = useTrack(PATH.trail);
  const trailProps = useAnimatedProps(() => ({ strokeDashoffset: TRAIL_LEN * (1 - ease.trail(trail.get())) }));

  return (
    <View style={[styles.stage, { transform: [{ scale: k }] }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        <AnimatedPath
          d="M42 262 C 120 236, 170 190, 201 158 S 300 96, 358 70"
          fill="none"
          stroke={TRAIL.color}
          strokeOpacity={TRAIL.opacity}
          strokeWidth={1.5}
          strokeDasharray={[TRAIL_LEN, TRAIL_LEN]}
          animatedProps={trailProps}
        />
      </Svg>
      {EYES.map((eye, i) => (
        <EyeColumn key={eye.id} eye={eye} delay={PATH.pop.delays[i]} label={eye.id === 'intermediate' ? you : names[eye.id]} />
      ))}
      {SPARKS.map((s, i) => (
        <Spark key={i} left={s.left} top={s.top} delay={PATH.drift.delays[i]} />
      ))}
    </View>
  );
}

function EyeColumn({ eye, delay, label }: { eye: Eye; delay: number; label: string }) {
  const you = eye.id === 'intermediate';
  const pop = useTrack({ duration: PATH.pop.duration, delay });
  const popStyle = useAnimatedStyle(() => {
    const p = pop.get();
    return {
      opacity: kf(p, [[0, 0], [0.7, 1], [1, 1]], ease.outSoft),
      transform: [
        { translateY: kf(p, [[0, 16], [0.7, -2], [1, 0]], ease.outSoft) },
        { scale: kf(p, [[0, 0.7], [0.7, 1.04], [1, 1]], ease.outSoft) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.column, { left: eye.left, top: eye.top, width: eye.size }, popStyle]}>
      {you ? <YouGlow /> : null}
      {you ? (
        <SpinningEye source={eye.source} size={eye.size} />
      ) : (
        <Image source={eye.source} style={{ width: eye.size, height: eye.size, opacity: eye.opacity }} contentFit="contain" />
      )}
      <AppText
        variant="label"
        color={you ? eos.bone : eos.dust}
        numberOfLines={1}
        style={[styles.name, you ? styles.nameYou : null]}
      >
        {label}
      </AppText>
    </Animated.View>
  );
}

/** 174 pt ember disc behind "you": opacity .65 ↔ 1, scale .94 ↔ 1.08, 3.2 s. */
function YouGlow() {
  const p = useTrack(PATH.glow, 0.5);
  const style = useAnimatedStyle(() => ({
    opacity: kf(p.get(), [[0, 0.65], [0.5, 1], [1, 0.65]], ease.inOut),
    transform: [{ scale: kf(p.get(), [[0, 0.94], [0.5, 1.08], [1, 0.94]], ease.inOut) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.glow, style]}>
      <RadialDisc size={174} stops={GLOW_STOPS} />
    </Animated.View>
  );
}

/** One turn per 14 s, linear; drop-shadow(0 10px 18px black/60). */
function SpinningEye({ source, size }: { source: number; size: number }) {
  const p = useTrack(PATH.spin, 0);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.get() * 360}deg` }] }));
  return (
    <View style={styles.eyeShadow}>
      <Animated.View style={style}>
        <Image source={source} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

/** 4 pt ember spark rising 60 pt over 3.6 s (ease-out), peaking at .8 opacity. */
function Spark({ left, top, delay }: { left: number; top: number; delay: number }) {
  const p = useTrack({ duration: PATH.drift.duration, delay, loop: true }, 0);
  const style = useAnimatedStyle(() => ({
    opacity: kf(p.get(), [[0, 0], [0.2, 0.8], [1, 0]], ease.out),
    transform: [{ translateY: kf(p.get(), [[0, 0], [1, -60]], ease.out) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.spark, { left, top }, style]} />;
}

const styles = StyleSheet.create({
  stage: { width: W, height: H },
  column: { position: 'absolute', alignItems: 'center', gap: 8 },
  glow: { position: 'absolute', left: -46, top: -46, width: 174, height: 174 },
  eyeShadow: { shadowColor: black, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 9 },
  // 10 / 800, 1 px tracking, nowrap: wider than its column, centred on it.
  name: { width: 200, textAlign: 'center', fontFamily: HEAVY, fontSize: 10, lineHeight: 14, letterSpacing: 1 },
  nameYou: { fontSize: 12, lineHeight: 16 },
  spark: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: tone.spark,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 6, spreadDistance: 0, color: alpha(tone.spark, 0.9) }],
  },
});
