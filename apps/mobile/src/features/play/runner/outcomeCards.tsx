import { UNLOCK_REWARD, type CriterionId } from '@tac/core/rules';
import { formatCriterion, type DemoteOutcome as Demote, type FinishResponse } from '@tac/core/runner';
import { alpha, countTo, easing, eos, keyframes, keyframeStops, radii, rank, space, tone, transitions } from '@tac/core/tokens';
import { Check, Snowflake, Sparkles, TrendingDown, X } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { feel } from '@/feel';
import { AppText } from '@/ui';
import type { PlayT } from '../strings';
import { FlameGlyph, NoteCard, STRONG, TABULAR, TONE } from '../ui';
import { FillCount } from './CountTo';

// Summary outcome cards (web EarlyExitNote, LevelUpExplainer,
// ComfortSessionNote, UnlockOutcome + CriterionRow, DemoteOutcome) and the
// streak outcome chip (mobile-only micro-celebration). The rise / drop
// keyframes (globals.css norm-*) run on the UI thread and are skipped
// under reduced motion, as on the web.

/** Streak chip pop: under-damped on purpose (a small celebration). */
const CHIP_SPRING = { damping: 9, stiffness: 220 };

const bez = (b: readonly [number, number, number, number]) => Easing.bezier(b[0], b[1], b[2], b[3]);

function Title({ children, color = eos.bone, testID }: { children: string; color?: string; testID?: string }) {
  return (
    <AppText variant="body" color={color} style={STRONG} testID={testID}>
      {children}
    </AppText>
  );
}

export function EarlyExitNote({ t }: { t: PlayT }) {
  return (
    <NoteCard testID="summary-early">
      <Title>{t('play.early_exit_title')}</Title>
      <AppText variant="caption">{t('play.early_exit_hint')}</AppText>
    </NoteCard>
  );
}

export function ComfortSessionNote({ floor, t }: { floor: number; t: PlayT }) {
  return (
    <NoteCard testID="summary-comfort">
      <Title>{t('play.comfort_summary_title')}</Title>
      <AppText variant="caption">{t('play.comfort_summary_hint', { floor })}</AppText>
    </NoteCard>
  );
}

export function LevelUpExplainer({ ceiling, floor, t }: { ceiling: number; floor: number; t: PlayT }) {
  return (
    <NoteCard tone="accent" testID="summary-levelup-explainer">
      <View style={styles.row}>
        <Sparkles size={18} color={TONE.accent.ink} />
        <Title color={TONE.accent.ink}>{t('calibration.complete_title')}</Title>
      </View>
      <AppText variant="body" color={eos.bone}>
        {t('calibration.complete_summary', { ceiling })}
      </AppText>
      <View style={styles.bullets}>
        <AppText variant="caption" color={eos.ash}>
          <AppText variant="caption" color={eos.sage} style={STRONG}>
            {`+${UNLOCK_REWARD} `}
          </AppText>
          {t('calibration.intro_unlock', { floor })}
        </AppText>
        <AppText variant="caption" color={eos.ash}>
          <AppText variant="caption" color={eos.rose} style={STRONG}>
            {'−25 '}
          </AppText>
          {t('calibration.intro_demote')}
        </AppText>
      </View>
    </NoteCard>
  );
}

/** web .norm-rise: scale .92 → 1, y 10 → 0, fade in; icon spins in after 200 ms. */
function Rise({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  const ip = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    const k = keyframes.normRise;
    p.set(withTiming(1, { duration: k.duration, easing: bez(k.easing) }));
    const ik = keyframes.normIconRise;
    ip.set(withDelay(ik.delay ?? 0, withTiming(1, { duration: ik.duration, easing: bez(ik.easing) })));
    // FEEL_TABLE normRise: Success at 360 ms, with the card's glow peak.
    feel.emit('normRise');
  }, [p, ip, reduced]);
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get() * 2.5),
    transform: [{ translateY: (1 - p.get()) * 10 }, { scale: 0.92 + 0.08 * p.get() }],
  }));
  const ic = useAnimatedStyle(() => ({
    transform: [{ scale: 0.3 + 0.7 * ip.get() }, { rotate: `${-90 * (1 - ip.get())}deg` }],
  }));
  return (
    <Animated.View style={card}>
      <NoteCard tone="accent" style={[styles.rowCard, styles.unlockGlow]} testID="summary-unlocked">
        <Animated.View style={ic}>{icon}</Animated.View>
        <View style={styles.flex}>{children}</View>
      </NoteCard>
    </Animated.View>
  );
}

/** web .norm-drop: falls from y −14, a horizontal shake, then rest; icon drops after 250 ms. */
function Drop({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  const reduced = useReducedMotion();
  const y = useSharedValue<number>(reduced ? 0 : -14);
  const x = useSharedValue(0);
  const o = useSharedValue(reduced ? 1 : 0);
  const iy = useSharedValue<number>(reduced ? 0 : -10);
  useEffect(() => {
    if (reduced) return;
    const k = keyframes.normDrop;
    const e = bez(k.easing);
    const seq = (stops: readonly (readonly [number, number])[]) =>
      withSequence(...stops.slice(1).map((s, i) => withTiming(s[1], { duration: (s[0] - stops[i][0]) * k.duration, easing: e })));
    y.set(seq(keyframeStops.normDropY));
    x.set(seq(keyframeStops.normDropX));
    o.set(withTiming(1, { duration: k.duration * 0.3, easing: e }));
    const ik = keyframes.normIconDrop;
    iy.set(withDelay(ik.delay ?? 0, withTiming(0, { duration: ik.duration, easing: bez(ik.easing) })));
  }, [x, y, o, iy, reduced]);
  const card = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: y.get() }, { translateX: x.get() }] }));
  const ic = useAnimatedStyle(() => ({ transform: [{ translateY: iy.get() }] }));
  return (
    <Animated.View style={card}>
      <NoteCard tone="rose" style={styles.rowCard} testID="summary-demoted">
        <Animated.View style={ic}>{icon}</Animated.View>
        <View style={styles.flex}>{children}</View>
      </NoteCard>
    </Animated.View>
  );
}

export function UnlockOutcome({
  unlocked,
  criteria,
  t,
}: {
  unlocked: boolean;
  criteria: NonNullable<FinishResponse['unlockCheck']>['criteria'];
  t: PlayT;
}) {
  if (unlocked) {
    return (
      <Rise icon={<Sparkles size={24} color={TONE.accent.ink} />}>
        <Title color={TONE.accent.ink}>{t('unlock.summary_success')}</Title>
        <FillCount text={t('unlock.summary_success_hint')} token="{reward}" from={0} to={UNLOCK_REWARD} color={eos.ash} testID="summary-reward" />
      </Rise>
    );
  }
  return (
    <NoteCard testID="summary-near">
      <Title>{t('unlock.summary_near')}</Title>
      <AppText variant="caption">{t('unlock.summary_near_hint')}</AppText>
      <View style={styles.criteria}>
        {criteria.map((c) => (
          <CriterionRow key={c.id} c={c} t={t} />
        ))}
      </View>
    </NoteCard>
  );
}

function CriterionRow({ c, t }: { c: { id: CriterionId | string; met: boolean; current: number; target: number }; t: PlayT }) {
  const f = formatCriterion(c);
  const label = t(`unlock.req_${c.id}`);
  return (
    <View
      style={styles.criterion}
      testID={`summary-criterion-${c.id}`}
      accessible
      accessibilityLabel={`${label}: ${f.current} / ${f.target}`}
    >
      {c.met ? <Check size={14} color={eos.sage} /> : <X size={14} color={eos.rose} />}
      <AppText variant="caption" color={eos.ash} style={styles.flex}>
        {label}
      </AppText>
      <AppText variant="caption" color={c.met ? eos.sage : eos.ash} style={TABULAR}>
        {f.current}
        <AppText variant="caption" color={eos.dust}>{` / ${f.target}`}</AppText>
      </AppText>
    </View>
  );
}

export function DemoteOutcomeCard({ demote, t }: { demote: Demote; t: PlayT }) {
  if (demote.kind === 'demoted') {
    return (
      <Drop icon={<TrendingDown size={22} color={eos.rose} />}>
        <Title color={eos.rose}>{t('demote.summary_demoted', { penalty: demote.penalty })}</Title>
        <FillCount
          text={t('demote.summary_demoted_hint')}
          token="{ceiling}"
          from={demote.ceilingFrom}
          to={demote.ceilingTo}
          color={eos.ash}
          testID="summary-new-norm"
        />
      </Drop>
    );
  }
  // At peak, weak, the streak not yet over the threshold: guidance, not punishment.
  return (
    <NoteCard tone="amber" style={styles.rowCard} testID="summary-weak">
      <TrendingDown size={20} color={rank.intermediate.color} />
      <View style={styles.flex}>
        <Title color={rank.intermediate.color}>{t('demote.summary_weak')}</Title>
        <AppText variant="caption" color={eos.ash}>
          {t('demote.summary_weak_hint', { remaining: demote.remaining })}
        </AppText>
      </View>
    </NoteCard>
  );
}

type StreakOutcome = NonNullable<FinishResponse['streak']>;

/**
 * Mobile-only: the daily streak's outcome on the summary (web had none).
 * Extended / started pops in with the streakUp haptic; frozen explains
 * itself (the controller also toasts it); reset is a quiet warning.
 */
export function StreakOutcomeChip({ streak, t }: { streak: StreakOutcome; t: PlayT }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.6);
  const o = useSharedValue(reduced ? 1 : 0);
  const kind = streak.outcome;
  useEffect(() => {
    if (kind === 'continued' || kind === 'started') feel.emit('streakUp', { streak: Math.max(2, streak.days) });
    else if (kind === 'reset') feel.emit('streakBroken');
    if (reduced) return;
    // After the outcome card lands (CountTo's delay), a springy pop.
    s.set(withDelay(countTo.delay, withSpring(1, CHIP_SPRING)));
    o.set(withDelay(countTo.delay, withTiming(1, { duration: transitions.toggle.duration, easing: bez(easing.easeOut) })));
  }, [kind, streak.days, reduced, s, o]);
  const pop = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));
  if (kind !== 'continued' && kind !== 'started' && kind !== 'frozen' && kind !== 'reset') return null;
  const label =
    kind === 'continued'
      ? t('streak.outcome_continued')
      : kind === 'started'
        ? t('streak.outcome_started')
        : kind === 'frozen'
          ? t('streak.outcome_frozen')
          : t('streak.outcome_reset');
  const chipTone = kind === 'reset' ? TONE.neutral : kind === 'frozen' ? TONE.sage : TONE.amber;
  const ink = kind === 'reset' ? eos.ash : chipTone.ink;
  return (
    <Animated.View style={[styles.chipWrap, pop]}>
      <View
        style={[styles.chip, { backgroundColor: chipTone.bg, borderColor: chipTone.border }]}
        testID={`summary-streak-${kind}`}
        accessible
        accessibilityLabel={`${label}: ${streak.days}`}
      >
        {kind === 'frozen' ? <Snowflake size={16} color={ink} /> : <FlameGlyph size={16} color={ink} />}
        <AppText variant="body" color={ink} style={[STRONG, TABULAR]} testID="summary-streak-days">
          {String(streak.days)}
        </AppText>
        <AppText variant="caption" color={eos.ash}>
          {label}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  // Design: the level-up card keeps a gold halo (0 0 22px 2px gold/25).
  unlockGlow: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 22, spreadDistance: 2, color: alpha(tone.gold, 0.25) }] },
  flex: { flex: 1, minWidth: 0, gap: space[0.5] },
  bullets: { gap: space[1], paddingTop: space[1] },
  criteria: { gap: space[1.5], marginTop: space[2] },
  criterion: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  chipWrap: { alignSelf: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3.5],
    paddingVertical: space[2],
    borderRadius: radii.full,
    borderWidth: 1,
  },
});
