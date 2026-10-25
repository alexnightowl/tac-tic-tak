import { countTo } from '@tac/core/tokens';
import { useEffect } from 'react';
import { StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText, textStyle, useLang, type TextVariantName } from '@/ui';
import { E2E } from './E2EStrip';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * web CountTo: an integer counting from → to with an ease-out cubic,
 * 900 ms after a 350 ms delay (the card lands first). Runs on the UI
 * thread (a read-only TextInput fed `text`, like the slider readout), so
 * the summary never re-renders per frame. Reduced motion: jumps to `to`.
 */
export function CountTo({
  from,
  to,
  variant = 'caption',
  color,
  style,
  testID,
  delay = countTo.delay,
  duration = countTo.duration,
  linear = false,
}: {
  from: number;
  to: number;
  delay?: number;
  duration?: number;
  /** RankCeremony's counter is linear (14 even steps on the web). */
  linear?: boolean;
  variant?: TextVariantName;
  color?: string;
  style?: TextStyle;
  testID?: string;
}) {
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? to : from);
  useEffect(() => {
    if (reduced) {
      v.set(to);
      return;
    }
    v.set(from);
    v.set(withDelay(delay, withTiming(to, { duration, easing: linear ? Easing.linear : Easing.out(Easing.cubic) })));
  }, [v, from, to, reduced, delay, duration, linear]);
  const props = useAnimatedProps(() => {
    const s = String(Math.round(v.get()));
    return { text: s, defaultValue: s } as object;
  });
  // The native text changes under Yoga's feet: reserve the widest value.
  const base = textStyle(variant, lang);
  const digits = Math.max(String(Math.round(from)).length, String(Math.round(to)).length);
  const minWidth = Math.ceil(digits * (base.fontSize ?? 12) * 0.62) + 2;
  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      animatedProps={props}
      testID={testID}
      accessibilityLabel={String(to)}
      style={[base, styles.input, { minWidth }, color ? { color } : null, style]}
    />
  );
}

/**
 * web FillCount: an i18n string with one {token} replaced by a counting
 * number. The whole sentence is one read-only multiline TextInput fed
 * from the worklet, so it wraps like text and still never re-renders.
 */
export function FillCount({
  text,
  token,
  from,
  to,
  color,
  testID,
}: {
  text: string;
  token: string;
  from: number;
  to: number;
  color: string;
  testID?: string;
}) {
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const i = text.indexOf(token);
  const before = i < 0 ? text : text.slice(0, i);
  const after = i < 0 ? '' : text.slice(i + token.length);
  const v = useSharedValue(reduced ? to : from);
  useEffect(() => {
    if (reduced || i < 0) {
      v.set(to);
      return;
    }
    v.set(from);
    v.set(withDelay(countTo.delay, withTiming(to, { duration: countTo.duration, easing: Easing.out(Easing.cubic) })));
  }, [v, from, to, reduced, i]);
  const props = useAnimatedProps(() => {
    const s = i < 0 ? before : `${before}${Math.round(v.get())}${after}`;
    return { text: s, defaultValue: s } as object;
  });
  if (i < 0) {
    return (
      <AppText variant="caption" color={color}>
        {text}
      </AppText>
    );
  }
  return (
    <View>
      <AnimatedTextInput
        editable={false}
        multiline
        scrollEnabled={false}
        pointerEvents="none"
        animatedProps={props}
        // Laid out with the final sentence; the count only shortens it.
        defaultValue={`${before}${to}${after}`}
        accessibilityLabel={`${before}${to}${after}`}
        style={[textStyle('caption', lang), styles.input, styles.sentence, { color }]}
      />
      {/* Test-build only: VoiceOver would read the number twice. */}
      {testID && E2E ? (
        <View style={styles.probe} pointerEvents="none">
          <CountTo from={from} to={to} color={color} testID={testID} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { padding: 0, margin: 0, fontVariant: ['tabular-nums'] },
  sentence: { paddingTop: 0, paddingBottom: 0 },
  // The number alone for Maestro (summary-reward / summary-new-norm), unseen.
  probe: { position: 'absolute', opacity: 0.02, left: 0, top: 0 },
});
