import type { Square } from '@tac/core/board';
import { ANIMATION_MS, eos, fontFamilies, fontSize, radii, space } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Board, START_FEN, type BoardHandle } from '@/board';
import { useFrameStats, type FrameReport } from '@/dev/frameStats';

// The Opera Game: captures, a queenside castle and a mate, so autoplay
// exercises slides, capture fades and the castling rook.
const OPERA = 'e2e4 e7e5 g1f3 d7d6 d2d4 c8g4 d4e5 g4f3 d1f3 d6e5 f1c4 g8f6 f3b3 d8e7 b1c3 c7c6 c1g5 b7b5 c3b5 c6b5 c4b5 b8d7 e1c1 a8d8 d1d7 d8d7 h1d1 e7e6 b5d7 f6d7 b3b8 d7b8 d1d8'
  .split(' ')
  .map((u) => [u.slice(0, 2), u.slice(2, 4)] as [Square, Square]);

/** Knight shuffle: always legal, so animateMove can be timed back to back. */
const SHUFFLE: [Square, Square][] = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];

const fmt = (r: FrameReport) =>
  `p50=${r.p50.toFixed(1)} p95=${r.p95.toFixed(1)} over16=${(r.over16 * 100).toFixed(1)}% over33=${(r.over33 * 100).toFixed(1)}% frames=${r.frames}`;

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
  const [stats, setStats] = useState('');
  const [recording, setRecording] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [timingResult, setTimingResult] = useState('');
  const [renders, setRenders] = useState(0);
  const frames = useFrameStats((r) => setStats(fmt(r)));

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

  const runTiming = async () => {
    const b = board.current;
    if (!b) return;
    b.reset(START_FEN);
    const ms = ANIMATION_MS.normal;
    const errs: number[] = [];
    setTimingResult('running…');
    for (let i = 0; i < 50; i++) {
      const [from, to] = SHUFFLE[i % 4];
      const t0 = performance.now();
      await b.animateMove(from, to, ms);
      errs.push(performance.now() - t0 - ms);
    }
    const sorted = [...errs].sort((a, c) => a - c);
    const mean = errs.reduce((a, c) => a + c, 0) / errs.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    setTimingResult(`n=50 ms=${ms} late mean=${mean.toFixed(1)} p95=${p95.toFixed(1)} min=${sorted[0].toFixed(1)} max=${sorted[sorted.length - 1].toFixed(1)}`);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Board bench' }} />
      <Board ref={board} style={styles.board} onRenderCount={setRenders} />
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <View style={styles.row}>
          <BenchButton
            id="bench-start"
            label="start"
            active={recording}
            onPress={() => {
              setRecording(true);
              setStats('recording…');
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
              const next = !playing.current;
              playing.current = next;
              setAutoplay(next);
              if (next) void runAutoplay();
            }}
          />
          <BenchButton id="bench-timing" label="animateMove ×50" onPress={() => void runTiming()} />
        </View>
        <Text testID="framestats" style={styles.mono}>{stats}</Text>
        <Text testID="bench-timing-result" style={styles.mono}>{timingResult}</Text>
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
