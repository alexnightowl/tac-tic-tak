import type { WoodpeckerPuzzle, WoodpeckerSet } from '@tac/core/api';
import { cycleTargetSec, mateInFromThemes, woodpeckerQueue, WOODPECKER_BLOCK, type LibraryResult } from '@tac/core/library';
import { canHint, solutionStepOf } from '@tac/core/runner';
import { alpha, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Bird, ChevronLeft, Lightbulb } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goalLine } from '@/features/courses/model';
import { attemptsOf, libraryStore, useAttempts } from '@/features/library/store';
import { PuzzleClock, ResultTracker, toItem } from '@/features/library/SolveScreen';
import { requestLibrarySync } from '@/features/library/sync';
import { SolutionStepper } from '@/features/puzzles/SolutionStepper';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import type { PracticeHooks } from '@/features/review/practice/PracticeController';
import { usePractice } from '@/features/review/practice/usePractice';
import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { toast } from '@/shell/toast/store';
import { AppText, PlateButton, Tap } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { useWoodpeckerSet } from './api';
import { clock } from './model';

// /woodpecker/solve?set&cycle&start (D40): the set on the Library's
// practice runner (`library` mode: no clock pressure, hint and solution,
// each result queued once as clean / hint / missed by the ResultTracker
// with bookId = the set id). The queue runs in set order from `start`
// through the whole cycle; the cycle's last result ends it with a toast
// and goes back to the set page.

const asItem = (p: WoodpeckerPuzzle) => toItem({ ...p, moves: p.moves.split(' ') });

function doneIn(setId: string, cycle: number): Set<string> {
  return new Set(
    attemptsOf(libraryStore.getState())
      .filter((a) => a.bookId === setId && a.cycle === cycle)
      .map((a) => a.puzzleId),
  );
}

/** The set's runner: shared by the phone screen and the desktop board screen. */
export function useWoodpeckerRunner(set: WoodpeckerSet, cycle: number, start: number) {
  const t = useT();
  const tn = useTn();
  const ids = useMemo(() => set.puzzles.map((p) => p.id), [set]);
  const byId = useMemo(() => new Map(set.puzzles.map((p) => [p.id, p])), [set]);
  const [tracker] = useState(() => new ResultTracker(set.id, cycle));
  const hooks = useMemo<PracticeHooks>(
    () => ({
      advance: async (puzzleId) => {
        const done = doneIn(set.id, cycle);
        done.add(puzzleId);
        const from = Math.max(0, ids.indexOf(puzzleId) + 1);
        const id = woodpeckerQueue(ids, done, from)[0];
        const p = id ? byId.get(id) : undefined;
        return p ? asItem(p) : null;
      },
    }),
    [set.id, cycle, ids, byId],
  );
  const { controller, state: s, onMove, boardRef } = usePractice('library', hooks);
  const { note } = useSyncExternalStore(tracker.subscribe, tracker.getSnap);
  const attempts = useAttempts();
  const finished = useRef(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/woodpecker?set=${set.id}` as Href);
  };

  useEffect(() => {
    const off = controller.subscribe(() => tracker.onState(controller.getState()));
    const id = woodpeckerQueue(ids, doneIn(set.id, cycle), start)[0];
    const first = id ? byId.get(id) : undefined;
    if (first) controller.dispatch({ type: 'start', items: [asItem(first)] });
    else close();
    return off;
  }, [controller, tracker]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(() => attempts.filter((a) => a.bookId === set.id), [attempts, set.id]);
  const results = useMemo(() => {
    const m = new Map<string, LibraryResult>();
    for (const a of mine) if (a.cycle === cycle && !m.has(a.puzzleId)) m.set(a.puzzleId, a.result);
    return m;
  }, [mine, cycle]);
  const cycles = useMemo(() => {
    const out: { cycle: number; avgSec: number | null }[] = [];
    for (let n = 1; n < cycle; n++) {
      const rs = mine.filter((a) => a.cycle === n);
      out.push({ cycle: n, avgSec: rs.length ? Math.round(rs.reduce((x, r) => x + r.timeMs, 0) / rs.length / 1000) : null });
    }
    return out;
  }, [mine, cycle]);
  const target = cycleTargetSec(cycles, cycle);

  // The cycle's last puzzle: say so and go back to the set page.
  useEffect(() => {
    if (s.phase !== 'done' || finished.current) return;
    finished.current = true;
    const rs = attemptsOf(libraryStore.getState()).filter((a) => a.bookId === set.id && a.cycle === cycle);
    if (rs.length >= ids.length) {
      const avg = Math.round(rs.reduce((x, r) => x + r.timeMs, 0) / rs.length / 1000);
      toast.show({ title: t('woodpecker.cycle_done_toast', { n: cycle }), description: t('woodpecker.cycle_done_toast_sub', { avg: clock(avg) }), icon: Bird });
    }
    close();
  }, [s.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving flushes what was just played.
  useEffect(() => () => void requestLibrarySync('runner'), []);

  const puzzleId = s.item?.puzzle.id ?? null;
  const index = puzzleId ? ids.indexOf(puzzleId) : -1;
  const puzzle = index >= 0 ? set.puzzles[index] : null;
  const block = Math.max(0, Math.floor(Math.max(0, index) / WOODPECKER_BLOCK));
  const blockIds = ids.slice(block * WOODPECKER_BLOCK, (block + 1) * WOODPECKER_BLOCK);
  const side = s.playerColor;
  const mateIn = puzzle ? mateInFromThemes(puzzle.themes) : null;
  // Lichess themes: mateInN, else "equality" (hold), else a win.
  const goal = !puzzle
    ? t('play.loading_puzzle')
    : mateIn
      ? goalLine({ goal: 'mate', mateIn }, side, t, tn)
      : puzzle.themes.includes('equality')
        ? goalLine({ goal: 'equal', mateIn: null }, side, t, tn)
        : t(side === 'w' ? 'library.goal.win_w' : 'library.goal.win_b');
  const solved = s.phase === 'solved' || s.phase === 'advancing';
  const step = solutionStepOf(s);
  const noteText = note === 'missed' ? t('library.missed_note') : note === 'hint' ? t('library.hint_note') : note === 'solution' ? t('library.solution_note') : null;
  const looks = blockIds.map((id) => {
    const r = results.get(id);
    return id === puzzleId && !r ? 'now' : r === 'clean' ? 'right' : r ? 'wrong' : 'rest';
  }) as ('now' | 'right' | 'wrong' | 'rest')[];

  return {
    t,
    controller,
    s,
    onMove,
    boardRef,
    tracker,
    target,
    close,
    side,
    goal,
    solved,
    step,
    noteText,
    looks,
    chip: t('woodpecker.solve_chip', { n: cycle, done: results.size, total: ids.length }),
    position: t('woodpecker.position', { n: Math.max(0, index) + 1, total: ids.length, block: block + 1 }),
  };
}

export function WoodpeckerSolveScreen({ setId, cycle, start }: { setId: string; cycle: number; start: number }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const q = useWoodpeckerSet(setId);
  if (!q.data) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="woodpecker-solve">
        {q.isPending ? (
          <ActivityIndicator color={eos.ash} />
        ) : (
          <>
            <AppText variant="body" color={eos.ash} style={styles.centerText}>
              {t('woodpecker.missing')}
            </AppText>
            <PlateButton testID="woodpecker-solve-back" label={t('woodpecker.back_set')} variant="slate" size="sm" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }
  return <Runner set={q.data} cycle={cycle} start={start} />;
}

const DASH_BG = { now: eos.bone, right: tone.sageDeep, wrong: alpha(tone.rose, 0.7), rest: tone.ringTrack } as const;

function Runner({ set, cycle, start }: { set: WoodpeckerSet; cycle: number; start: number }) {
  const insets = useSafeAreaInsets();
  const r = useWoodpeckerRunner(set, cycle, start);
  const { t, controller, s, step } = r;
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(space[6], insets.bottom) }]} testID="woodpecker-solve">
      <FocusStatusBar />
      <View style={styles.header}>
        <Tap testID="woodpecker-solve-exit" accessibilityRole="button" accessibilityLabel={t('woodpecker.exit_a11y')} onPress={r.close} style={styles.exit}>
          <ChevronLeft size={18} color={eos.ash} strokeWidth={1.8} />
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('woodpecker.back_set')}
          </AppText>
        </Tap>
        <View style={styles.flex} />
        <View style={[styles.chip, styles.cycleChip]}>
          <AppText variant="captionStrong" color={tone.roseSoft} style={styles.tabular} testID="woodpecker-cycle-chip">
            {r.chip}
          </AppText>
        </View>
        <PuzzleClock tracker={r.tracker} target={r.target} />
      </View>

      <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {r.looks.map((look, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: DASH_BG[look] }]} />
        ))}
      </View>

      <View style={styles.turn}>
        <View style={[styles.side, { backgroundColor: r.side === 'w' ? eos.bone : tone.iron }]} />
        <View style={styles.flex}>
          <AppText variant="navTitle" numberOfLines={1} color={r.solved ? tone.sage : undefined} testID="woodpecker-goal">
            {r.solved ? t('review.solved') : r.goal}
          </AppText>
          <AppText variant="caption" color={eos.ash} numberOfLines={1} testID="woodpecker-position">
            {r.position}
          </AppText>
        </View>
      </View>

      <PracticeBoard controller={controller} boardRef={r.boardRef} onMove={r.onMove} loading={s.phase === 'idle' || s.phase === 'advancing'} />

      <View style={styles.noteLine}>
        {r.noteText ? (
          <AppText variant="caption" color={tone.rose} numberOfLines={1} testID="woodpecker-note">
            {r.noteText}
          </AppText>
        ) : null}
      </View>

      <View style={styles.flex} />
      {step ? (
        <View style={styles.solution}>
          <SolutionStepper
            ply={step.ply}
            maxPly={step.maxPly}
            onStep={(delta, source) => controller.dispatch({ type: 'step', delta, source })}
            onSeek={(ply) => controller.dispatch({ type: 'seek', ply })}
            t={t}
          />
          <PlateButton testID="woodpecker-next" label={t('library.next')} size="md" block onPress={() => controller.dispatch({ type: 'skip' })} />
        </View>
      ) : (
        <View style={styles.bottom}>
          <View style={styles.flex}>
            <PlateButton
              testID="woodpecker-hint"
              label={t('review.hint')}
              variant="slate"
              size="md"
              block
              icon={<Lightbulb size={18} color={s.hintLevel > 0 ? eos.ember : eos.bone} strokeWidth={1.8} />}
              disabled={!canHint(s)}
              onPress={() => controller.dispatch({ type: 'hint' })}
            />
          </View>
          <Tap
            testID="woodpecker-show-solution"
            accessibilityRole="button"
            accessibilityLabel={t('library.show_solution')}
            disabled={s.phase !== 'playerTurn' && s.phase !== 'rewinding'}
            onPress={() => controller.dispatch({ type: 'showSolution' })}
            style={styles.solutionBtn}
          >
            <AppText variant="bodyStrong" color={eos.ash}>
              {t('library.show_solution')}
            </AppText>
          </Tap>
        </View>
      )}
      {E2E && <PracticeE2EStrip controller={controller} state={s} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  exit: { height: layout.headerButton, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  chip: { height: 26, paddingHorizontal: space[2.5], borderRadius: radii.full, flexDirection: 'row', alignItems: 'center' },
  cycleChip: { backgroundColor: alpha(eos.ember, 0.18) },
  segments: { paddingHorizontal: layout.gutter, paddingTop: space[1], flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 4, borderRadius: radii.full },
  turn: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: layout.gutter, paddingTop: space[3.5], paddingBottom: space[2.5] },
  side: { width: 14, height: 14, borderRadius: 3 },
  noteLine: { height: space[6], justifyContent: 'center', paddingHorizontal: layout.gutter },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], paddingHorizontal: layout.gutter },
  solutionBtn: { flex: 1, height: space[12], alignItems: 'center', justifyContent: 'center' },
  solution: { paddingHorizontal: layout.gutter, gap: space[3] },
});
