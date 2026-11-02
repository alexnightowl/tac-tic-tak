import type { CourseEmblemState, CoursePiece } from '@tac/core/library';
import { alpha, black, eos, learn, tone, white } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { courseColor, courseTint } from './courseColor';

// The course emblem (canvas LearnStates "Course emblem · 3 states",
// LearnHome cards): a ring around a stone disc holding the course piece as
// a flat silhouette tinted by state.
//  - new      (no puzzle solved yet, downloaded or not): grey ring, grey piece, dark disc;
//  - progress: the ring fills clockwise from 12 o'clock with the course
//              colour by `ring` (solved / total in the current cycle), light piece;
//  - passed   (exam passed): full ring in the course colour, light piece,
//              the disc tinted with the course colour, a sage check bottom-right.
// Every measure scales from the canvas sizes (64 / 86 / 46): ring 5.5 %,
// disc 81 %, piece 45 %, check 32 %.

const PIECES: Record<CoursePiece, number> = {
  pawn: require('../../../assets/learn/pieces/pawn.png'),
  knight: require('../../../assets/learn/pieces/knight.png'),
  queen: require('../../../assets/learn/pieces/queen.png'),
  king: require('../../../assets/learn/pieces/king.png'),
  // No art yet for these two; the course table uses neither.
  bishop: require('../../../assets/learn/pieces/pawn.png'),
  rook: require('../../../assets/learn/pieces/pawn.png'),
};

export type CourseEmblemProps = {
  /** The course colour (`#rrggbb`, data). */
  color: string;
  piece: CoursePiece;
  state: CourseEmblemState;
  /** Ring fill 0..1 (used in 'progress'; 'passed' is always full, 'new' empty). */
  ring?: number;
  /** Outer diameter in pt. */
  size: number;
  /** Hide the check on 'passed' (the certificate seal draws its own). */
  noCheck?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CourseEmblem({ color: raw, piece, state, ring = 0, size, noCheck = false, style, testID }: CourseEmblemProps) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const color = courseColor(raw, eos.ember);
  const stroke = Math.max(2, size * 0.055);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const fill = state === 'passed' ? 1 : state === 'progress' ? Math.min(1, Math.max(0, ring)) : 0;
  const disc = Math.round(size * 0.8125);
  const pieceSize = Math.round(size * 0.45);
  const tint = state === 'new' ? learn.pieceIdle : state === 'passed' ? learn.piecePassed : learn.pieceLit;
  const stops: readonly [string, string, string] =
    state === 'passed'
      ? [courseTint(color, 0.5), courseTint(color, 0.2), learn.discLo]
      : state === 'progress'
        ? learn.discLit
        : learn.discStone;
  const mid = state === 'passed' ? '45%' : '55%';
  const check = Math.round(size * 0.32);

  return (
    <View
      style={[{ width: size, height: size }, styles.center, style]}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={learn.ringTrack} strokeWidth={stroke} fill="none" />
        {fill >= 1 ? (
          <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={stroke} fill="none" />
        ) : fill > 0 ? (
          <Path d={arc(c, r, fill)} stroke={color} strokeWidth={stroke} fill="none" />
        ) : null}
      </Svg>
      <View style={[styles.disc, { width: disc, height: disc, borderRadius: disc / 2 }]}>
        <Svg width={disc} height={disc} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={gid} cx="34%" cy="28%" r="80%" fx="34%" fy="28%">
              <Stop offset="0%" stopColor={stops[0]} />
              <Stop offset={mid} stopColor={stops[1]} />
              <Stop offset="100%" stopColor={stops[2]} />
            </RadialGradient>
          </Defs>
          <Circle cx={disc / 2} cy={disc / 2} r={disc / 2} fill={`url(#${gid})`} />
        </Svg>
        <Image source={PIECES[piece] ?? PIECES.pawn} style={{ width: pieceSize, height: pieceSize }} tintColor={tint} contentFit="contain" />
      </View>
      {state === 'passed' && !noCheck ? (
        <View style={[styles.check, { width: check, height: check, borderRadius: check / 2 }]}>
          <Svg width={check * 0.62} height={check * 0.62} viewBox="0 0 24 24" fill="none" stroke={eos.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12.5l4.5 4.5L19 7.5" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

/** Clockwise arc from 12 o'clock covering `f` (0..1) of the circle. */
function arc(c: number, r: number, f: number): string {
  const a = f * 2 * Math.PI;
  const x = c + r * Math.sin(a);
  const y = c - r * Math.cos(a);
  return `M ${c} ${c - r} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}`;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: [
      { offsetX: 0, offsetY: 1.5, blurRadius: 1, spreadDistance: 0, color: alpha(white, 0.09), inset: true },
      { offsetX: 0, offsetY: -4, blurRadius: 8, spreadDistance: 0, color: alpha(black, 0.5), inset: true },
      { offsetX: 0, offsetY: 6, blurRadius: 14, spreadDistance: 0, color: alpha(black, 0.5) },
    ],
  },
  check: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    backgroundColor: tone.sageDeep,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2, color: eos.ink }],
  },
});
