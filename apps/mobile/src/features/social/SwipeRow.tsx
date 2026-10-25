import { control, eos, radii, space } from '@tac/core/tokens';
import { Check, X } from 'lucide-react-native';
import { useLayoutEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { feel } from '@/feel';
import { AppText } from '@/ui/AppText';
import { segmentedSpring } from '@/ui/motion';
import { barGrow } from '@/features/stats/motion';

/** Release past this share of the row commits the action. */
const COMMIT = 0.33;

type Props = {
  testID: string;
  acceptLabel: string;
  declineLabel: string;
  /** Resolve false to spring the row back (the request failed). */
  onAccept: () => Promise<boolean>;
  onDecline: () => Promise<boolean>;
  children: ReactNode;
};

/**
 * Incoming-request row (PLAN Phase 8): swipe right to accept, left to
 * decline, Mail-style. The drag lives on SharedValues; JS hears one tick
 * when the commit threshold is crossed and the action on release. The row
 * keeps explicit buttons too (VoiceOver, no-gesture users).
 */
export function SwipeRow({ testID, acceptLabel, declineLabel, onAccept, onDecline, children }: Props) {
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const armed = useSharedValue(0);
  // FlashList recycles this cell for the next request after one is swiped
  // away: without a reset the new row would mount still slid off-screen.
  useLayoutEffect(() => {
    x.set(0);
    armed.set(0);
  }, [testID, x, armed]);

  const tick = () => feel.emit('sliderDetent');
  const run = (kind: 'accept' | 'decline') => {
    void (kind === 'accept' ? onAccept() : onDecline()).then((ok) => {
      if (!ok) x.set(withSpring(0, segmentedSpring));
    });
  };

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      x.set(e.translationX);
      const th = width.get() * COMMIT;
      const side = e.translationX > th ? 1 : e.translationX < -th ? -1 : 0;
      if (side !== armed.get()) {
        armed.set(side);
        if (side !== 0) scheduleOnRN(tick);
      }
    },
    onDeactivate: () => {
      'worklet';
      const side = armed.get();
      armed.set(0);
      if (side === 0) {
        x.set(withSpring(0, segmentedSpring));
        return;
      }
      x.set(withTiming(side * width.get(), barGrow));
      scheduleOnRN(run, side > 0 ? 'accept' : 'decline');
    },
  });

  const card = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const accept = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, 24], [0, 1], 'clamp') }));
  const decline = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-24, 0], [1, 0], 'clamp') }));

  return (
    <View testID={testID} onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.under, styles.acceptBg, accept]}>
        <Check size={18} color={eos.ink} />
        <AppText variant="label" color={eos.ink}>
          {acceptLabel}
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.under, styles.declineBg, decline]}>
        <AppText variant="label" color={control.segmentedActiveText}>
          {declineLabel}
        </AppText>
        <X size={18} color={control.segmentedActiveText} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={card}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  under: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[5],
  },
  acceptBg: { backgroundColor: eos.sage, justifyContent: 'flex-start' },
  declineBg: { backgroundColor: eos.ember, justifyContent: 'flex-end' },
});
