import type { TrainingStyle } from '@tac/core/rules';
import { control, eos, feedback, radii, rank, semantic, space } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { fontFamily } from '@/ui/fonts';

// Small presentational pieces shared by the setup, the runner and the
// summary: the web's tinted note cards, the thin progress bar and the
// time-control glyph.

/** Bold / semibold Manrope for inline emphasis (sans faces don't vary by language). */
export const STRONG = { fontFamily: fontFamily('en', 'body', 700) } as const;
export const SEMI = { fontFamily: fontFamily('en', 'body', 600) } as const;
export const TABULAR = { fontVariant: ['tabular-nums' as const] };

export const STYLE_ICON: Record<TrainingStyle, number> = {
  bullet: require('../../../assets/icons/mode-bullet.webp'),
  blitz: require('../../../assets/icons/mode-blitz.webp'),
  rapid: require('../../../assets/icons/mode-rapid.webp'),
};

/** web StyleIcon: a one-colour glyph that takes the context's ink. */
export function StyleIcon({ style, size, color = eos.ash }: { style: TrainingStyle; size: number; color?: string }) {
  return <Image source={STYLE_ICON[style]} style={{ width: size, height: size }} tintColor={color} contentFit="contain" transition={null} />;
}

/** The design's filled double flame (streak: Home, TurnCard, summary). */
const FLAME_PATH =
  'M12 23C7.6 23 4.5 20 4.5 15.8C4.5 12.6 6.2 10.4 7.6 9C7.6 10.8 8.2 12 9.4 12.6C8.9 8.6 10.6 4.6 14.2 1.2C13.6 4.8 14.6 7.6 16.4 9.8C17.2 10.8 17.6 11.8 17.6 12.6C18.4 12 18.8 11 18.9 10.2C20.2 11.8 20.5 13.6 20.5 15.4C20.5 19.8 16.8 23 12 23ZM12.4 22.2C10.4 22.2 9.2 20.9 9.2 19.4C9.2 17.9 10.3 16.9 11.1 16.2C11.2 17.2 11.7 17.8 12.3 18C12.2 16.7 12.9 15.4 14.2 14.4C14.1 15.8 14.9 16.9 15.4 17.8C15.7 18.4 15.8 19 15.8 19.5C15.8 21.1 14.3 22.2 12.4 22.2Z';

export function FlameGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={FLAME_PATH} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export type NoteTone = 'neutral' | 'accent' | 'amber' | 'rose' | 'sage';

/** Tinted card fills (web: border-x/60 bg-x/10 and the black/20 neutral). */
export const TONE: Record<NoteTone, { bg: string; border: string; ink: string }> = {
  neutral: { bg: control.platePressEmber, border: semantic.borderSoft, ink: eos.bone },
  accent: { bg: control.dangerPressBg, border: control.dangerBorder, ink: eos.ember },
  amber: { bg: rank.intermediate.glow, border: feedback.normGold, ink: rank.intermediate.color },
  rose: { bg: control.dangerPressBg, border: feedback.normDropRing, ink: eos.rose },
  sage: { bg: control.sageTint16, border: control.sageTint16, ink: eos.sage },
};

export function NoteCard({
  tone = 'neutral',
  testID,
  style,
  children,
}: {
  tone?: NoteTone;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const c = TONE[tone];
  return (
    <View testID={testID} style={[styles.note, { backgroundColor: c.bg, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

/** web 300 ms width transition on progress bars. */
const BAR_MS = 300;
const barEase = Easing.bezier(0.4, 0, 0.2, 1);

/** A 6 px bar on a faint track, min 2 % so empty still reads as a bar (web). */
export function ProgressBar({ ratio, color, testID }: { ratio: number; color: string; testID?: string }) {
  const reduced = useReducedMotion();
  const target = Math.max(0.02, Math.min(1, Math.max(0, ratio)));
  const w = useSharedValue(0);
  const p = useSharedValue(target);
  useEffect(() => {
    p.set(reduced ? target : withTiming(target, { duration: BAR_MS, easing: barEase }));
  }, [p, target, reduced]);
  const fill = useAnimatedStyle(() => ({ width: w.get() * p.get() }));
  return (
    <View style={styles.track} testID={testID} onLayout={(e) => w.set(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radii['2xl'], borderWidth: 1, padding: space[4], gap: space[1] },
  track: { height: space[1.5], borderRadius: radii.full, backgroundColor: semantic.borderSoft, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radii.full },
});
