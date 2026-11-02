import { alpha, eos, layout, learn, radii, space, tone } from '@tac/core/tokens';
import { ChevronLeft } from 'lucide-react-native';
import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { ThemeIcon } from '@/features/review/ThemeIcon';
import { AppText, Tap } from '@/ui';
import type { CourseTones } from './tones';

// Pieces the course screens share: the "‹ Label" back, the theme tile in
// its three looks, the radial glow and the per-puzzle segment bar.

export function BackLink({ label, onPress, testID, a11y }: { label: string; onPress: () => void; testID: string; a11y?: string }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress} style={styles.back}>
      <ChevronLeft size={18} color={eos.ash} strokeWidth={1.8} />
      <AppText variant="bodyStrong" color={eos.ash} numberOfLines={1}>
        {label}
      </AppText>
    </Tap>
  );
}

export type TileLook = 'idle' | 'now' | 'done';

/** The chapter's theme glyph on a rounded tile: idle (grey), now (course-tinted ring), done (sage + check). */
export function ThemeTile({ theme, look, tones, size = 34, glyph = 20, check = true }: { theme: string; look: TileLook; tones: CourseTones; size?: number; glyph?: number; check?: boolean }) {
  const r = Math.round(size * 0.265);
  const box: ViewStyle =
    look === 'done'
      ? { backgroundColor: alpha(tone.sageDeep, 0.14) }
      : look === 'now'
        ? { backgroundColor: tones.tint(0.22), borderWidth: 1.5, borderColor: tones.color }
        : { backgroundColor: learn.discLo, borderWidth: 1, borderColor: learn.ringTrack };
  const color = look === 'done' ? tone.sage : look === 'now' ? tones.glyph : eos.dust;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: r }, box]}>
      <ThemeIcon slug={theme} size={glyph} color={color} />
      {look === 'done' && check ? (
        <View style={styles.tick}>
          <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={eos.ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12.5l4.5 4.5L19 7.5" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

/** A soft radial light behind a hero (canvas: radial-gradient(circle, colour, transparent 62–65%)). */
export function Glow({ color, size, stop = 0.65, style }: { color: string; size: number; stop?: number; style?: StyleProp<ViewStyle> }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset={stop} stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export type SegmentLook = 'right' | 'wrong' | 'now' | 'rest';

/** One segment per puzzle (LearnSolve / LearnExam): right sage, wrong rose, current bone, rest dark. */
export function Segments({ looks, gap = 3, testID, label }: { looks: readonly SegmentLook[]; gap?: number; testID: string; label: string }) {
  return (
    <View style={[styles.segments, { gap }]} testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      {looks.map((l, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: SEGMENT[l] }]} />
      ))}
    </View>
  );
}

const SEGMENT: Record<SegmentLook, string> = { right: tone.sageDeep, wrong: tone.rose, now: eos.bone, rest: tone.ringTrack };

/** The docked bottom area of the result screens (CTA column). */
export function Dock({ children, bottom }: { children: ReactNode; bottom: number }) {
  return <View style={[styles.dock, { paddingBottom: bottom }]}>{children}</View>;
}

const styles = StyleSheet.create({
  back: { height: layout.headerButton, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1.5], maxWidth: 220 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  tick: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: radii.full,
    backgroundColor: tone.sageDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: eos.slate,
  },
  segments: { paddingHorizontal: layout.gutter, paddingTop: space[1], flexDirection: 'row' },
  segment: { flex: 1, height: 4, borderRadius: radii.full },
  dock: { position: 'absolute', left: layout.gutter, right: layout.gutter, bottom: 0, gap: space[1] },
});
