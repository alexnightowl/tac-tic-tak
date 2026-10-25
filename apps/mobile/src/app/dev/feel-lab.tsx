import { FEEL_TABLE, hapticSteps, type FeelEvent } from '@tac/core/feel';
import { eos, fontFamilies, fontSize, radii, space } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import {
  audioState,
  clearLatency,
  feel,
  feelStats,
  latencyLog,
  latencySummary,
  preloadSounds,
  setFeelPrefs,
  setHapticScale,
  stopLongClip,
  useFeelPrefs,
  type FeelContext,
  type LatencySummary,
} from '@/feel';
import { uiClockError, uiTimeToJs } from '@/feel/clock';

// /dev/feel-lab (PLAN Phase 1): one button per feel event, the scheduling
// latency log, per-event haptic scale, volume and toggles, JSON export.
// Dev-only screen: labels are not localised (like the dev menu).

const EVENTS = Object.keys(FEEL_TABLE) as FeelEvent[];

// Sample context so byMove / byRank / streak events resolve to a real sound.
const SAMPLE_CTX: Partial<Record<FeelEvent, FeelContext>> = {
  opponentLanding: { move: { san: 'Nxe5', flags: 'c', captured: 'p' } },
  rankUp: { band: 'intermediate' },
  streakUp: { streak: 5 },
};

// Every bundled clip, reached through feel.emit (no direct engine calls).
const CLIPS: { id: string; label: string; event: FeelEvent; ctx?: FeelContext }[] = [
  { id: 'move', label: 'move', event: 'drop' },
  { id: 'capture', label: 'capture', event: 'capture' },
  { id: 'check', label: 'check', event: 'check' },
  { id: 'castle', label: 'castle', event: 'castle' },
  { id: 'promote', label: 'promote', event: 'promote' },
  { id: 'correct', label: 'correct', event: 'correct' },
  { id: 'mistake', label: 'thud', event: 'mistake' },
  { id: 'gate', label: 'gong', event: 'normGateUp' },
  { id: 'tomoe', label: 'rank tomoe', event: 'rankUp', ctx: { band: 'beginner' } },
  { id: 'mangekyo', label: 'rank mangekyō', event: 'rankUp', ctx: { band: 'advanced' } },
  { id: 'final', label: 'rank final', event: 'rankUp', ctx: { band: 'expert' } },
  { id: 'down-a', label: 'down a', event: 'rankDown', ctx: { variant: 'a' } },
  { id: 'down-b', label: 'down b ♫', event: 'rankDown', ctx: { variant: 'b' } },
  { id: 'down-c', label: 'down c ♫', event: 'rankDown', ctx: { variant: 'c' } },
  { id: 'down-d', label: 'down d', event: 'rankDown', ctx: { variant: 'd' } },
];

// Events that make a sound, for the overlapping burst.
const SOUNDING = EVENTS.filter((e) => FEEL_TABLE[e].sound && e !== 'rankDown' && e !== 'rankUp');

// Gesture-end → start() samples (UI-thread timestamp → after emit returned).
const gestureLog: number[] = [];
let lastRawDt = NaN;

function pct(list: number[], q: number): number {
  if (list.length === 0) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function onGestureEnd(tUI: number): void {
  feel.emit('drop');
  const dt = performance.now() - uiTimeToJs(tUI);
  lastRawDt = dt;
  // Sanity window: a bad clock calibration must not poison the log.
  if (dt > -1 && dt < 1000) {
    gestureLog.push(dt);
    if (gestureLog.length > 500) gestureLog.shift();
  }
}

function burst(): void {
  // 20 overlapping triggers in 1 s (PLAN Phase 1 audio exit criterion).
  for (let i = 0; i < 20; i++) {
    const ev = SOUNDING[i % SOUNDING.length];
    setTimeout(() => feel.emit(ev, SAMPLE_CTX[ev]), i * 50);
  }
}

function exportJSON(hapticScale: Partial<Record<FeelEvent, number>>, lat: LatencySummary): string {
  const scale: Partial<Record<FeelEvent, number>> = {};
  for (const e of EVENTS) {
    const v = hapticScale[e];
    if (v !== undefined && v !== 1) scale[e] = v;
  }
  return JSON.stringify({ hapticScale: scale, latency: lat });
}

// Readouts come from module state the React Compiler cannot see, so they are
// copied into React state by a poll instead of being read during render.
function snapshot() {
  return {
    lat: latencySummary(),
    gesture: { p50: pct(gestureLog, 0.5), p95: pct(gestureLog, 0.95), n: gestureLog.length, raw: lastRawDt },
    audio: audioState(),
    stats: { ...feelStats },
    slowest: [...latencyLog()]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 4)
      .map((x) => `${x.event} ${x.ms.toFixed(1)}`)
      .join(' · '),
  };
}

function Btn({
  id,
  label,
  a11y,
  onPress,
  active,
}: {
  id: string;
  label: string;
  /** Spoken label when the visible one is a glyph (stepper − / +). */
  a11y?: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.btn, active && styles.btnActive, pressed && styles.btnPressed]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ id, label, value, onStep }: { id: string; label: string; value: string; onStep: (d: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel} numberOfLines={1}>
        {label}
      </Text>
      <Btn id={`${id}-dec`} label="−" a11y={`Decrease ${label}`} onPress={() => onStep(-1)} />
      <Text style={styles.stepValue} testID={id}>
        {value}
      </Text>
      <Btn id={`${id}-inc`} label="+" a11y={`Increase ${label}`} onPress={() => onStep(1)} />
    </View>
  );
}

function hapticSummary(e: FeelEvent): string {
  const steps = hapticSteps(FEEL_TABLE[e].haptic);
  return steps.length === 1 ? steps[0].haptic : `${steps.length} steps`;
}

export default function FeelLab() {
  const prefs = useFeelPrefs();
  const [snap, setSnap] = useState(snapshot);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    // No preload here on purpose: the first tap after a cold start is the
    // cold path (context + decode) that the splash gate will normally hide.
    // Readouts poll; the emit path never touches React state.
    const id = setInterval(() => setSnap(snapshot()), 250);
    return () => clearInterval(id);
  }, []);

  const tap = useTapGesture({
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(onGestureEnd, performance.now());
    },
  });

  const { lat, audio, stats, gesture, slowest } = snap;
  const json = exportJSON(prefs.hapticScale, lat);

  return (
    <ScrollView contentContainerStyle={styles.page} testID="feel-lab">
      <Stack.Screen options={{ title: 'Feel lab' }} />

      <View style={styles.card}>
        <Text style={styles.read} testID="feel-latency">
          {`emit→start p50 ${lat.p50.toFixed(2)} ms · p95 ${lat.p95.toFixed(2)} ms · max ${lat.max.toFixed(2)} · n ${lat.n}`}
        </Text>
        <Text style={styles.read} testID="feel-slowest">
          {`slowest: ${slowest || '–'}`}
        </Text>
        <Text style={styles.read} testID="feel-gesture-latency">
          {`gesture→start p50 ${gesture.p50.toFixed(2)} ms · p95 ${gesture.p95.toFixed(2)} ms · n ${gesture.n} · last ${gesture.raw.toFixed(2)} ± ${uiClockError().toFixed(2)}`}
        </Text>
        <Text style={styles.read} testID="feel-errors">
          {`errors: ${stats.errors}`}
        </Text>
        {stats.lastError ? (
          <Text style={styles.err} testID="feel-last-error">
            {stats.lastError}
          </Text>
        ) : null}
        <Text style={styles.read} testID="feel-plays">
          {`plays: ${stats.plays} · late: ${stats.lateStarts}`}
        </Text>
        <Text style={styles.read} testID="feel-first">
          {`first sound ${stats.firstEvent || '–'} ${stats.firstPlayMs.toFixed(0)} ms after first request · preload ${stats.preloadMs.toFixed(0)} ms · ${stats.decoded} decoded · ctx ${stats.contextMs.toFixed(1)} ms · driver ${stats.driverMs.toFixed(0)} ms`}
        </Text>
        <Text style={styles.read} testID="feel-ctx">
          {`ctx ${audio.state} · ${audio.sampleRate} Hz · t ${audio.time.toFixed(2)} s · suspends ${stats.suspends} · resumes ${stats.resumes}`}
        </Text>
        <View style={styles.row}>
          <Btn id="feel-burst" label="Burst 20 / 1 s" onPress={burst} />
          <Btn id="feel-clear" label="Clear log" onPress={() => {
            clearLatency();
            gestureLog.length = 0;
          }} />
          <Btn id="feel-preload" label="Preload" onPress={() => void preloadSounds()} />
          <Btn id="feel-stop-long" label="Stop music (500 ms)" onPress={() => stopLongClip(500)} />
        </View>
        <GestureDetector gesture={tap}>
          <View style={styles.pad} testID="feel-gesture-pad" accessible accessibilityRole="button" accessibilityLabel="Gesture pad">
            <Text style={styles.btnText}>{"Tap pad · UI-thread gesture → emit('drop')"}</Text>
          </View>
        </GestureDetector>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Btn
            id="feel-sound-toggle"
            label={`Sound ${prefs.soundEnabled ? 'on' : 'off'}`}
            active={prefs.soundEnabled}
            onPress={() => setFeelPrefs({ soundEnabled: !prefs.soundEnabled })}
          />
          <Btn
            id="feel-haptics-toggle"
            label={`Haptics ${prefs.hapticsEnabled ? 'on' : 'off'}`}
            active={prefs.hapticsEnabled}
            onPress={() => setFeelPrefs({ hapticsEnabled: !prefs.hapticsEnabled })}
          />
        </View>
        <Stepper
          id="feel-volume"
          label="Volume"
          value={prefs.volume.toFixed(1)}
          onStep={(d) => setFeelPrefs({ volume: Math.round((prefs.volume + d * 0.1) * 10) / 10 })}
        />
      </View>

      <Text style={styles.h}>Events</Text>
      <View style={styles.grid}>
        {EVENTS.map((e) => (
          <Btn key={e} id={`feel-${e}`} label={e} onPress={() => feel.emit(e, SAMPLE_CTX[e])} />
        ))}
      </View>

      <Text style={styles.h}>Clips</Text>
      <View style={styles.grid}>
        {CLIPS.map((c) => (
          <Btn key={c.id} id={`feel-clip-${c.id}`} label={c.label} onPress={() => feel.emit(c.event, { ...c.ctx, force: true })} />
        ))}
      </View>

      <Text style={styles.h}>Haptic scale per event (0 mutes; expo-haptics: &lt;0.5 one step softer, ≥1.5 one step harder)</Text>
      <View style={styles.card}>
        {EVENTS.map((e) => (
          <Stepper
            key={e}
            id={`feel-scale-${e}`}
            label={`${e} · ${hapticSummary(e)}`}
            value={(prefs.hapticScale[e] ?? 1).toFixed(2)}
            onStep={(d) => {
              setHapticScale(e, (prefs.hapticScale[e] ?? 1) + d * 0.25);
              feel.emit(e, SAMPLE_CTX[e]);
            }}
          />
        ))}
      </View>

      <View style={styles.row}>
        <Btn id="feel-export" label="Share JSON" onPress={() => void Share.share({ message: json })} />
        <Btn id="feel-export-show" label={showJson ? 'Hide JSON' : 'Show JSON'} onPress={() => setShowJson((s) => !s)} />
      </View>
      {showJson ? (
        <Text selectable style={styles.json} testID="feel-export-json">
          {json}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space[4], gap: space[3], paddingBottom: space[16] },
  card: { backgroundColor: eos.slate, borderRadius: radii.card, padding: space[3], gap: space[2], borderWidth: 1, borderColor: eos.seam },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  h: { color: eos.ash, fontFamily: fontFamilies.sans[700], fontSize: fontSize.xs[0], lineHeight: fontSize.xs[1], marginTop: space[2] },
  read: { color: eos.bone, fontFamily: fontFamilies.sans[500], fontSize: fontSize.xs[0], lineHeight: fontSize.xs[1], fontVariant: ['tabular-nums'] },
  err: { color: eos.rose, fontFamily: fontFamilies.sans[500], fontSize: fontSize.xs[0] },
  btn: {
    minHeight: space[11],
    minWidth: space[11],
    paddingHorizontal: space[3],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.control,
    backgroundColor: eos.rise,
    borderWidth: 1,
    borderColor: eos.seam,
  },
  btnActive: { borderColor: eos.ember },
  btnPressed: { backgroundColor: eos.embers },
  btnText: { color: eos.bone, fontFamily: fontFamilies.sans[600], fontSize: fontSize.sm[0] },
  pad: {
    height: space[20],
    borderRadius: radii.card,
    backgroundColor: eos.well,
    borderWidth: 1,
    borderColor: eos.ember,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepLabel: { flex: 1, color: eos.bone, fontFamily: fontFamilies.sans[500], fontSize: fontSize.xs[0] },
  stepValue: { width: space[12], textAlign: 'center', color: eos.bone, fontFamily: fontFamilies.sans[700], fontSize: fontSize.sm[0], fontVariant: ['tabular-nums'] },
  json: { color: eos.ash, fontFamily: fontFamilies.sans[400], fontSize: fontSize.xs[0], backgroundColor: eos.well, padding: space[3], borderRadius: radii.control },
});
