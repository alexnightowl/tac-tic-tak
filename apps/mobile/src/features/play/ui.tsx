import type { TrainingStyle } from '@tac/core/rules';
import { control, eos, feedback, radii, rank, semantic, space } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

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
