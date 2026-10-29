import { alpha, eos, radii, space, white } from '@tac/core/tokens';
import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { AppText } from '@/ui/AppText';
import { fontFamily } from '@/ui/fonts';
import { Kicker } from '@/ui/SectionLabel';
import { Tap } from '@/ui/Tap';
import { ENTRANCE, ease, useTrack } from './motion';

/** Manrope 800 (the canvas's small caps labels and pills; same face in en and uk). */
export const HEAVY = fontFamily('en', 'sans', 800);

/** Splits `rgba(r,g,b,a)` / `#rrggbb` into svg stop colour + opacity (svg ignores rgba alpha). */
export function svgStop(color: string): { color: string; opacity: number } {
  const m = color.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return { color, opacity: 1 };
  return { color: `rgb(${m[1]},${m[2]},${m[3]})`, opacity: m[4] === undefined ? 1 : Number(m[4]) };
}

/**
 * CSS interpolates gradients in premultiplied alpha, svg does not: a fully
 * transparent stop takes its neighbour's colour so the fade doesn't pass
 * through the transparent stop's (darker) rgb.
 */
function premultiplied(stops: readonly (readonly [number, string])[]) {
  const parsed = stops.map(([o, c]) => [o, svgStop(c)] as const);
  return parsed.map(([o, s], i) => {
    if (s.opacity > 0) return [o, s] as const;
    const near = parsed[i - 1]?.[1] ?? parsed[i + 1]?.[1] ?? s;
    return [o, { color: near.color, opacity: 0 }] as const;
  });
}

/**
 * `radial-gradient(circle, …)` filling a round box of `size`: the CSS circle
 * reaches the farthest corner (r = size/√2), the element's border-radius
 * clips it to the disc.
 */
export function RadialDisc({ size, stops }: { size: number; stops: readonly (readonly [number, string])[] }) {
  const id = useId().replace(/:/g, '');
  const r = (size / 2) * Math.SQRT2;
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id={`d${id}`} gradientUnits="userSpaceOnUse" cx={size / 2} cy={size / 2} r={r}>
          {premultiplied(stops).map(([o, s]) => (
            <Stop key={o} offset={o} stopColor={s.color} stopOpacity={s.opacity} />
          ))}
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#d${id})`} />
    </Svg>
  );
}

/** `.in1`–`.in4`: fades up 14 pt, 0.7 s, staggered by `index`. */
export function Rise({ index, children, style }: { index: 0 | 1 | 2 | 3; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useTrack({ duration: ENTRANCE.duration, delay: ENTRANCE.delays[index] });
  const a = useAnimatedStyle(() => {
    const e = ease.outSoft(p.get());
    return { opacity: e, transform: [{ translateY: ENTRANCE.rise * (1 - e) }] };
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Top bar: 4 progress segments (3 pt, gap 6) and the Skip text button. */
export function StepBar({
  step,
  total,
  label,
  skipLabel,
  onSkip,
}: {
  step: number;
  total: number;
  label: string;
  skipLabel: string;
  onSkip: () => void;
}) {
  return (
    <View style={styles.bar}>
      <View
        style={styles.segments}
        testID="onboarding-step"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: total, now: step + 1 }}
      >
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i <= step ? styles.segmentOn : null]} />
        ))}
      </View>
      <Tap
        testID="screen-onboarding-close"
        accessibilityRole="button"
        accessibilityLabel={skipLabel}
        onPress={onSkip}
        style={styles.skip}
      >
        <AppText variant="captionStrong" color={eos.ash} style={styles.skipText}>
          {skipLabel}
        </AppText>
      </Tap>
    </View>
  );
}

/** Kicker, Cinzel 27/34 title, 15/23 ash lede (padding 0 28, gap 10). */
export function StepCopy({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <View style={styles.copy}>
      <Rise index={0}>
        <Kicker style={styles.center}>{kicker}</Kicker>
      </Rise>
      <Rise index={1}>
        <AppText variant="title" accessibilityRole="header" style={styles.h1} testID="onboarding-title">
          {title}
        </AppText>
      </Rise>
      <Rise index={2} style={styles.ledeBox}>
        <AppText variant="body" color={eos.ash} style={styles.lede}>
          {body}
        </AppText>
      </Rise>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space[4], paddingLeft: 20, paddingRight: space[2], height: 44 },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 3, borderRadius: radii.full, backgroundColor: alpha(white, 0.1) },
  segmentOn: { backgroundColor: eos.ember },
  skip: { height: 44, paddingHorizontal: space[3], justifyContent: 'center' },
  skipText: { fontSize: 13, lineHeight: 18 },
  copy: { paddingHorizontal: 28, alignItems: 'center', gap: 10 },
  center: { textAlign: 'center' },
  h1: { fontSize: 27, lineHeight: 34, letterSpacing: 0, textAlign: 'center' },
  // Canvas max-width 330; +4 absorbs RN's slightly wider text measure so the
  // lines break where the canvas breaks them.
  ledeBox: { maxWidth: 334 },
  lede: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
});
