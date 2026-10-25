import { streakState } from '@tac/core/format';
import { eos, keyframeStops, keyframes, rank, space, text } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { StreakBadge } from '@/features/social/StreakBadge';
import { useAppStore } from '@/stores/appStore';
import { AppText } from '@/ui';
import type { TFn } from '@/ui/lang';
import { Tap } from '@/ui/Tap';

/**
 * Home header streak (web dashboard): the flame + count with the state
 * caption, breathing while at risk (web .streak-pulse; static under
 * reduced motion). Tapping opens the streak sheet. 'broken' keeps the
 * stale count with no caption, the web's deliberate honesty.
 */
export function HomeStreak({ t }: { t: TFn }) {
  const streak = useAppStore((s) => s.streak);
  const show = useAppStore((s) => s.settings.showStreak);
  const st = streakState(streak.days, streak.lastDay);
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  const pulse = st === 'at_risk' && !reduced;
  useEffect(() => {
    if (!pulse) {
      o.set(1);
      return;
    }
    const k = keyframes.streakBreath;
    const half = k.duration / 2;
    const e = Easing.bezier(...k.easing);
    const low = keyframeStops.streakBreathOpacity[1][1];
    o.set(withRepeat(withSequence(withTiming(low, { duration: half, easing: e }), withTiming(1, { duration: half, easing: e })), -1));
    return () => cancelAnimation(o);
  }, [o, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  if (!show || streak.days <= 0) return null;
  const caption = st === 'at_risk' ? t('streak.at_risk') : st === 'secured' ? t('streak.secured') : null;
  return (
    <Tap
      testID="home-streak"
      accessibilityRole="button"
      accessibilityLabel={`${t('home.open_streak')}: ${streak.days}${caption ? `, ${caption}` : ''}`}
      onPress={() => router.push('/streak' as Href)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.root}
    >
      <Animated.View style={style}>
        <StreakBadge days={streak.days} state={st} testID={`home-streak-${st}`} />
      </Animated.View>
      {caption ? (
        <AppText variant="caption" color={st === 'at_risk' ? rank.intermediate.color : eos.dust} style={styles.caption}>
          {caption}
        </AppText>
      ) : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'flex-end', gap: space[0.5], marginTop: space[1.5], flexShrink: 0, maxWidth: space[20] + space[14] },
  // web text-[10px].
  caption: { fontSize: text.label.fontSize - 1, lineHeight: text.label.fontSize + 1, textAlign: 'right' },
});
