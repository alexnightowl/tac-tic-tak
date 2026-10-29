import { alpha, black, board, eos, radii, surface, tone, white } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BOARD_IMAGE, PIECE_IMAGES, type PieceCode } from '@/board/assets';
import { AppText } from '@/ui/AppText';
import { TRAINING, ease, kf, useTrack, type Stops } from './motion';
import { HEAVY, svgStop } from './parts';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 300;
const SQ = SIZE / 8;
/** d1 → d8: the rook's file and its two ranks, in board points. */
const D_FILE = 3 * SQ;
const RANK_1 = 7 * SQ;

/** 6k1/5ppp/8/8/8/8/5PPP/6K1 (the rook is drawn separately). */
const PIECES: readonly { sq: string; code: PieceCode }[] = [
  { sq: 'g8', code: 'bK' },
  { sq: 'f7', code: 'bP' },
  { sq: 'g7', code: 'bP' },
  { sq: 'h7', code: 'bP' },
  { sq: 'f2', code: 'wP' },
  { sq: 'g2', code: 'wP' },
  { sq: 'h2', code: 'wP' },
  { sq: 'g1', code: 'wK' },
];
/** The canvas's per-kind sprite fit: translate(0, -1%) scale(P 1.10 / K 1.04), origin 50% 94%. */
const FIT: Record<string, number> = { P: 1.1, K: 1.04 };

function at(sq: string) {
  return { left: (sq.charCodeAt(0) - 97) * SQ, top: (8 - Number(sq[1])) * SQ };
}

// The 5.2 s loop (MobOnboarding2 keyframes, percent → 0…1).
const K = {
  rookTop: [[0, RANK_1], [0.4, RANK_1], [0.56, 0], [1, 0]],
  rookOpacity: [[0, 0], [0.05, 1], [0.93, 1], [1, 0]],
  sel: [[0, 0], [0.05, 0], [0.09, 1], [0.42, 1], [0.48, 0], [1, 0]],
  tgt: [[0, 0], [0.12, 0], [0.18, 1], [0.5, 1], [0.56, 0], [1, 0]],
  drawOffset: [[0, 6.4], [0.12, 6.4], [0.34, 0], [1, 0]],
  drawOpacity: [[0, 1], [0.46, 1], [0.54, 0], [1, 0]],
  head: [[0, 0], [0.3, 0], [0.34, 1], [0.46, 1], [0.54, 0], [1, 0]],
  mate: [[0, 0], [0.57, 0], [0.62, 1], [0.9, 1], [0.96, 0], [1, 0]],
  pillOpacity: [[0, 0], [0.6, 0], [0.66, 1], [0.9, 1], [0.96, 0], [1, 0]],
  pillY: [[0, 8], [0.6, 8], [0.66, 0], [1, 0]],
  pillScale: [[0, 0.9], [0.6, 0.9], [0.66, 1.04], [0.7, 1], [1, 1]],
} as const satisfies Record<string, Stops>;

const ARROW = svgStop(board.dropRing); // rgba(47,95,158,.85)
const MATE_HOT = svgStop(alpha(tone.emberGlow, 0.75));
const MATE_RIM = svgStop(alpha(eos.ember, 0.25));

/**
 * MobOnboarding2: the tilted back-rank-mate board. The rook is picked on
 * d1, the target ring and arrow draw to d8, the rook slides up, g8 burns
 * and the "Rd8# · solved in 4 s" pill pops; 5.2 s loop after 0.6 s.
 */
export function TrainingBoard({ label, pill }: { label: string; pill: string }) {
  const boardIn = useTrack(TRAINING.boardIn);
  const p = useTrack(TRAINING.loop, TRAINING.stillAt);

  const inStyle = useAnimatedStyle(() => {
    const e = ease.outSoft(boardIn.get());
    return {
      opacity: e,
      transform: [{ rotate: '-2deg' }, { translateY: 16 * (1 - e) }, { scale: 0.96 + 0.04 * e }],
    };
  });
  const rook = useAnimatedStyle(() => ({
    opacity: kf(p.get(), K.rookOpacity, ease.board),
    transform: [{ translateY: kf(p.get(), K.rookTop, ease.board) - RANK_1 }],
  }));
  const sel = useAnimatedStyle(() => ({ opacity: kf(p.get(), K.sel, ease.board) }));
  const tgt = useAnimatedStyle(() => ({ opacity: kf(p.get(), K.tgt, ease.board) }));
  const mate = useAnimatedStyle(() => ({ opacity: kf(p.get(), K.mate, ease.board) }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: kf(p.get(), K.pillOpacity, ease.board),
    transform: [{ translateY: kf(p.get(), K.pillY, ease.board) }, { scale: kf(p.get(), K.pillScale, ease.board) }],
  }));
  const line = useAnimatedProps(() => ({
    strokeDashoffset: kf(p.get(), K.drawOffset, ease.board),
    opacity: kf(p.get(), K.drawOpacity, ease.board),
  }));
  const head = useAnimatedProps(() => ({ opacity: kf(p.get(), K.head, ease.board) }));

  return (
    <Animated.View style={[styles.frame, inStyle]} accessible accessibilityRole="image" accessibilityLabel={label}>
      <View style={styles.clip}>
        <Image source={BOARD_IMAGE} style={styles.board} contentFit="fill" />
        {PIECES.map(({ sq, code }) => (
          <Image
            key={sq}
            source={PIECE_IMAGES.classic[code]}
            style={[styles.sq, at(sq), { transform: [{ translateY: -0.01 * SQ }, { scale: FIT[code[1]] }] }]}
            contentFit="contain"
          />
        ))}
        <Animated.View style={[styles.sq, styles.selected, { left: D_FILE, top: RANK_1 }, sel]} />
        <Animated.View style={[styles.sq, { left: D_FILE, top: 0 }, tgt]}>
          <View style={styles.target} />
        </Animated.View>
        <Animated.View style={[styles.sq, at('g8'), mate]}>
          <Svg width={SQ} height={SQ}>
            <Defs>
              <RadialGradient id="obMate" gradientUnits="userSpaceOnUse" cx={SQ / 2} cy={SQ / 2} r={(SQ / 2) * Math.SQRT2}>
                <Stop offset={0} stopColor={MATE_HOT.color} stopOpacity={MATE_HOT.opacity} />
                <Stop offset={0.7} stopColor={MATE_RIM.color} stopOpacity={MATE_RIM.opacity} />
                <Stop offset={1} stopColor={MATE_RIM.color} stopOpacity={MATE_RIM.opacity} />
              </RadialGradient>
            </Defs>
            <Rect width={SQ} height={SQ} fill="url(#obMate)" />
          </Svg>
        </Animated.View>
        <Svg viewBox="0 0 8 8" width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
          <AnimatedPath
            d="M3.5 7.3V1.2"
            stroke={ARROW.color}
            strokeOpacity={ARROW.opacity}
            strokeWidth={0.2}
            strokeLinecap="round"
            strokeDasharray={[6.4, 6.4]}
            fill="none"
            animatedProps={line}
          />
          <AnimatedPath d="M3.1 1.32L3.5 0.6 3.9 1.32z" fill={ARROW.color} fillOpacity={ARROW.opacity} animatedProps={head} />
        </Svg>
        <Animated.View style={[styles.sq, styles.rookShadow, { left: D_FILE, top: RANK_1 }, rook]}>
          <Image source={PIECE_IMAGES.classic.wR} style={styles.rook} contentFit="contain" />
        </Animated.View>
        <View style={styles.pillRow} pointerEvents="none">
          <Animated.View style={[styles.pill, pillStyle]}>
            <View style={styles.pillDot} />
            <AppText variant="captionStrong" style={styles.pillText} numberOfLines={1}>
              {pill}
            </AppText>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 0 0 0 1px bone/6 % ring + 0 24px 50px black/60; the clip sits inside so iOS keeps the drop.
  frame: {
    width: SIZE,
    height: SIZE,
    borderRadius: 6,
    backgroundColor: board.dark,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(white, 0.06) },
      { offsetX: 0, offsetY: 24, blurRadius: 50, spreadDistance: 0, color: alpha(black, 0.6) },
    ],
  },
  clip: { ...StyleSheet.absoluteFill, borderRadius: 6, overflow: 'hidden' },
  board: { ...StyleSheet.absoluteFill },
  sq: { position: 'absolute', width: SQ, height: SQ, transformOrigin: '50% 94%' },
  selected: { backgroundColor: board.selected, borderWidth: 3, borderColor: board.selectedRing },
  // inset 4 %: a 5 pt ring, legal grey at 42 %.
  target: {
    position: 'absolute',
    top: SQ * 0.04,
    left: SQ * 0.04,
    right: SQ * 0.04,
    bottom: SQ * 0.04,
    borderRadius: radii.full,
    borderWidth: 5,
    borderColor: alpha(tone.legalGrey, 0.42),
  },
  rookShadow: { shadowColor: black, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 4 },
  // translate(0, -2%) scale(1.1), origin 50% 94%.
  rook: { width: SQ, height: SQ, transformOrigin: '50% 94%', transform: [{ translateY: -0.02 * SQ }, { scale: 1.1 }] },
  pillRow: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  pill: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: surface.inkVeil92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: eos.seam },
      { offsetX: 0, offsetY: 8, blurRadius: 18, spreadDistance: 0, color: alpha(black, 0.5) },
    ],
  },
  pillDot: { width: 8, height: 8, borderRadius: radii.full, backgroundColor: tone.sageDeep },
  pillText: { color: eos.bone, fontFamily: HEAVY },
});
