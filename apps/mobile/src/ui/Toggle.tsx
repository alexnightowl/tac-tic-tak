import { control, layout, radii, shadows } from '@tac/core/tokens';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { feel } from '@/feel';
import { toggleTiming } from './motion';
import { Tap } from './Tap';

export type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID: string;
  accessibilityLabel: string;
};

const T = layout.toggle;

/**
 * Carved-well switch (RN Switch can't take the look). Two stacked tracks —
 * the well and the ember plate — so each keeps its own inset shadow and the
 * crossfade + thumb slide run on one SharedValue (200 ms ease-out, web).
 */
export function Toggle({ value, onChange, disabled = false, testID, accessibilityLabel }: ToggleProps) {
  const reduced = useReducedMotion();
  const on = useSharedValue(value ? 1 : 0);
  const target = useSharedValue(value ? 1 : 0);

  const set = (v: boolean) => {
    const to = v ? 1 : 0;
    if (target.get() === to) return;
    target.set(to);
    on.set(reduced ? to : withTiming(to, toggleTiming));
  };

  // Follow the controlled value (no-op when the press already moved it).
  useEffect(() => {
    set(value);
  });

  const ember = useAnimatedStyle(() => ({ opacity: on.value }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: on.value * T.travel }] }));

  return (
    <Tap
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      onPress={() => {
        set(!value);
        feel.emit('toggle');
        onChange(!value);
      }}
      style={[styles.root, disabled && styles.disabled]}
    >
      <View style={[styles.track, styles.well]} />
      <Animated.View style={[styles.track, styles.ember, ember]} />
      <Animated.View style={[styles.thumb, thumb]} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { width: T.width, height: T.height },
  disabled: { opacity: 0.5 },
  track: { ...StyleSheet.absoluteFill, borderRadius: radii.full },
  well: { backgroundColor: control.toggleOff, boxShadow: [...shadows.well] },
  ember: { backgroundColor: control.toggleOn, boxShadow: [...shadows.toggleOn] },
  thumb: {
    position: 'absolute',
    top: T.inset,
    left: T.inset,
    width: T.thumb,
    height: T.thumb,
    borderRadius: radii.full,
    backgroundColor: control.toggleThumb,
    boxShadow: [...shadows.toggleThumb],
  },
});
