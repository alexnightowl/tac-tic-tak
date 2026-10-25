import type { Orientation, Square } from '@tac/core/board';
import { eos, fontFamilies, fontSize, radii, space } from '@tac/core/tokens';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Board, START_FEN, type BoardHandle, type LastMove } from '@/board';
import { Chess } from '@/board/chess';
import { renderCounts } from '@/dev/renderCount';

// Fixed positions for the Maestro flows (deep-link params work too, but
// simctl/openLink raise an "Open in…?" prompt on fresh simulators).
const PRESETS: { id: string; fen: string; orientation?: Orientation }[] = [
  { id: 'start', fen: START_FEN },
  { id: 'promo', fen: '7k/P7/8/8/8/8/8/K7 w - - 0 1' },
  { id: 'castle', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1' },
  { id: 'ep', fen: 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3' },
  { id: 'check', fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2' },
  { id: 'black', fen: START_FEN, orientation: 'black' },
];

/** Board / Square / Piece React commits; per-instance keys are summed. */
function summariseCounts(): string {
  const total: Record<string, number> = { Board: 0, Square: 0, Piece: 0 };
  for (const [k, n] of Object.entries(renderCounts())) {
    const kind = k.split(':')[0];
    if (kind in total) total[kind] += n;
  }
  return `Board ${total.Board} · Square ${total.Square} · Piece ${total.Piece}`;
}

function LabButton({ id, label, onPress, active }: { id: string; label: string; onPress: () => void; active?: boolean }) {
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

type LabParams = { fen?: string; orientation?: string; mirror?: string };

export default function BoardLab() {
  const params = useLocalSearchParams<LabParams>();
  // A new deep link into an open lab re-mounts it with the new position.
  return <Lab key={`${params.fen}|${params.orientation}|${params.mirror}`} params={params} />;
}

function Lab({ params }: { params: LabParams }) {
  const startFen = params.fen && params.fen.length > 0 ? params.fen : START_FEN;
  const board = useRef<BoardHandle>(null);
  const [fen, setFen] = useState(startFen);
  const [last, setLast] = useState<LastMove | null>(null);
  const [renders, setRenders] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>(params.orientation === 'black' ? 'black' : 'white');
  const [mirror, setMirror] = useState(params.mirror === '1' || params.mirror === 'true');
  const [interactive, setInteractive] = useState(true);
  const [hintLevel, setHintLevel] = useState(0);
  const [frame, setFrame] = useState('');
  const [counts, setCounts] = useState('');
  const [busy, setBusy] = useState('');

  const target = (): Square => last?.to ?? 'e4';
  const firstLegal = () => {
    const moves = new Chess(fen).moves({ verbose: true });
    return moves[0] ?? null;
  };
  const animate = (ms: number) => {
    const m = firstLegal();
    if (!m) return;
    const t0 = performance.now();
    setBusy('animating');
    board.current?.animateMove(m.from, m.to, ms).then(() => setBusy(`done ${Math.round(performance.now() - t0)}ms`));
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Board lab' }} />
      <Board
        ref={board}
        initialFen={startFen}
        orientation={orientation}
        mirror={mirror}
        style={styles.board}
        onPositionChange={(f, lm) => {
          setFen(f);
          setLast(lm);
        }}
        onRenderCount={setRenders}
        onBoardFrame={(f) => setFrame(`${Math.round(f.x)},${Math.round(f.y)},${Math.round(f.size)}`)}
      />
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text testID="lab-fen" style={styles.mono} selectable>{fen}</Text>
        <View style={styles.row}>
          <Text style={styles.meta}>renders </Text>
          <Text testID="board-render-count" style={styles.meta}>{renders}</Text>
          <Text style={styles.meta}>  frame </Text>
          <Text testID="lab-board-frame" style={styles.meta}>{frame}</Text>
          <Text testID="lab-busy" style={styles.meta}>{busy ? `  ${busy}` : ''}</Text>
        </View>
        <View style={styles.row}>
          {PRESETS.map((p) => (
            <LabButton
              key={p.id}
              id={`lab-preset-${p.id}`}
              label={p.id}
              onPress={() => {
                setHintLevel(0);
                setOrientation(p.orientation ?? 'white');
                board.current?.reset(p.fen, p.orientation ?? 'white');
              }}
            />
          ))}
        </View>
        <View style={styles.row}>
          <LabButton id="lab-flip" label="flip" onPress={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} />
          <LabButton id="lab-mirror" label="mirror" active={mirror} onPress={() => setMirror((m) => !m)} />
          <LabButton
            id="lab-interactive"
            label={interactive ? 'input on' : 'input off'}
            active={!interactive}
            onPress={() => {
              board.current?.setInteractive(!interactive);
              setInteractive(!interactive);
            }}
          />
          <LabButton id="lab-reset" label="reset" onPress={() => board.current?.reset(startFen)} />
        </View>
        <View style={styles.row}>
          <LabButton id="lab-flash-ok" label="flash ok" onPress={() => board.current?.flash(target(), true)} />
          <LabButton id="lab-flash-fail" label="flash fail" onPress={() => board.current?.flash(target(), false)} />
          <LabButton id="lab-shake" label="shake" onPress={() => board.current?.shake(target())} />
          <LabButton id="lab-sparks" label="sparks" onPress={() => board.current?.sparks(target())} />
        </View>
        <View style={styles.row}>
          <LabButton
            id="lab-hint"
            label={`hint ${hintLevel}`}
            onPress={() => {
              const m = firstLegal();
              const next = ((hintLevel + 1) % 3) as 0 | 1 | 2;
              setHintLevel(next);
              board.current?.setHint(next, m?.from, m?.to);
            }}
          />
          <LabButton id="lab-animate" label="animate" onPress={() => animate(280)} />
          {/* A 30 s slide: input must stay blocked until it lands (01-board-tap). */}
          <LabButton id="lab-animate-slow" label="animate 30s" onPress={() => animate(30000)} />
          <LabButton
            id="lab-arrows"
            label="arrows"
            onPress={() => board.current?.setArrows([{ from: 'g1', to: 'f3' }, { from: 'd2', to: 'd4' }])}
          />
          <LabButton id="lab-counts" label="counts" onPress={() => setCounts(summariseCounts())} />
        </View>
        <Text testID="lab-render-counts" style={styles.meta}>{counts}</Text>
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
