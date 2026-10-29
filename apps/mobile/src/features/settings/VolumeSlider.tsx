import { control, eos, radii, shadows, space } from '@tac/core/tokens';
import { useEffect } from 'react';
import { StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { feel } from '@/feel';
import { textStyle } from '@/ui/AppText';
import { useLang } from '@/ui/lang';

const AnimatedInput = Animated.createAnimatedComponent(TextInput);

const THUMB = 24;
const TICKS = 10;

/**
 * 0..1 volume slider (web <input type=range>). Drag and tap run on the UI
 * thread: thumb, fill and the % readout are SharedValue-driven, a
 * selection tick fires at every 10 % step, and React only hears the value
 * once, on release, which saves it and plays a preview (PLAN Phase 9).
 */
export function VolumeSlider({
  value,
  onCommit,
  testID,
  accessibilityLabel,
}: {
  value: number;
  onCommit: (v: number) => void;
  testID: string;
  accessibilityLabel: string;
}) {
  const { lang } = useLang();
  const v = useSharedValue(value);
  const w = useSharedValue(0);
  const step = useSharedValue(Math.round(value * TICKS));

  // Follow outside changes (another screen, a reset).
  useEffect(() => {
    v.set(value);
    step.set(Math.round(value * TICKS));
  }, [value, v, step]);

  const setFromX = (x: number) => {
    'worklet';
    const width = w.get();
    if (width <= 0) return;
    const next = Math.min(1, Math.max(0, Math.round(((x - THUMB / 2) / width) * 100) / 100));
    v.set(next);
    const s = Math.round(next * TICKS);
    if (s !== step.get()) {
      step.set(s);
      scheduleOnRN(feel.emit, 'sliderTick');
    }
  };

  const commit = () => {
    'worklet';
    scheduleOnRN(onCommit, v.get());
  };

  const pan = usePanGesture({
    activeOffsetX: [-4, 4],
    failOffsetY: [-12, 12],
    onActivate: (e) => {
      'worklet';
      setFromX(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      setFromX(e.x);
    },
    onDeactivate: () => {
      'worklet';
      commit();
    },
  });
  const tap = useTapGesture({
    onActivate: (e) => {
      'worklet';
      setFromX(e.x);
      commit();
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const fill = useAnimatedStyle(() => ({ width: v.value * w.value }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: v.value * w.value }] }));
  const readout = useAnimatedProps(() => {
    const s = `${Math.round(v.value * 100)}%`;
    return { text: s, defaultValue: s } as object;
  });

  const nudge = (d: number) => {
    const next = Math.min(1, Math.max(0, Math.round((v.get() + d) * 10) / 10));
    v.set(next);
    step.set(Math.round(next * TICKS));
    feel.emit('sliderTick');
    onCommit(next);
  };

  return (
    <View style={styles.row}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.hit}
          testID={testID}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)}
          onLayout={(e: LayoutChangeEvent) => w.set(Math.max(0, e.nativeEvent.layout.width - THUMB))}
        >
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fill]} />
          </View>
          <View style={styles.ticks} pointerEvents="none">
            {Array.from({ length: TICKS + 1 }, (_, i) => (
              <View key={i} style={[styles.tick, (i === 0 || i === TICKS) && styles.tickEnd]} />
            ))}
          </View>
          <Animated.View style={[styles.thumb, thumb]} />
        </View>
      </GestureDetector>
      <AnimatedInput
        editable={false}
        pointerEvents="none"
        animatedProps={readout}
        defaultValue={`${Math.round(value * 100)}%`}
        style={[textStyle('segmented', lang), styles.readout]}
        testID={`${testID}-value`}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  hit: { flex: 1, height: 44, justifyContent: 'center' },
  track: {
    height: 6,
    marginHorizontal: THUMB / 2,
    borderRadius: radii.full,
    backgroundColor: eos.well,
    boxShadow: [...shadows.well],
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: control.toggleOn, borderRadius: radii.full },
  ticks: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: THUMB / 2 - 0.5,
    // Design: the tick row starts 32 pt down the 44 pt slider (under the track).
    top: 32,
    bottom: 0,
  },
  tick: { width: 1, height: 4, backgroundColor: eos.seam },
  tickEnd: { height: 6 },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: radii.full,
    backgroundColor: control.toggleThumb,
    boxShadow: [...shadows.toggleThumb],
  },
  readout: { width: 48, textAlign: 'right', color: eos.bone, fontVariant: ['tabular-nums'], padding: 0 },
});
