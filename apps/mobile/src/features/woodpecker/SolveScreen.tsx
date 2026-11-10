import type { WoodpeckerPuzzle, WoodpeckerSet } from '@tac/core/api';
import { woodpeckerPlan, woodpeckerQueue, WOODPECKER_BLOCK, type LibraryResult, type WoodpeckerToday } from '@tac/core/library';
import { solutionStepOf } from '@tac/core/runner';
import { alpha, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Bird, Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { attemptsOf, libraryStore, useAttempts } from '@/features/library/store';
import { ResultTracker, toItem } from '@/features/library/SolveScreen';
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
import { daysText } from './model';

// /woodpecker/solve?set&cycle (D41): the set on the Library's practice
// runner, as the book has it: no clock, no hint, no motif or "mate in N"
// named (only whose move it is). A wrong move shows the solution at once
// (a miss, then on). Each result is queued once as clean / missed by the
// ResultTracker with bookId = the set id. The chip on the right is the
// day's portion; reaching it says so once. The cycle's last result ends
// the run with a toast and goes back to the set page.

const asItem = (p: WoodpeckerPuzzle) => toItem({ ...p, moves: p.moves.split(' ') });

function doneIn(setId: string, cycle: number): Set<string> {
  return new Set(
    attemptsOf(libraryStore.getState())
      .filter((a) => a.bookId === setId && a.cycle === cycle)
      .map((a) => a.puzzleId),
  );
}

/** The set's runner: shared by the phone screen and the desktop board screen. */
export function useWoodpeckerRunner(set: WoodpeckerSet, cycle: number) {
  const t = useT();
  const tn = useTn();
  const ids = useMemo(() => set.puzzles.map((p) => p.id), [set]);
  const byId = useMemo(() => new Map(set.puzzles.map((p) => [p.id, p])), [set]);
  const open = set.method === 'book' && set.closed === false;
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
  const attempts = useAttempts();
  const finished = useRef(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/woodpecker?set=${set.id}` as Href);
  };

  useEffect(() => {
    const off = controller.subscribe(() => {
      const st = controller.getState();
      tracker.onState(st);
      // The book checks the answer against the solution: a wrong move shows it.
      if (st.phase === 'rewinding') queueMicrotask(() => controller.dispatch({ type: 'showSolution' }));
    });
    const id = woodpeckerQueue(ids, doneIn(set.id, cycle), 0)[0];
    const first = id ? byId.get(id) : undefined;
    if (first) controller.dispatch({ type: 'start', items: [asItem(first)] });
    else close();
    return off;
  }, [controller, tracker]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = useMemo(() => woodpeckerPlan(set, attempts, new Date()), [set, attempts]);
  const st = plan.status;
  const today: WoodpeckerToday | null = st.phase === 'first' || st.phase === 'cycle' ? st.today : null;
  const results = useMemo(() => {
    const m = new Map<string, LibraryResult>();
    for (const a of attempts) if (a.bookId === set.id && a.cycle === cycle && !m.has(a.puzzleId)) m.set(a.puzzleId, a.result);
    return m;
  }, [attempts, set.id, cycle]);

  // The day's portion reached during this run: say so once.
  const metAtStart = useRef(today?.met ?? false);
  useEffect(() => {
    if (!today?.met || metAtStart.current) return;
    metAtStart.current = true;
    toast.show({ title: t('woodpecker.today_toast'), description: t('woodpecker.today_toast_sub'), icon: Check });
  }, [today?.met]); // eslint-disable-line react-hooks/exhaustive-deps

  // The cycle's last puzzle: say so and go back to the set page.
  useEffect(() => {
    if (s.phase !== 'done' || finished.current) return;
    finished.current = true;
    const rs = attemptsOf(libraryStore.getState()).filter((a) => a.bookId === set.id && a.cycle === cycle);
    const c = woodpeckerPlan(set, attemptsOf(libraryStore.getState()), new Date()).cycles.find((x) => x.cycle === cycle);
    if (!open && rs.length >= ids.length && c) {
      toast.show({ title: t('woodpecker.cycle_done_toast', { n: cycle }), description: t('woodpecker.cycle_done_toast_sub', { days: daysText(tn, c.days) }), icon: Bird });
    }
    close();
  }, [s.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving flushes what was just played.
  useEffect(() => () => void requestLibrarySync('runner'), []);

  const puzzleId = s.item?.puzzle.id ?? null;
  const index = puzzleId ? ids.indexOf(puzzleId) : -1;
  const block = Math.max(0, Math.floor(Math.max(0, index) / WOODPECKER_BLOCK));
  const blockIds = ids.slice(block * WOODPECKER_BLOCK, (block + 1) * WOODPECKER_BLOCK);
  const side = s.playerColor;
  const solved = s.phase === 'solved' || s.phase === 'advancing';
  const step = solutionStepOf(s);
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
    close,
    side,
    goal: puzzleId ? t(side === 'w' ? 'woodpecker.turn_w' : 'woodpecker.turn_b') : t('play.loading_puzzle'),
    solved,
    step,
    noteText: step && results.get(puzzleId ?? '') !== 'clean' ? t('woodpecker.missed_note') : null,
    looks,
    today,
    todayText: today ? t('woodpecker.today_chip', { done: today.done, goal: today.goal ?? 0 }) : null,
    chip: open ? t('woodpecker.solve_chip_first', { solved: results.size }) : t('woodpecker.solve_chip', { n: cycle, done: results.size, total: ids.length }),
    position: open ? t('woodpecker.position_first', { n: Math.max(0, index) + 1 }) : t('woodpecker.position', { n: Math.max(0, index) + 1, total: ids.length }),
  };
}

export function WoodpeckerSolveScreen({ setId, cycle }: { setId: string; cycle: number }) {
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
  return <Runner set={q.data} cycle={cycle} />;
}

const DASH_BG = { now: eos.bone, right: tone.sageDeep, wrong: alpha(tone.rose, 0.7), rest: tone.ringTrack } as const;

/** The day's portion as a chip (sage once it is met). */
export function TodayChip({ today, text }: { today: WoodpeckerToday; text: string }) {
  return (
    <View style={[styles.chip, today.met ? styles.todayMet : styles.today]} testID="woodpecker-today-chip">
      {today.met ? <Check size={13} color={tone.sage} strokeWidth={2.4} /> : null}
      <AppText variant="captionStrong" color={today.met ? tone.sage : eos.bone} style={styles.tabular}>
        {text}
      </AppText>
    </View>
  );
}

function Runner({ set, cycle }: { set: WoodpeckerSet; cycle: number }) {
  const insets = useSafeAreaInsets();
  const r = useWoodpeckerRunner(set, cycle);
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
        {r.today && r.todayText ? <TodayChip today={r.today} text={r.todayText} /> : null}
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
  chip: { height: 26, paddingHorizontal: space[2.5], borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cycleChip: { backgroundColor: alpha(eos.ember, 0.18) },
  today: { backgroundColor: eos.rise, marginRight: space[2] },
  todayMet: { backgroundColor: alpha(tone.sageDeep, 0.16), marginRight: space[2] },
  segments: { paddingHorizontal: layout.gutter, paddingTop: space[1], flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 4, borderRadius: radii.full },
  turn: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: layout.gutter, paddingTop: space[3.5], paddingBottom: space[2.5] },
  side: { width: 14, height: 14, borderRadius: 3 },
  noteLine: { height: space[6], justifyContent: 'center', paddingHorizontal: layout.gutter },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], paddingHorizontal: layout.gutter },
  solutionBtn: { flex: 1, height: space[12], alignItems: 'center', justifyContent: 'center' },
  solution: { paddingHorizontal: layout.gutter, gap: space[3] },
});
