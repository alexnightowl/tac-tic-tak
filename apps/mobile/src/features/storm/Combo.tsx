import type { AppPieceSet } from '@tac/core/board';
import { comboBar, STORM_COMBO_BONUS, STORM_MAX_LEVEL } from '@tac/core/storm';
import { alpha, board, control, eos, radii, space, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PIECE_IMAGES } from '@/board/assets';
import { AppText } from '@/ui';
import { useT } from '@/ui/lang';
import { COMBO_MOTION } from './motion';
import { Bolt } from './parts';

/** Bar fill per combo level (0 = no bonus yet; 3 = max). */
const LEVEL_FILL: readonly (readonly [string, string])[] = [
  [tone.iron, tone.iron],
  control.progressCopper,
  control.progressEmberCopper,
  control.progressFlame,
];
/** Chip ink per level. */
const LEVEL_INK = [eos.ash, tone.gold, tone.blush, tone.blush];

/**
 * The Storm combo meter (owner, 2026-11-04: "more animation, like Lichess"):
 * the chip pops on every right move and bursts on a level-up, the bar fills
 * towards the next level in that level's colours and glows at the max, and
 * the line under it says what a move and a solve are worth now or next.
 */
export const ComboMeter = memo(function ComboMeter({ combo, levelUpSeq, timed }: { combo: number; levelUpSeq: number; timed: boolean }) {
  const t = useT();
  const reduced = useReducedMotion();
  const bar = comboBar(combo);
  const now = STORM_COMBO_BONUS[bar.level];

  const pop = useSharedValue(1);
  const burst = useSharedValue(0);
  const fill = useSharedValue(bar.progress);
  const glow = useSharedValue(0);
  const prevCombo = useRef(combo);
  const prevSeq = useRef(levelUpSeq);

  useEffect(() => {
    const prev = prevCombo.current;
    prevCombo.current = combo;
    fill.set(withTiming(bar.progress, combo < prev ? COMBO_MOTION.drain : COMBO_MOTION.fill));
    if (reduced || combo <= prev) return;
    pop.set(withSequence(withTiming(COMBO_MOTION.popScale, { duration: COMBO_MOTION.popMs }), withSpring(1, COMBO_MOTION.settle)));
  }, [combo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (levelUpSeq === prevSeq.current) return;
    prevSeq.current = levelUpSeq;
    if (reduced) return;
    burst.set(withSequence(withTiming(1, { duration: COMBO_MOTION.burstInMs }), withTiming(0, { duration: COMBO_MOTION.burstOutMs })));
  }, [levelUpSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // The max level breathes while it lasts.
  const atMax = bar.level >= STORM_MAX_LEVEL;
  useEffect(() => {
    glow.set(atMax && !reduced ? withRepeat(withSequence(withTiming(1, COMBO_MOTION.breathe), withTiming(0.35, COMBO_MOTION.breathe)), -1) : withTiming(0, COMBO_MOTION.fill));
  }, [atMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const chipStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() + burst.get() * (COMBO_MOTION.burstScale - 1) }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: burst.get(), transform: [{ scale: 1 + burst.get() * 0.35 }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, fill.get())) * 100}%` }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: Math.max(glow.get(), burst.get()) }));

  const ink = LEVEL_INK[bar.level];
  const line = atMax
    ? t('storm.run.combo_max', { move: now.moveMs / 1000, solve: now.solveMs / 1000 })
    : bar.level > 0
      ? t('storm.run.combo_now', { move: now.moveMs / 1000, solve: now.solveMs / 1000 })
      : t('storm.run.combo_next', { n: bar.nextAt ?? 0, move: (bar.next?.moveMs ?? 0) / 1000 });

  return (
    <View accessible accessibilityLabel={t('storm.run.combo_a11y', { n: combo, level: bar.level, max: STORM_MAX_LEVEL })} testID="storm-run-combo-meter">
      <View style={styles.line}>
        <Animated.View style={chipStyle}>
          <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: ink }, ringStyle]} />
          <View style={[styles.chip, bar.level > 0 && { backgroundColor: alpha(LEVEL_FILL[bar.level][1], 0.22) }]} testID="storm-run-combo">
            <Bolt size={13} color={ink} strokeWidth={2} fill={bar.level > 0 ? ink : 'none'} />
            <AppText variant="captionStrong" color={ink} style={styles.comboText}>
              {t('storm.run.combo', { n: combo })}
            </AppText>
            <View style={styles.pips}>
              {Array.from({ length: STORM_MAX_LEVEL }, (_, i) => (
                <View key={i} style={[styles.pip, i < bar.level && { backgroundColor: ink }]} />
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]}>
          <LinearGradient colors={LEVEL_FILL[bar.level]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      </View>
      {timed ? (
        <AppText variant="caption" color={bar.level > 0 ? ink : eos.ash} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.caption} testID="storm-run-combo-line">
          {line}
        </AppText>
      ) : null}
    </View>
  );
});

/** Who is to move, at a glance: the king on a square-coloured disc, then the words. */
export function SideToMove({ color, pieceSet }: { color: 'w' | 'b'; pieceSet: AppPieceSet }) {
  const t = useT();
  return (
    <View style={styles.side} testID={`storm-run-side-${color}`}>
      <View style={[styles.disc, { backgroundColor: color === 'w' ? board.light : board.dark }]}>
        <Image source={PIECE_IMAGES[pieceSet][color === 'w' ? 'wK' : 'bK']} style={styles.king} contentFit="contain" transition={null} />
      </View>
      <AppText variant="bodyStrong" color={color === 'w' ? eos.bone : eos.ash}>
        {t(color === 'w' ? 'storm.run.white' : 'storm.run.black')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { marginTop: space[1] },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    height: 26,
    paddingHorizontal: 9,
    borderRadius: radii.full,
    backgroundColor: alpha(eos.ember, 0.2),
  },
  ring: { ...StyleSheet.absoluteFill, borderRadius: radii.full, borderWidth: 2 },
  comboText: { fontVariant: ['tabular-nums'] },
  pips: { flexDirection: 'row', gap: 3, marginLeft: 2 },
  pip: { width: 5, height: 5, borderRadius: radii.full, backgroundColor: alpha(eos.bone, 0.18) },
  track: { height: 6, marginTop: space[2], borderRadius: radii.full, backgroundColor: eos.rise, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.full, overflow: 'hidden' },
  glow: { ...StyleSheet.absoluteFill, borderRadius: radii.full, backgroundColor: alpha(tone.blush, 0.35) },
  side: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  disc: { width: 26, height: 26, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  king: { width: 22, height: 22 },
});
