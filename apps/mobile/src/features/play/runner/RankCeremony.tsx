import { BAND_ICON_KEY, type BandKey } from '@tac/core/rules';
import { rankLineKey } from '@tac/core/runner';
import { black, ceremony, easing, eos, graphite, keyframes, keyframeStops, layout, radii, rankCeremony, space, white } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { feel, stopLongClip } from '@/feel';
import { AppText, PlateButton } from '@/ui';
import { BAND_ICONS } from '../setup/DifficultySlider';
import type { PlayT } from '../strings';
import { TABULAR } from '../ui';
import { CountTo } from './CountTo';

// Full-screen band change (web components/RankCeremony.tsx). Up: the old
// eye spins away, a white flash, the new eye pops in with an ember glow.
// Down: the eye spins and the new one lands cooled to grey, no flash.
// Every transform runs on the UI thread; React renders three times (the
// stages). Sound + haptic timeline: FEEL_TABLE rankUp / rankDown.

type Props = {
  direction: 'up' | 'down';
  from: BandKey;
  to: BandKey;
  normFrom: number;
  normTo: number;
  styleLabel: string;
  onClose: () => void;
  t: PlayT;
};

const EYE = 200;
/** See styles.dim. */
const DIM_MATCH = 0.88;
/** drop-shadow(0 0 26px): a halo about 40 pt past the eye's rim. */
const GLOW = EYE + 80;
const bez = (b: readonly [number, number, number, number]) => Easing.bezier(b[0], b[1], b[2], b[3]);
const GLOW_RGB = `rgb(${ceremony.glowRgb.join(',')})`;

/**
 * SVG stops ignore an rgba() colour's alpha: split it into an opaque
 * colour + stopOpacity (else the 12 % mid stop paints the screen red).
 */
function stopOf(c: string): { stopColor: string; stopOpacity: number } {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(c);
  return m ? { stopColor: `rgb(${m[1]},${m[2]},${m[3]})`, stopOpacity: Number(m[4]) } : { stopColor: c, stopOpacity: 1 };
}

/** CSS keyframes ease each segment: one withTiming per stop. */
function keyframed(stops: readonly (readonly [number, number])[], duration: number, ease: ReturnType<typeof bez>) {
  const steps = [];
  for (let i = 1; i < stops.length; i++) {
    steps.push(withTiming(stops[i][1], { duration: (stops[i][0] - stops[i - 1][0]) * duration, easing: ease }));
  }
  return withSequence(...steps);
}

export function RankCeremony({ direction, from, to, normFrom, normTo, styleLabel, onClose, t }: Props) {
  const up = direction === 'up';
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  const spinR = useSharedValue(0);
  const spinS = useSharedValue(1);
  const spinO = useSharedValue(0);
  const popS = useSharedValue(0.6);
  const popR = useSharedValue(-120);
  const popO = useSharedValue(0);
  const flash = useSharedValue(0);
  const glow = useSharedValue<number>(up ? ceremony.upAlpha[0] : ceremony.downAlpha[0]);
  const textO = useSharedValue(0);
  const textY = useSharedValue<number>(rankCeremony.textIn.fromY);
  const ctaO = useSharedValue(0);

  // Timeline: the clip and the haptic pattern start at 0, stage 1 at
  // 40 ms, stage 2 at 950 (up) / 750 (down) / 200 ms (reduced motion).
  useEffect(() => {
    if (up) feel.emit('rankUp', { band: to });
    else feel.emit('rankDown');
    const s1 = setTimeout(() => setStage(1), rankCeremony.stage1At);
    const at2 = reduced ? rankCeremony.stage2AtReduced : up ? rankCeremony.stage2AtUp : rankCeremony.stage2AtDown;
    const s2 = setTimeout(() => setStage(2), at2);
    return () => {
      clearTimeout(s1);
      clearTimeout(s2);
    };
  }, [up, to, reduced]);

  useEffect(() => {
    const glowTo = (a: number) =>
      glow.set(reduced ? a : withTiming(a, { duration: rankCeremony.glowTransition, easing: bez(easing.ease) }));
    if (stage === 1) {
      glowTo(up ? ceremony.upAlpha[1] : ceremony.downAlpha[1]);
      if (reduced) return;
      const k = keyframes.rankSpin;
      const e = bez(k.easing);
      spinO.set(1);
      spinR.set(keyframed(keyframeStops.rankSpinRotate, k.duration, e));
      spinS.set(keyframed(keyframeStops.rankSpinScale, k.duration, e));
      spinO.set(keyframed(keyframeStops.rankSpinOpacity, k.duration, e));
    }
    if (stage === 2) {
      glowTo(up ? ceremony.upAlpha[2] : ceremony.downAlpha[2]);
      spinO.set(reduced ? 0 : withTiming(0, { duration: rankCeremony.oldEyeFade }));
      if (reduced) {
        popS.set(1);
        popR.set(0);
        popO.set(1);
        textO.set(1);
        textY.set(0);
        ctaO.set(1);
        return;
      }
      const p = keyframes.rankPop;
      const pe = bez(p.easing);
      popS.set(withTiming(1, { duration: p.duration, easing: pe }));
      popR.set(withTiming(0, { duration: p.duration, easing: pe }));
      popO.set(withTiming(1, { duration: p.duration * 0.4, easing: pe }));
      if (up) {
        const f = keyframes.rankFlash;
        flash.set(keyframed(keyframeStops.rankFlashOpacity, f.duration, bez(f.easing)));
      }
      const ti = rankCeremony.textIn;
      const te = bez(easing.twDefault);
      textO.set(withDelay(ti.delay, withTiming(1, { duration: ti.duration, easing: te })));
      textY.set(withDelay(ti.delay, withTiming(0, { duration: ti.duration, easing: te })));
      const ci = rankCeremony.continueIn;
      ctaO.set(withDelay(ci.delay, withTiming(1, { duration: ci.duration, easing: te })));
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const oldEye = useAnimatedStyle(() => ({
    opacity: spinO.get(),
    transform: [{ rotate: `${spinR.get()}deg` }, { scale: spinS.get() }],
  }));
  const newEye = useAnimatedStyle(() => ({
    opacity: popO.get(),
    transform: [{ rotate: `${popR.get()}deg` }, { scale: popS.get() }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textO.get(), transform: [{ translateY: textY.get() }] }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaO.get() }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const close = () => {
    stopLongClip(rankCeremony.closeFade);
    onClose();
  };

  const finalGlow = to === 'expert' ? ceremony.finalGlowExpert : ceremony.finalGlow;
  const fromIcon = BAND_ICONS[BAND_ICON_KEY[from]];
  const toIcon = BAND_ICONS[BAND_ICON_KEY[to]];

  return (
    <View
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space[6] }]}
      testID="rank-ceremony"
      accessibilityViewIsModal
    >
      <BackdropGlow alpha={glow} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />

      <View style={styles.eyes}>
        {up && stage === 2 && <EyeGlow color={finalGlow} opacity={popO} />}
        <Animated.View style={[styles.eye, oldEye]}>
          <Image source={fromIcon} style={styles.eyeImg} contentFit="contain" transition={null} />
        </Animated.View>
        <Animated.View style={[styles.eye, newEye]}>
          <Image source={toIcon} style={styles.eyeImg} contentFit="contain" transition={null} />
          {!up && (
            // web grayscale(0.85) brightness(0.75): a saturation blend for the
            // colour, the eye's own silhouette in black for the brightness.
            <>
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.desaturate]} />
              <Image source={toIcon} style={[StyleSheet.absoluteFill, styles.dim]} contentFit="contain" tintColor={black} transition={null} />
            </>
          )}
        </Animated.View>
      </View>

      <Animated.View style={[styles.text, textStyle]}>
        <AppText variant="eyebrow" color={up ? eos.rose : eos.ash} style={styles.kicker} testID={up ? 'ceremony-up' : 'ceremony-down'}>
          {up ? t('rank.up') : t('rank.down')}
        </AppText>
        <AppText variant="sectionTitle" style={styles.center} accessibilityRole="header" testID="ceremony-band">
          {t(`levels.${to}`)}
        </AppText>
        <View style={styles.normRow}>
          <AppText variant="body" color={eos.ash}>
            {`${t('rank.norm', { style: styleLabel })} `}
          </AppText>
          <AppText variant="body" color={eos.bone} style={TABULAR}>
            {`${normFrom} → `}
          </AppText>
          {stage === 2 ? (
            <CountTo
              from={normFrom}
              to={normTo}
              delay={0}
              duration={rankCeremony.counterMs}
              linear
              variant="body"
              color={eos.bone}
              testID="ceremony-norm"
            />
          ) : (
            <AppText variant="body" color={eos.bone} style={TABULAR}>
              {String(normFrom)}
            </AppText>
          )}
        </View>
        <AppText variant="caption" color={eos.dust} style={styles.center}>
          {t(rankLineKey(up, to))}
        </AppText>
      </Animated.View>

      <Animated.View style={[styles.cta, ctaStyle]} pointerEvents={stage === 2 ? 'auto' : 'none'}>
        <PlateButton testID="ceremony-continue" label={t('rank.continue')} onPress={close} size="lg" block />
      </Animated.View>
    </View>
  );
}

/**
 * radial-gradient(circle at 50% 38%, glow@alpha 0%, glowMid 35%,
 * transparent 65%): a circle sized to the farthest corner (CSS default),
 * in screen points, not a bounding-box ellipse.
 */
function BackdropGlow({ alpha }: { alpha: SharedValue<number> }) {
  const { width: w, height: h } = useWindowDimensions();
  const peak = ceremony.upAlpha[2];
  const style = useAnimatedStyle(() => ({ opacity: alpha.get() / peak }));
  const [fx, fy] = ceremony.glowCenter;
  const cx = w * fx;
  const cy = h * fy;
  const r = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="ceremonyGlow" cx={cx} cy={cy} r={r} fx={cx} fy={cy} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={GLOW_RGB} stopOpacity={peak} />
            <Stop offset="0.35" {...stopOf(ceremony.glowMid)} />
            <Stop offset="0.65" {...stopOf(ceremony.glowEnd)} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill="url(#ceremonyGlow)" />
      </Svg>
    </Animated.View>
  );
}

/** The new eye's drop-shadow(0 0 26px …), drawn as a radial halo behind it. */
function EyeGlow({ color, opacity }: { color: string; opacity: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View pointerEvents="none" style={[styles.glow, style]}>
      <Svg width={GLOW} height={GLOW}>
        <Defs>
          <RadialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <Stop offset={String(EYE / GLOW - 0.06)} {...stopOf(color)} />
            <Stop offset="1" stopColor={stopOf(color).stopColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={GLOW} height={GLOW} fill="url(#eyeGlow)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    backgroundColor: eos.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter + space[2],
  },
  flash: { backgroundColor: white },
  eyes: { width: EYE, height: EYE, alignItems: 'center', justifyContent: 'center' },
  eye: { ...StyleSheet.absoluteFill },
  eyeImg: { width: EYE, height: EYE },
  // The eye art is a disc: a round blend layer, so the backdrop glow around it keeps its colour.
  desaturate: {
    margin: EYE * 0.02,
    borderRadius: radii.full,
    backgroundColor: graphite[500],
    mixBlendMode: 'saturation',
    opacity: ceremony.downFilter.grayscale,
  },
  // brightness(0.75) after the saturation blend: the blend keeps the
  // backdrop's luminance a little high, so the black layer is matched to
  // the canvas render (eye mean 48 vs 55 at 0.25) rather than 1 − 0.75.
  dim: { opacity: 1 - ceremony.downFilter.brightness * DIM_MATCH },
  glow: { position: 'absolute', width: GLOW, height: GLOW, left: (EYE - GLOW) / 2, top: (EYE - GLOW) / 2 },
  text: { marginTop: space[10], alignItems: 'center', gap: space[2] },
  kicker: { letterSpacing: 3 },
  center: { textAlign: 'center' },
  normRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center' },
  cta: { marginTop: space[10], alignSelf: 'center', width: '100%', maxWidth: layout.sidePanel },
});
