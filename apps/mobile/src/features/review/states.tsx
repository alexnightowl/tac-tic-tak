import { eos, layout, radii, space, surface } from '@tac/core/tokens';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { AppText, PlateButton } from '@/ui';
import { skeletonTiming } from './motion';

// Loading / empty / error states shared by the review and history screens
// (PLAN §2.5 lists Skeleton, EmptyState and ErrorState as primitives; they
// live here until src/ui grows them).

/** A breathing placeholder block; static under reduced motion. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const k = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    k.set(withRepeat(withTiming(1, skeletonTiming), -1, true));
  }, [k, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * k.get() }));
  return <Animated.View style={[styles.skeleton, style, anim]} />;
}

export function StateView({
  testID,
  icon,
  title,
  body,
  action,
  style,
}: {
  testID: string;
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; testID: string; variant?: 'ember' | 'slate' };
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.state, style]} testID={testID}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <AppText variant="title" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color={eos.ash} style={styles.center}>
          {body}
        </AppText>
      ) : null}
      {action ? (
        <PlateButton
          label={action.label}
          testID={action.testID}
          onPress={action.onPress}
          variant={action.variant ?? 'slate'}
          size="md"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: surface.card, borderRadius: radii['2xl'], borderWidth: 1, borderColor: surface.cardBorder },
  state: { alignItems: 'center', justifyContent: 'center', gap: space[3], padding: layout.gutter, paddingVertical: space[10] },
  icon: {
    width: space[14],
    height: space[14],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.card,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  center: { textAlign: 'center' },
  action: { marginTop: space[2] },
});
