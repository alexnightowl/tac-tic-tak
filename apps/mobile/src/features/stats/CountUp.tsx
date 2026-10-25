import type { Language } from '@tac/core/i18n';
import { useEffect } from 'react';
import { TextInput, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { countUp } from './motion';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Integer with the locale's group separator (en "1,234", uk "1 234"); Intl
 *  is not on the UI runtime, so the worklet groups by hand. */
export function groupInt(n: number, lang: Language): string {
  'worklet';
  const s = String(Math.round(Math.abs(n)));
  const sep = lang === 'uk' ? ' ' : ',';
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += sep;
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

/**
 * Lifetime numbers counting up (CountTo, ease-out cubic) on the UI thread: a
 * read-only TextInput fed `text`, so the count never re-renders the screen.
 * `suffix` rides along ("%"). Reduced motion shows the value at once.
 */
export function CountUp({
  value,
  lang,
  suffix = '',
  style,
  testID,
}: {
  value: number;
  lang: Language;
  suffix?: string;
  style: TextStyle | TextStyle[];
  testID: string;
}) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    v.set(reduced ? value : withTiming(value, countUp));
  }, [value, reduced, v]);
  const props = useAnimatedProps(() => {
    const s = `${groupInt(v.get(), lang)}${suffix}`;
    return { text: s, defaultValue: s } as object;
  });
  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      animatedProps={props}
      style={[{ padding: 0 }, style as TextStyle]}
      accessibilityLabel={`${groupInt(value, lang)}${suffix}`}
      testID={testID}
    />
  );
}
