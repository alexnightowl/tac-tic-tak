import { alpha, easing, eos, hasteMotion, radii, space, tone } from '@tac/core/tokens';
import { Gauge } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { STRONG } from '@/features/play/ui';
import { AppText } from '@/ui';
import { useLang, useT } from '@/ui/lang';
import { fmtSecs } from './model';

const ease = Easing.bezier(...easing.easeOut);

/**
 * The runner's one-time "slow down" nudge (D40): after the second hasty
 * mistake in a row, a quiet gold pill for ~3 s. Non-blocking (no touches)
 * and shown only while it is fresh: a restored session never replays it.
 */
export function HasteNudge({
  nudge,
  style,
  render,
}: {
  nudge: { mistakeMs: number; at: number } | null;
  style?: StyleProp<ViewStyle>;
  /** The desktop panel card in place of the phone pill (same timing and fade). */
  render?: (mistakeMs: number) => ReactNode;
}) {
  // `at` 0 = shown before a restore: never again. Each nudge hides itself
  // nudgeMs after it was raised.
  const at = nudge?.at ?? 0;
  const [hiddenAt, setHiddenAt] = useState(0);
  const visible = at > 0 && hiddenAt !== at;

  useEffect(() => {
    if (!visible) return;
    const left = Math.max(0, hasteMotion.nudgeMs - (Date.now() - at));
    const id = setTimeout(() => setHiddenAt(at), left);
    return () => clearTimeout(id);
  }, [visible, at]);

  if (!visible || !nudge) return null;
  return (
    <Fade style={style}>{render ? render(nudge.mistakeMs) : <Pill mistakeMs={nudge.mistakeMs} />}</Fade>
  );
}

function Fade({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    const f = hasteMotion.fadeMs;
    o.set(
      withSequence(
        withTiming(1, { duration: f, easing: ease }),
        withDelay(hasteMotion.nudgeMs - 2 * f, withTiming(0, { duration: f, easing: ease })),
      ),
    );
  }, [o, reduced]);
  const fade = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: (1 - o.get()) * -6 }] }));
  return (
    <Animated.View style={[fade, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

function Pill({ mistakeMs }: { mistakeMs: number }) {
  const t = useT();
  const { lang } = useLang();
  const text = t('haste.nudge', { secs: fmtSecs(mistakeMs, lang, t) });
  return (
    <View style={styles.wrap}>
      <View style={styles.pill} testID="haste-nudge" accessible accessibilityRole="alert" accessibilityLabel={`${text}. ${t('haste.nudge_hint')}`}>
        <Gauge size={16} color={tone.gold} strokeWidth={2} />
        <View style={styles.flex}>
          <AppText variant="body" color={eos.bone} numberOfLines={1} style={STRONG}>
            {text}
          </AppText>
          <AppText variant="caption" color={eos.ash} numberOfLines={1}>
            {t('haste.nudge_hint')}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  flex: { flexShrink: 1, minWidth: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2.5],
    maxWidth: '100%',
    paddingVertical: space[2],
    paddingHorizontal: space[3.5],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: alpha(tone.gold, 0.45),
    backgroundColor: eos.ink,
    boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: 18, spreadDistance: 0, color: alpha(eos.ink, 0.5) }],
  },
});
