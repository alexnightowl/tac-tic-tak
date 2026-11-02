import { course as ink, tone } from '@tac/core/tokens';
import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

// The round medal of the chapter-complete screen and the certificate's
// wax seal: a radial disc (highlight at 34% 28% → colour → shadow) with a
// top light, holding a glyph. `ring` draws the medal's sand ring and the
// dark halo outside it (LearnChapterDone); the seal has a soft tinted rim.

export function Medal({
  size,
  stops,
  ring = 'medal',
  children,
  style,
}: {
  size: number;
  stops: readonly [string, string, string];
  ring?: 'medal' | 'seal' | 'none';
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const halo = ring === 'medal' ? 5 : ring === 'seal' ? 3 : 0;
  const outer = size + halo * 2;
  return (
    <View style={[{ width: outer, height: outer, borderRadius: outer / 2 }, styles.center, ring === 'medal' && styles.drop, style]}>
      {ring === 'medal' ? <View style={[styles.abs, { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: ink.medalHalo }]} /> : null}
      {ring === 'seal' ? <View style={[styles.abs, { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: ink.sealRing }]} /> : null}
      {ring === 'medal' ? <View style={[styles.abs, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, backgroundColor: tone.sand }]} /> : null}
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={id} cx="34%" cy="28%" r="80%" fx="34%" fy="28%">
              <Stop offset="0%" stopColor={stops[0]} />
              <Stop offset="48%" stopColor={stops[1]} />
              <Stop offset="100%" stopColor={stops[2]} />
            </RadialGradient>
            {/* The canvas's inset rim light (top) and inner shade (bottom). */}
            <LinearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={ink.sealLight} stopOpacity={1} />
              <Stop offset="0.06" stopColor={ink.sealLight} stopOpacity={0} />
              <Stop offset="0.78" stopColor={ink.medalShade} stopOpacity={0} />
              <Stop offset="1" stopColor={ink.medalShade} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id}v)`} />
        </Svg>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  drop: { boxShadow: [{ offsetX: 0, offsetY: 12, blurRadius: 26, spreadDistance: 0, color: ink.medalDrop }] },
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
