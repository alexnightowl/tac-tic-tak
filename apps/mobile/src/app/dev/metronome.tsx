import { eos, fontFamilies, fontSize, radii, space } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { renderCounts, useRenderCount } from '@/dev/renderCount';
import { feel, preloadSounds } from '@/feel';
import { uiClockError, uiTimeToJs } from '@/feel/clock';

// /dev/metronome (PLAN Phase 1): flash + click every 500 ms, for the owner's
// 240 fps slow-motion check (target: < 30 ms between flash and click).
// The beat is clocked on the UI thread by a frame callback (vsync, no
// setInterval drift); each beat lights the flash in that same frame and hops
// to JS through the product path, scheduleOnRN(feel.emit) → start(). So the
// film shows exactly what a drop on the board will feel like.

const PERIOD_MS = 500;
/** Flash on-time: a few frames, so it is visible on film at any refresh rate. */
const FLASH_MS = 80;

// Beat log (JS side): UI timestamps for interval jitter, and the UI → start()
// hop. Module state, read by the 1 Hz readout only.
const beats: number[] = [];
const hops: number[] = [];

function onBeat(tUI: number, k: number): void {
  feel.emit('drop');
  const hop = performance.now() - uiTimeToJs(tUI);
  beats.push(tUI);
  // Beat 0 lands while the Start press is still re-rendering: not steady state.
  if (k > 0 && hop > -1 && hop < 1000) hops.push(hop);
  if (beats.length > 600) beats.shift();
  if (hops.length > 600) hops.shift();
}

function pct(list: number[], q: number): number {
  if (list.length === 0) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function summary() {
  const jitter: number[] = [];
  for (let i = 1; i < beats.length; i++) jitter.push(Math.abs(beats[i] - beats[i - 1] - PERIOD_MS));
  return {
    n: beats.length,
    hop50: pct(hops, 0.5),
    hop95: pct(hops, 0.95),
    jit95: pct(jitter, 0.95),
    jitMax: jitter.length ? Math.max(...jitter) : 0,
    screenRenders: renderCounts().metronome ?? 0,
  };
}

/** Re-renders itself at 1 Hz; the beat path never touches React state. */
function Readout() {
  const [s, setS] = useState(summary);
  useEffect(() => {
    const id = setInterval(() => setS(summary()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.card}>
      <Text style={styles.read} testID="metro-beats">{`beats ${s.n}`}</Text>
      <Text style={styles.read} testID="metro-hop">
        {`UI beat → start() p50 ${s.hop50.toFixed(2)} ms · p95 ${s.hop95.toFixed(2)} ms (± ${uiClockError().toFixed(2)})`}
      </Text>
      <Text style={styles.read} testID="metro-jitter">
        {`interval error p95 ${s.jit95.toFixed(2)} ms · max ${s.jitMax.toFixed(2)} ms`}
      </Text>
      <Text style={styles.read} testID="metro-render-count">{`screen renders ${s.screenRenders}`}</Text>
    </View>
  );
}

export default function Metronome() {
  useRenderCount('metronome');
  const [running, setRunning] = useState(false);
  const origin = useSharedValue(-1);
  const lastBeat = useSharedValue(-1);
  const flash = useSharedValue(0);

  const frame = useFrameCallback((info) => {
    'worklet';
    const t = info.timestamp;
    if (origin.value < 0) origin.value = t;
    const elapsed = t - origin.value;
    const k = Math.floor(elapsed / PERIOD_MS);
    flash.value = elapsed - k * PERIOD_MS < FLASH_MS ? 1 : 0;
    if (k !== lastBeat.value) {
      lastBeat.value = k;
      scheduleOnRN(onBeat, performance.now(), k);
    }
  }, false);

  useEffect(() => {
    // The first click must not pay for the decode or the clock calibration.
    void preloadSounds();
    uiClockError();
    return () => frame.setActive(false);
  }, [frame]);

  const toggle = () => {
    const next = !running;
    if (next) {
      beats.length = 0;
      hops.length = 0;
      origin.set(-1);
      lastBeat.set(-1);
    } else {
      flash.set(0);
    }
    frame.setActive(next);
    setRunning(next);
  };

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <View style={styles.page} testID="metronome">
      <Stack.Screen options={{ title: 'Metronome' }} />
      <View style={styles.stage}>
        <Animated.View style={[styles.flash, flashStyle]} testID="metro-flash" />
      </View>
      <Pressable
        testID={running ? 'metro-stop' : 'metro-start'}
        accessibilityRole="button"
        accessibilityLabel={running ? 'Stop metronome' : 'Start metronome'}
        onPress={toggle}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnText}>{running ? 'Stop' : 'Start'}</Text>
      </Pressable>
      <Readout />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: space[4], gap: space[4] },
  stage: { aspectRatio: 1, borderRadius: radii.card, backgroundColor: eos.well, borderWidth: 1, borderColor: eos.seam, overflow: 'hidden' },
  flash: { flex: 1, backgroundColor: eos.bone },
  card: { backgroundColor: eos.slate, borderRadius: radii.card, padding: space[3], gap: space[1], borderWidth: 1, borderColor: eos.seam },
  read: { color: eos.bone, fontFamily: fontFamilies.sans[500], fontSize: fontSize.xs[0], lineHeight: fontSize.xs[1], fontVariant: ['tabular-nums'] },
  btn: {
    minHeight: space[12],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.control,
    backgroundColor: eos.ember,
  },
  btnPressed: { backgroundColor: eos.embers },
  btnText: { color: eos.bone, fontFamily: fontFamilies.sans[700], fontSize: fontSize.base[0] },
});
