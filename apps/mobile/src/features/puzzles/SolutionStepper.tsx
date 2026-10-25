import type { StepSource } from '@tac/core/runner';
import { eos, radii, semantic, space, surface } from '@tac/core/tokens';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  useLongPressGesture,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { TFn } from '@/ui/lang';
import { platePressTiming } from '@/ui/motion';

/** Hold this long before prev/next start repeating. */
const REPEAT_DELAY_MS = 350;
/** One ply per tick while held (each tick fires its own haptic). */
const REPEAT_EVERY_MS = 150;
/** A board swipe past this many points is one step. */
const SWIPE_STEP_PX = 40;

/**
 * The viewer's solution stepper (web Prev / Next + ← → keys): buttons
 * that auto-repeat on long-press, a scrubber strip with one tick per ply,
 * and the counter. Touch tracking stays on the UI thread; JS hears one
 * call per ply change.
 */
export function SolutionStepper({
  ply,
  maxPly,
  onStep,
  onSeek,
  t,
}: {
  ply: number;
  maxPly: number;
  onStep: (delta: number, source: StepSource) => void;
  onSeek: (ply: number) => void;
  t: TFn;
}) {
  return (
    <View style={styles.wrap} testID="viewer-stepper">
      <View style={styles.row}>
        <RepeatButton testID="viewer-prev" label={t('puzzle.prev')} disabled={ply <= 1} onStep={(src) => onStep(-1, src)}>
          <ChevronLeft size={22} color={eos.bone} />
        </RepeatButton>
        <Scrubber ply={ply} maxPly={maxPly} onSeek={onSeek} t={t} />
        <RepeatButton testID="viewer-next" label={t('puzzle.next')} disabled={ply >= maxPly} onStep={(src) => onStep(1, src)}>
          <ChevronRight size={22} color={eos.bone} />
        </RepeatButton>
      </View>
    </View>
  );
}

function RepeatButton({
  testID,
  label,
  disabled,
  onStep,
  children,
}: {
  testID: string;
  label: string;
  disabled: boolean;
  onStep: (source: StepSource) => void;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressed = useSharedValue(0);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const start = () => {
    stop();
    onStep('repeat');
    timer.current = setInterval(() => onStep('repeat'), REPEAT_EVERY_MS);
  };
  const tapStep = () => onStep('tap');
  useEffect(() => stop, []);

  const hold = useLongPressGesture({
    enabled: !disabled,
    minDuration: REPEAT_DELAY_MS,
    maxDistance: 40,
    onBegin: () => {
      'worklet';
      pressed.set(withTiming(1, platePressTiming));
    },
    onActivate: () => {
      'worklet';
      scheduleOnRN(start);
    },
    onFinalize: () => {
      'worklet';
      pressed.set(withTiming(0, platePressTiming));
      scheduleOnRN(stop);
    },
  });
  const tap = useTapGesture({
    enabled: !disabled,
    onActivate: () => {
      'worklet';
      scheduleOnRN(tapStep);
    },
  });
  const gesture = useExclusiveGestures(hold, tap);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.06 * pressed.get() }] }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={testID}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'activate' && !disabled) tapStep();
        }}
        style={[styles.btn, disabled && styles.disabled, anim]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function Scrubber({ ply, maxPly, onSeek, t }: { ply: number; maxPly: number; onSeek: (ply: number) => void; t: TFn }) {
  const width = useSharedValue(0);
  const thumb = useSharedValue(0); // 0…1 along the track
  const dragging = useSharedValue(false);
  const last = useSharedValue(ply);
  const span = Math.max(1, maxPly - 1);

  // Buttons / swipes move the thumb; a drag owns it until release.
  useEffect(() => {
    last.set(ply);
    if (!dragging.get()) thumb.set(withTiming((ply - 1) / span, platePressTiming));
  }, [ply, span, thumb, last, dragging]);

  const track = (x: number) => {
    'worklet';
    const w = width.get();
    if (w <= 0) return;
    const k = Math.min(1, Math.max(0, x / w));
    thumb.set(k);
    const p = Math.round(k * span) + 1;
    if (p !== last.get()) {
      last.set(p);
      scheduleOnRN(onSeek, p);
    }
  };

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      dragging.set(true);
      track(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      track(e.x);
    },
    onFinalize: () => {
      'worklet';
      dragging.set(false);
      thumb.set(withTiming((last.get() - 1) / span, platePressTiming));
    },
  });

  const onLayout = (e: LayoutChangeEvent) => width.set(e.nativeEvent.layout.width);
  const thumbStyle = useAnimatedStyle(() => ({ left: `${thumb.get() * 100}%` }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${thumb.get() * 100}%` }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.scrub}
        onLayout={onLayout}
        testID="viewer-scrubber"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('puzzle.scrubber')}
        accessibilityValue={{ text: t('puzzle.ply_a11y', { n: ply, total: maxPly }) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment' && ply < maxPly) onSeek(ply + 1);
          if (e.nativeEvent.actionName === 'decrement' && ply > 1) onSeek(ply - 1);
        }}
      >
        <View style={styles.rail}>
          <Animated.View style={[styles.railFill, fillStyle]} />
        </View>
        <View style={styles.ticks} pointerEvents="none">
          {Array.from({ length: maxPly }, (_, i) => (
            <View key={i} style={[styles.tick, i + 1 <= ply && styles.tickOn]} />
          ))}
        </View>
        <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none" />
      </View>
    </GestureDetector>
  );
}

/** Horizontal swipe on the board steps the line (fails on vertical, so scrolling stays native). */
export function BoardSwipe({ onStep }: { onStep: (delta: number, source: StepSource) => void }) {
  const step = (d: number) => onStep(d, 'swipe');
  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-16, 16],
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX <= -SWIPE_STEP_PX) scheduleOnRN(step, 1);
      else if (e.translationX >= SWIPE_STEP_PX) scheduleOnRN(step, -1);
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <View style={StyleSheet.absoluteFill} testID="viewer-swipe" />
    </GestureDetector>
  );
}

const THUMB = space[4];

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  btn: {
    width: space[12],
    height: space[12],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  disabled: { opacity: 0.4 },
  scrub: { flex: 1, height: space[11], justifyContent: 'center' },
  rail: { height: space[1], borderRadius: radii.full, backgroundColor: eos.well, overflow: 'hidden' },
  railFill: { height: '100%', backgroundColor: eos.ember },
  ticks: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tick: { width: space[1.5], height: space[1.5], borderRadius: radii.full, backgroundColor: eos.seam },
  tickOn: { backgroundColor: eos.ember },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    marginLeft: -THUMB / 2,
    borderRadius: radii.full,
    backgroundColor: eos.bone,
    boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: surface.backdrop }],
  },
});
