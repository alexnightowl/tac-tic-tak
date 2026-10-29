import { control, radii } from '@tac/core/tokens';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Rise-coloured square that holds a glyph (session rows, review themes,
 * profile stats): 36 pt radius 8, 40 pt radius 10/12, 48 pt radius 12.
 * Defaults to radius 8 at 36 and 12 above.
 */
export function IconTile({
  size = 40,
  radius,
  color = control.tile,
  children,
  style,
}: {
  size?: number;
  radius?: number;
  /** Fill (defaults to rise #353339). */
  color?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const r = radius ?? (size <= 36 ? radii.lg : radii.xl);
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: r, backgroundColor: color }, style]}>
      {children}
    </View>
  );
}

/**
 * CSS `mask: url(…)` + `background: currentColor` as a native image: the
 * PNG's alpha in one colour (mode icons, nav glyphs). `width` defaults to
 * `size` (the review book is 28 × 24).
 */
export function TintIcon({
  source,
  size,
  width,
  color,
  style,
}: {
  source: ImageSource | number;
  size: number;
  width?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: width ?? size, height: size }, style]} pointerEvents="none">
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" tintColor={color} />
    </View>
  );
}

/**
 * Thin progress bar: rounded rise track (6 pt; 5 pt in achievements) with a
 * horizontal gradient fill (`control.progress*` / `rankProgress`).
 * `value` is 0…1; the fill keeps its rounded ends.
 */
export function ProgressBar({
  value,
  colors = control.rankProgress,
  height = 6,
  trackColor = control.progressTrack,
  style,
  testID,
}: {
  value: number;
  colors?: readonly [string, string, ...string[]];
  height?: number;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[styles.track, { height, backgroundColor: trackColor }, style]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
    >
      {v > 0 ? (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.fill, { width: `${v * 100}%` }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  track: { borderRadius: radii.full, overflow: 'hidden', alignSelf: 'stretch' },
  fill: { height: '100%', borderRadius: radii.full },
});
