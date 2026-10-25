import type { ReactNode } from 'react';
import type { AccessibilityRole, AccessibilityState, Insets, StyleProp, ViewStyle } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, { withTiming, type SharedValue, type WithTimingConfig } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { feel, type FeelEvent } from '@/feel';

export type TapProps = {
  testID: string;
  accessibilityLabel: string;
  accessibilityRole: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  onPress?: () => void;
  /** Driven 0 → 1 on touch-down and back on release, on the UI thread. */
  pressed?: SharedValue<number>;
  pressedTiming?: WithTimingConfig;
  /** Feel event fired on touch-down. */
  pressFeel?: FeelEvent;
  disabled?: boolean;
  hitSlop?: Insets;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Press target on an RNGH 3 tap gesture instead of RN Pressable. Pressable
 * keeps its pressed flag in React state (two commits per tap); here press
 * feedback runs entirely in UI-thread worklets and JS only hears the
 * recognised tap. Screen readers activate through accessibilityActions.
 */
export function Tap({
  testID,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  onPress,
  pressed,
  pressedTiming,
  pressFeel,
  disabled = false,
  hitSlop,
  style,
  children,
}: TapProps) {
  const tap = useTapGesture({
    enabled: !disabled,
    hitSlop,
    shouldCancelWhenOutside: true,
    // A held button still fires on release, as UIKit buttons do.
    maxDuration: 60_000,
    onBegin: () => {
      'worklet';
      pressed?.set(pressedTiming ? withTiming(1, pressedTiming) : 1);
      if (pressFeel) scheduleOnRN(feel.emit, pressFeel);
    },
    onActivate: () => {
      'worklet';
      if (onPress) scheduleOnRN(onPress);
    },
    onFinalize: () => {
      'worklet';
      pressed?.set(pressedTiming ? withTiming(0, pressedTiming) : 0);
    },
  });

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        testID={testID}
        accessible
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, ...accessibilityState }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'activate' && !disabled) onPress?.();
        }}
        style={style}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
