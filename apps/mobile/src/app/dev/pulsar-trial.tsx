import { eos, fontFamilies, fontSize, radii, space } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  HapticSupport,
  Presets,
  Settings,
  usePatternComposer,
  useRealtimeComposer,
  type Pattern,
} from 'react-native-pulsar';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useRenderCount } from '@/dev/renderCount';
import { feel } from '@/feel';

// /dev/pulsar-trial (PLAN Phase 1, trial only): can react-native-pulsar fire
// haptics straight from the RNGH 3 pan worklet, with no JS hop, and does it
// feel better than the expo-haptics baseline behind feel.emit? This screen
// calls Pulsar directly on purpose; if adopted, Pulsar moves behind
// src/feel/haptics.ts and screens keep calling feel.emit only.

// Captured by the worklets as a remote (RN-runtime) function reference.
const emit = feel.emit;

/** Pan detent spacing, like the board's square-to-square hover ticks. */
const DETENT_PT = 32;

const MODES = [
  { id: 'detents', label: 'Pulsar presets in worklet' },
  { id: 'realtime', label: 'Pulsar realtime (velocity → amplitude)' },
  { id: 'pattern', label: 'Pulsar pattern on release (castle ×2)' },
  { id: 'feel', label: 'Baseline: scheduleOnRN(feel.emit)' },
] as const;

// Castle: two Light-ish taps 80 ms apart (FEEL_TABLE castle), as a Pulsar pattern.
const CASTLE: Pattern = {
  discretePattern: [
    { time: 0, amplitude: 0.55, frequency: 0.6 },
    { time: 80, amplitude: 0.55, frequency: 0.6 },
  ],
  continuousPattern: { amplitude: [], frequency: [] },
};

const SUPPORT_NAME: Record<number, string> = {
  [HapticSupport.NO_SUPPORT]: 'none',
  [HapticSupport.LIMITED_SUPPORT]: 'limited',
  [HapticSupport.STANDARD_SUPPORT]: 'standard',
  [HapticSupport.ADVANCED_SUPPORT]: 'advanced',
};

function supportLevel(): string {
  try {
    return SUPPORT_NAME[Settings.getHapticsSupportLevel()] ?? 'unknown';
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export default function PulsarTrial() {
  const renders = useRenderCount('pulsar-trial');
  const [mode, setMode] = useState(0);
  const [lastDrag, setLastDrag] = useState({ detents: 0 });
  const [support] = useState(supportLevel);

  const modeSV = useSharedValue(0);
  const x = useSharedValue(0);
  const detent = useSharedValue(0);
  const detents = useSharedValue(0);

  const realtime = useRealtimeComposer();
  const castle = usePatternComposer(CASTLE);

  const pan = usePanGesture({
    onActivate: () => {
      'worklet';
      detent.value = 0;
      detents.value = 0;
      if (modeSV.value === 3) scheduleOnRN(emit, 'pickup');
      else Presets.System.selection();
    },
    onUpdate: (e) => {
      'worklet';
      x.value = e.translationX;
      const m = modeSV.value;
      if (m === 1) {
        // Continuous: amplitude follows speed, frequency the vertical position.
        const amp = Math.min(1, Math.abs(e.velocityX) / 2500);
        realtime.set(amp, Math.min(1, Math.max(0, 0.5 - e.translationY / 400)));
      }
      const d = Math.round(e.translationX / DETENT_PT);
      if (d !== detent.value) {
        detent.value = d;
        detents.value += 1;
        if (m === 0) Presets.System.impactLight();
        else if (m === 3) scheduleOnRN(emit, 'hoverLegal');
      }
    },
    onDeactivate: () => {
      'worklet';
      const m = modeSV.value;
      if (m === 1) realtime.stop();
      if (m === 2) castle.play();
      else if (m === 3) scheduleOnRN(emit, 'drop');
      else Presets.System.impactMedium();
      // One React commit per drag, at the end (not on the gesture path).
      scheduleOnRN(setLastDrag, { detents: detents.value });
    },
    onFinalize: () => {
      'worklet';
      if (modeSV.value === 1) realtime.stop();
      x.value = 0;
    },
  });

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.page} testID="pulsar-trial">
      <Stack.Screen options={{ title: 'Pulsar trial' }} />
      <Text style={styles.read} testID="pulsar-support">{`haptics support: ${support}`}</Text>
      <View style={styles.modes}>
        {MODES.map((m, i) => (
          <Pressable
            key={m.id}
            testID={`pulsar-mode-${m.id}`}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: mode === i }}
            onPress={() => {
              setMode(i);
              modeSV.value = i;
            }}
            style={[styles.mode, mode === i && styles.modeOn]}
          >
            <Text style={styles.modeText}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.track} testID="pulsar-pad" accessible accessibilityRole="adjustable" accessibilityLabel="Drag pad">
          <Animated.View style={[styles.thumb, thumb]} />
        </View>
      </GestureDetector>
      <Text style={styles.read} testID="pulsar-last">{`last drag: ${lastDrag.detents} detents`}</Text>
      <Text style={styles.read} testID="pulsar-render-count">{`screen renders ${renders}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: space[4], gap: space[3] },
  read: { color: eos.bone, fontFamily: fontFamilies.sans[500], fontSize: fontSize.xs[0], lineHeight: fontSize.xs[1], fontVariant: ['tabular-nums'] },
  modes: { gap: space[2] },
  mode: {
    minHeight: space[11],
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radii.control,
    backgroundColor: eos.rise,
    borderWidth: 1,
    borderColor: eos.seam,
  },
  modeOn: { borderColor: eos.ember },
  modeText: { color: eos.bone, fontFamily: fontFamilies.sans[600], fontSize: fontSize.sm[0] },
  track: {
    height: space[20] * 2,
    borderRadius: radii.card,
    backgroundColor: eos.well,
    borderWidth: 1,
    borderColor: eos.seam,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumb: { width: space[14], height: space[14], borderRadius: radii.full, backgroundColor: eos.ember },
});
