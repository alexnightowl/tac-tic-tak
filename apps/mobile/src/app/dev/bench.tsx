import type { Square } from '@tac/core/board';
import { ANIMATION_MS, eos, fontFamilies, fontSize, radii, space } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Board, START_FEN, type BoardHandle, type SlideTiming } from '@/board';
import { useFrameStats, type FrameReport } from '@/dev/frameStats';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

// The Opera Game: captures, a queenside castle and a mate, so autoplay
// exercises slides, capture fades and the castling rook.
const OPERA = 'e2e4 e7e5 g1f3 d7d6 d2d4 c8g4 d4e5 g4f3 d1f3 d6e5 f1c4 g8f6 f3b3 d8e7 b1c3 c7c6 c1g5 b7b5 c3b5 c6b5 c4b5 b8d7 e1c1 a8d8 d1d7 d8d7 h1d1 e7e6 b5d7 f6d7 b3b8 d7b8 d1d8'
  .split(' ')
  .map((u) => [u.slice(0, 2), u.slice(2, 4)] as [Square, Square]);

/** Knight shuffle: always legal, so animateMove can be timed back to back. */
const SHUFFLE: [Square, Square][] = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];

/** Suite phase lengths (ms of wall time per FrameStats window). */
const IDLE_MS = 3000;
const AUTOPLAY_MS = 6000;

const fmt = (r: FrameReport) =>
  `p50=${r.p50.toFixed(1)} p95=${r.p95.toFixed(1)} over16=${(r.over16 * 100).toFixed(1)}% over33=${(r.over33 * 100).toFixed(1)}% frames=${r.frames}`;

/** "mean=… p95=… min=… max=…" of a sample list. */
function dist(xs: number[]): string {
  const sorted = [...xs].sort((a, c) => a - c);
  const mean = xs.reduce((a, c) => a + c, 0) / xs.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return `mean=${mean.toFixed(1)} p95=${p95.toFixed(1)} min=${sorted[0].toFixed(1)} max=${sorted[sorted.length - 1].toFixed(1)}`;
}

/**
 * performance.now() on the UI runtime is the raw steady clock; on the RN
 * runtime it counts from a time origin. Offset (UI − JS) from the
 * shortest of 20 round trips, error ≤ rtt / 2.
 */
async function calibrateUiClock(): Promise<{ offset: number; rtt: number }> {
  let best = { offset: 0, rtt: Infinity };
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const ui = await new Promise<number>((resolve) => {
      scheduleOnUI(() => {
        'worklet';
        scheduleOnRN(resolve, performance.now());
      });
    });
    const t1 = performance.now();
    if (t1 - t0 < best.rtt) best = { offset: ui - (t0 + t1) / 2, rtt: t1 - t0 };
  }
  return best;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function BenchButton({ id, label, onPress, active }: { id: string; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, active && styles.btnActive, pressed && styles.btnPressed]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

/** Busy-loops the JS thread: UI-thread animations and drags must not care. */
function jam(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    // spin
  }
}

export default function Bench() {
  const board = useRef<BoardHandle>(null);
  const playing = useRef(false);
  const autoplayDone = useRef<Promise<void>>(Promise.resolve());
  const lastSlide = useRef<SlideTiming | null>(null);
  // Where the next FrameStats report goes (manual start/stop or a suite phase).
  const sink = useRef<(r: FrameReport) => void>(() => {});
  const [stats, setStats] = useState('');
  const [recording, setRecording] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [timingResult, setTimingResult] = useState('');
  const [timingUi, setTimingUi] = useState('');
  const [suite, setSuite] = useState({ idle: '', autoplay: '', jam: '', status: '' });
  const [renders, setRenders] = useState(0);
  const frames = useFrameStats((r) => sink.current(r));

  useEffect(() => () => {
    playing.current = false;
  }, []);

  const runAutoplay = async () => {
    while (playing.current) {
      board.current?.reset(START_FEN);
      for (const [from, to] of OPERA) {
        if (!playing.current || !board.current) return;
        await board.current.animateMove(from, to, ANIMATION_MS.normal);
      }
    }
  };

  const startAutoplay = () => {
    playing.current = true;
    setAutoplay(true);
    autoplayDone.current = runAutoplay();
  };
  const stopAutoplay = () => {
    playing.current = false;
    setAutoplay(false);
    return autoplayDone.current;
  };

  /** One FrameStats window of `ms` around `during()`. */
  const record = (ms: number, during?: () => void) =>
    new Promise<FrameReport>((resolve) => {
      sink.current = resolve;
      frames.start();
      during?.();
      void wait(ms).then(() => frames.stop());
    });

  const runTiming = async () => {
    const b = board.current;
    if (!b) return;
    b.reset(START_FEN);
    await wait(300);
    const clock = await calibrateUiClock();
    const ms = ANIMATION_MS.normal;
    const fromCall: number[] = [];
    const fromUi: number[] = [];
    const startDelay: number[] = [];
    const hop: number[] = [];
    setTimingResult('running…');
    setTimingUi('');
    for (let i = 0; i < 50; i++) {
      const [from, to] = SHUFFLE[i % 4];
      lastSlide.current = null;
      const t0 = performance.now();
      await b.animateMove(from, to, ms);
      const t1 = performance.now();
      fromCall.push(t1 - t0 - ms);
      const s = lastSlide.current as SlideTiming | null;
      if (s) {
        const uiStart = s.uiStart - clock.offset;
        fromUi.push(t1 - uiStart - ms);
        startDelay.push(uiStart - t0);
        hop.push(t1 - (s.uiEnd - clock.offset));
      }
    }
    setTimingResult(`n=50 ms=${ms} late ${dist(fromCall)}`);
    setTimingUi(
      fromUi.length
        ? `fromUiStart ${dist(fromUi)} | callToUiStart ${dist(startDelay)} | uiEndToResolve ${dist(hop)} | clock ±${(clock.rtt / 2).toFixed(1)}`
        : 'no slide timings',
    );
  };

  // idle → autoplay → autoplay + JS jam → animateMove ×50, each in its own window (Release only).
  const runSuite = async () => {
    setSuite({ idle: '', autoplay: '', jam: '', status: 'idle…' });
    board.current?.reset(START_FEN);
    await wait(500);
    const idle = fmt(await record(IDLE_MS));
    setSuite((s) => ({ ...s, idle, status: 'autoplay…' }));
    const auto = await record(AUTOPLAY_MS, startAutoplay);
    await stopAutoplay();
    setSuite((s) => ({ ...s, autoplay: fmt(auto), status: 'autoplay + jam…' }));
    // A 500 ms JS jam a second into autoplay: slides already started must
    // not care (the chain itself pauses until JS is free again).
    const jammed = await record(AUTOPLAY_MS, () => {
      startAutoplay();
      void wait(1000).then(() => jam(500));
    });
    await stopAutoplay();
    setSuite((s) => ({ ...s, jam: fmt(jammed), status: 'timing…' }));
    await runTiming();
    setSuite((s) => ({ ...s, status: 'suite done' }));
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Board bench' }} />
      <Board
        ref={board}
        style={styles.board}
        onRenderCount={setRenders}
        onSlideTiming={(t) => {
          lastSlide.current = t;
        }}
      />
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <View style={styles.row}>
          <BenchButton
            id="bench-start"
            label="start"
            active={recording}
            onPress={() => {
              setRecording(true);
              setStats('recording…');
              sink.current = (r) => setStats(fmt(r));
              frames.start();
            }}
          />
          <BenchButton
            id="bench-stop"
            label="stop"
            onPress={() => {
              setRecording(false);
              frames.stop();
            }}
          />
          <BenchButton id="bench-jam" label="JS jam 500ms" onPress={() => jam(500)} />
        </View>
        <View style={styles.row}>
          <BenchButton
            id="bench-autoplay"
            label={autoplay ? 'autoplay on' : 'autoplay off'}
            active={autoplay}
            onPress={() => {
              if (playing.current) void stopAutoplay();
              else startAutoplay();
            }}
          />
          <BenchButton id="bench-timing" label="animateMove ×50" onPress={() => void runTiming()} />
          <BenchButton id="bench-suite" label="suite" onPress={() => void runSuite()} />
        </View>
        <Text testID="framestats" style={styles.mono}>{stats}</Text>
        <Text testID="bench-timing-result" style={styles.mono}>{timingResult}</Text>
        <Text testID="bench-timing-ui" style={styles.mono}>{timingUi}</Text>
        <Text testID="bench-suite-idle" style={styles.mono}>{suite.idle ? `idle ${suite.idle}` : ''}</Text>
        <Text testID="bench-suite-autoplay" style={styles.mono}>{suite.autoplay ? `autoplay ${suite.autoplay}` : ''}</Text>
        <Text testID="bench-suite-jam" style={styles.mono}>{suite.jam ? `autoplay+jam ${suite.jam}` : ''}</Text>
        <Text testID="bench-suite-status" style={styles.meta}>{suite.status}</Text>
        <View style={styles.row}>
          <Text style={styles.meta}>board renders </Text>
          <Text testID="board-render-count" style={styles.meta}>{renders}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  board: { alignSelf: 'stretch', aspectRatio: 1, margin: space[2] },
  panel: { flex: 1 },
  panelContent: { padding: space[3], gap: space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  mono: { color: eos.bone, fontFamily: fontFamilies.sans[500], fontSize: fontSize.xs[0] },
  meta: { color: eos.ash, fontFamily: fontFamilies.sans[400], fontSize: fontSize.xs[0] },
  btn: {
    backgroundColor: eos.slate,
    borderColor: eos.seam,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  btnActive: { borderColor: eos.ember },
  btnPressed: { backgroundColor: eos.rise },
  btnText: { color: eos.bone, fontFamily: fontFamilies.sans[600], fontSize: fontSize.sm[0] },
});
