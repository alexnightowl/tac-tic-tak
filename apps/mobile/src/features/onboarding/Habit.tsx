import { alpha, black, eos, graphite, radii, tone, white } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { FLAME_PATH } from '@/features/home/StreakSheet';
import { AppText } from '@/ui/AppText';
import { TintIcon } from '@/ui/IconTile';
import { HABIT, ease, kf, useTrack } from './motion';
import { HEAVY, RadialDisc } from './parts';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const REVIEW = require('../../../assets/icons/nav-review-book.webp');

const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';
const FREEZE_DAY_PATH = 'M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2';
const FREEZE_NOTE_PATH = 'M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5';

const HEAT_STOPS = [
  [0, alpha(tone.flame, 0.45)],
  [0.68, alpha(eos.ink, 0)],
] as const;

type DayKind = 'done' | 'freeze' | 'today' | 'empty';
const WEEK: readonly DayKind[] = ['done', 'done', 'freeze', 'done', 'today', 'empty', 'empty'];
const LETTER: Record<DayKind, string> = { done: eos.ash, freeze: tone.sky, today: eos.bone, empty: graphite[600] };

export type HabitCopy = {
  days: string;
  unit: string;
  best: string;
  weekdays: readonly string[];
  freezeNote: string;
  reviewTitle: string;
  reviewBody: string;
  reviewCount: string;
};

/**
 * MobOnboarding4: a sample streak card (flame flickering in its heat glow,
 * the week's discs popping in with their checks drawn, Friday pulsing) and
 * the "missed puzzles come back" card. Sample values from the canvas, not
 * the user's data (a fresh account has none yet).
 */
export function HabitArt({ copy }: { copy: HabitCopy }) {
  return (
    <View style={styles.col} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <CardIn delay={HABIT.cardIn.delays[0]} style={styles.streakShadow}>
        <View style={styles.streakCard}>
          <LinearGradient colors={[tone.warmTop, tone.warmBottom]} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.ring} />
          <View style={styles.streakRow}>
            <Flame />
            <View style={styles.flex}>
              <View style={styles.countRow}>
                <AppText variant="display" lang="en" style={styles.count}>
                  {copy.days}
                </AppText>
                <AppText variant="bodyStrong" style={styles.unit}>
                  {copy.unit}
                </AppText>
              </View>
              <AppText variant="body" color={eos.ash} style={styles.best}>
                {copy.best}
              </AppText>
            </View>
          </View>
          <View style={styles.rule} />
          <View style={styles.week}>
            {WEEK.map((kind, i) => (
              <Day key={i} kind={kind} letter={copy.weekdays[i] ?? ''} index={i} />
            ))}
          </View>
          <View style={styles.note}>
            <Glyph d={FREEZE_NOTE_PATH} size={13} color={tone.sky} width={2} />
            <AppText variant="caption" color={tone.sky} style={styles.noteText}>
              {copy.freezeNote}
            </AppText>
          </View>
        </View>
      </CardIn>
      <CardIn delay={HABIT.cardIn.delays[1]} style={styles.reviewCard}>
        <View style={styles.tile}>
          <TintIcon source={REVIEW} size={20} width={22} color={tone.rose} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{copy.reviewTitle}</AppText>
          <AppText variant="caption" color={eos.ash} style={styles.reviewBody}>
            {copy.reviewBody}
          </AppText>
        </View>
        <View style={styles.badge}>
          <AppText variant="bodyStrong" color={tone.roseSoft} style={styles.badgeText}>
            {copy.reviewCount}
          </AppText>
        </View>
      </CardIn>
    </View>
  );
}

/** `cardIn`: fade up 12 pt, 0.7 s soft ease-out. */
function CardIn({ delay, style, children }: { delay: number; style: object; children: ReactNode }) {
  const p = useTrack({ duration: HABIT.cardIn.duration, delay });
  const a = useAnimatedStyle(() => {
    const e = ease.outSoft(p.get());
    return { opacity: e, transform: [{ translateY: 12 * (1 - e) }] };
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** 64 pt flame flickering (origin 50 % 90 %) inside a 108 pt heat glow. */
function Flame() {
  const heat = useTrack(HABIT.heat, 0.5);
  const flick = useTrack(HABIT.flick, 0);
  const heatStyle = useAnimatedStyle(() => ({
    opacity: kf(heat.get(), [[0, 0.55], [0.5, 0.95], [1, 0.55]], ease.inOut),
    transform: [{ scale: kf(heat.get(), [[0, 0.95], [0.5, 1.1], [1, 0.95]], ease.inOut) }],
  }));
  const flickStyle = useAnimatedStyle(() => {
    const p = flick.get();
    return {
      transform: [
        { scaleX: kf(p, [[0, 1], [0.25, 1.03], [0.5, 0.98], [0.75, 1.02], [1, 1]], ease.inOut) },
        { scaleY: kf(p, [[0, 1], [0.25, 0.98], [0.5, 1.04], [0.75, 0.99], [1, 1]], ease.inOut) },
        { skewX: `${kf(p, [[0, 0], [0.25, -2], [0.5, 1.5], [0.75, -1], [1, 0]], ease.inOut)}deg` },
      ],
    };
  });
  return (
    <View style={styles.flameBox}>
      <Animated.View style={[styles.heat, heatStyle]}>
        <RadialDisc size={108} stops={HEAT_STOPS} />
      </Animated.View>
      <Animated.View style={[styles.flame, flickStyle]}>
        <Svg width={64} height={64} viewBox="0 0 24 24">
          <Path d={FLAME_PATH} fill={tone.flame} fillRule="evenodd" />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Day({ kind, letter, index }: { kind: DayKind; letter: string; index: number }) {
  const p = useTrack({ duration: HABIT.dayIn.duration, delay: HABIT.dayIn.delays[index] });
  const inStyle = useAnimatedStyle(() => ({
    opacity: kf(p.get(), [[0, 0], [0.7, 1], [1, 1]], ease.outSoft),
    transform: [{ scale: kf(p.get(), [[0, 0.4], [0.7, 1.12], [1, 1]], ease.outSoft) }],
  }));
  const checkDelay = HABIT.check.delays[index];
  return (
    <View style={styles.day}>
      <AppText variant="label" color={LETTER[kind]} style={styles.letter}>
        {letter}
      </AppText>
      <View style={styles.discBox}>
        {kind === 'today' ? <TodayPulse /> : null}
        <Animated.View style={[styles.disc, DISC[kind], inStyle]}>
          {kind === 'freeze' ? <Glyph d={FREEZE_DAY_PATH} size={16} color={tone.sky} width={2} /> : null}
          {checkDelay != null ? <Check delay={checkDelay} /> : null}
        </Animated.View>
      </View>
    </View>
  );
}

/** Friday's `today` ring: 0 → 12 pt spread, flame/55 → 0, every 1.8 s. */
function TodayPulse() {
  const p = useTrack(HABIT.today, 1);
  const style = useAnimatedStyle(() => ({
    opacity: kf(p.get(), [[0, 0.55], [1, 0]], ease.out),
    transform: [{ scale: kf(p.get(), [[0, 1], [1, (34 + 24) / 34]], ease.out) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.disc, styles.pulse, style]} />;
}

/** The check stroke drawing itself (dash 21, .35 s ease-out). */
function Check({ delay }: { delay: number }) {
  const p = useTrack({ duration: HABIT.check.duration, delay });
  const props = useAnimatedProps(() => ({ strokeDashoffset: 21 * (1 - ease.out(p.get())) }));
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <AnimatedPath
        d={CHECK_PATH}
        fill="none"
        stroke={tone.onEmber}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[21, 21]}
        animatedProps={props}
      />
    </Svg>
  );
}

function Glyph({ d, size, color, width }: { d: string; size: number; color: string; width: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const inset = (y: number, color: string, spread = 0) => ({
  offsetX: 0,
  offsetY: y,
  blurRadius: 0,
  spreadDistance: spread,
  color,
  inset: true,
});

const DISC = StyleSheet.create({
  done: { backgroundColor: eos.ember, boxShadow: [inset(1, alpha(white, 0.18))] },
  freeze: { backgroundColor: alpha(tone.sky, 0.12), boxShadow: [inset(0, alpha(tone.sky, 0.7), 1.5)] },
  today: { backgroundColor: tone.flame, boxShadow: [inset(1, alpha(white, 0.22))] },
  empty: { boxShadow: [inset(0, eos.seam, 1.5)] },
});

const styles = StyleSheet.create({
  col: { width: '100%', gap: 14 },
  flex: { flex: 1, minWidth: 0 },
  // 0 18px 40px black/50 outside, a 1 px bone/6 % ring inside.
  streakShadow: { borderRadius: 16, boxShadow: [{ offsetX: 0, offsetY: 18, blurRadius: 40, spreadDistance: 0, color: alpha(black, 0.5) }] },
  streakCard: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  // inset 0 0 0 1px bone/6 %, drawn over the gradient (an inset shadow would sit under it).
  ring: { ...StyleSheet.absoluteFill, borderRadius: 16, borderWidth: 1, borderColor: alpha(white, 0.06) },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flameBox: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  heat: { position: 'absolute', left: -18, top: -18, width: 108, height: 108 },
  flame: { transformOrigin: '50% 90%' },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  count: { fontVariant: ['tabular-nums'] },
  // RN puts Cinzel's baseline (44 pt in a 46 pt line) ~7 pt above where the
  // browser does; this lands "day streak" where the canvas has it.
  unit: { fontSize: 15, lineHeight: 20, transform: [{ translateY: 7 }] },
  best: { marginTop: 2, fontSize: 13, lineHeight: 18 },
  rule: { marginTop: 20, height: 1, backgroundColor: alpha(white, 0.06) },
  week: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 8 },
  letter: { fontFamily: HEAVY, letterSpacing: 0.5, textTransform: 'none' },
  discBox: { width: 34, height: 34 },
  disc: { width: 34, height: 34, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', backgroundColor: tone.flame },
  note: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteText: { flex: 1 },
  reviewCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: eos.slate,
    boxShadow: [inset(0, alpha(white, 0.05), 1)],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tile: { width: 40, height: 40, borderRadius: 10, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  reviewBody: { marginTop: 2, lineHeight: 17 },
  badge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: alpha(eos.ember, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: HEAVY, fontSize: 13, lineHeight: 18 },
});
