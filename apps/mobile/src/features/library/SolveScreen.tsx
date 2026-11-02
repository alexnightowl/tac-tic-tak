import {
  bookProgress,
  cycleTargetSec,
  LIBRARY_MAX_TIME_MS,
  localized,
  type LibraryBook,
  type LibraryPuzzle,
  type LibraryResult,
} from '@tac/core/library';
import { formatLocalDate } from '@tac/core/format';
import { canHint, solutionStepOf, type PracticeItem, type PracticeState } from '@tac/core/runner';
import { alpha, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { BookOpen, ChevronLeft, Clock, Lightbulb } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SolutionStepper } from '@/features/puzzles/SolutionStepper';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import type { PracticeHooks } from '@/features/review/practice/PracticeController';
import { usePractice } from '@/features/review/practice/usePractice';
import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { AppText, PlateButton, Tap, useLang } from '@/ui';
import { plural } from '@/features/offline/format';
import { useT, useTn } from '@/ui/lang';
import { roman, useBookContent } from './model';
import { attemptsOf, libraryStore, useAttempts } from './store';
import { requestLibrarySync } from './sync';

// /library/solve?book&chapter&cycle (canvas LibSolve): a chapter of a
// book on the practice runner in `library` mode. Each puzzle's result is
// queued once, when it ends: clean (no hint, no wrong move), hint, or
// missed (a wrong move or the solution shown). Time counts from the
// player's first turn. Not rated; hint / missed go to Review on sync.

export type Note = 'missed' | 'hint' | 'solution' | null;

/** The runner item for a book or course puzzle (shared with features/courses). */
export const toItem = (p: Pick<LibraryPuzzle, 'id' | 'fen' | 'moves' | 'rating' | 'themes'>): PracticeItem => ({
  puzzle: { id: p.id, fen: p.fen, moves: p.moves, rating: p.rating, themes: p.themes, gameUrl: null },
});

export type TrackerSnap = { id: string | null; startedAt: number; endedAt: number; note: Note };

/**
 * Watches the runner and queues each puzzle's result once. Plain class: it
 * runs from the controller listener. Screens read it only through the
 * immutable `snap` (useSyncExternalStore), never its fields: the React
 * Compiler would cache a method call on a stable object.
 */
export class ResultTracker {
  id: string | null = null;
  startedAt = 0;
  endedAt = 0;
  private result: LibraryResult = 'clean';
  private note: Note = null;
  private snap: TrackerSnap = { id: null, startedAt: 0, endedAt: 0, note: null };
  private listeners = new Set<() => void>();

  constructor(
    private readonly bookId: string,
    private readonly cycle: number,
    /** Each result as it is queued (the course exam keeps its own tally). */
    private readonly onRecord?: (puzzleId: string, result: LibraryResult) => void,
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnap = (): TrackerSnap => this.snap;

  onState = (s: PracticeState) => {
    const id = s.item?.puzzle.id ?? null;
    if (id !== this.id) {
      this.id = id;
      this.startedAt = 0;
      this.endedAt = 0;
      this.result = 'clean';
      this.note = null;
      this.emit();
    }
    if (!id || this.endedAt) return;
    if (s.phase === 'playerTurn' && this.startedAt === 0) {
      this.startedAt = Date.now();
      this.emit();
    }
    if (s.hintLevel > 0 && this.result === 'clean') {
      this.result = 'hint';
      this.setNote('hint');
    }
    if (s.phase === 'rewinding' && this.result !== 'missed') {
      this.result = 'missed';
      this.setNote('missed');
    }
    if (s.phase === 'solution') {
      this.result = 'missed';
      this.setNote('solution');
      this.record();
    } else if (s.phase === 'solved') {
      this.record();
    }
  };

  /** Exam Skip: the puzzle on the board is missed. */
  skip = () => {
    if (!this.id || this.endedAt) return;
    this.result = 'missed';
    this.note = 'missed';
    this.record();
  };

  private record() {
    if (!this.id) return;
    const now = Date.now();
    this.endedAt = now;
    libraryStore.getState().enqueue({
      bookId: this.bookId,
      puzzleId: this.id,
      cycle: this.cycle,
      result: this.result,
      timeMs: this.startedAt ? Math.min(LIBRARY_MAX_TIME_MS, now - this.startedAt) : 0,
      solvedAt: new Date(now).toISOString(),
      localDay: formatLocalDate(new Date(now)),
    });
    this.onRecord?.(this.id, this.result);
    this.emit();
    void requestLibrarySync('runner');
  }

  private setNote(note: Note) {
    if (note === this.note) return;
    this.note = note;
    this.emit();
  }

  private emit() {
    this.snap = { id: this.id, startedAt: this.startedAt, endedAt: this.endedAt, note: this.note };
    for (const fn of this.listeners) fn();
  }
}

/** The chapter's puzzles still without a result in this cycle, read at call time. */
function pendingIn(bookId: string, puzzles: readonly LibraryPuzzle[], cycle: number): LibraryPuzzle[] {
  const done = new Set(
    attemptsOf(libraryStore.getState())
      .filter((a) => a.bookId === bookId && a.cycle === cycle)
      .map((a) => a.puzzleId),
  );
  return puzzles.filter((p) => !done.has(p.id));
}

export function LibrarySolveScreen({ bookId, chapter, cycle }: { bookId: string; chapter: number; cycle: number }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { book, loading } = useBookContent(bookId);
  if (!book || !book.chapters[chapter]) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="library-solve">
        {loading ? (
          <ActivityIndicator color={eos.ash} />
        ) : (
          <>
            <AppText variant="body" color={eos.ash} style={styles.centerText}>
              {t('library.needs_download')}
            </AppText>
            <PlateButton testID="library-solve-back" label={t('library.done.back')} variant="slate" size="sm" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }
  return <Runner book={book} chapterIndex={chapter} cycle={cycle} />;
}

function Runner({ book, chapterIndex, cycle }: { book: LibraryBook; chapterIndex: number; cycle: number }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const chapter = book.chapters[chapterIndex];
  const [tracker] = useState(() => new ResultTracker(book.id, cycle));
  const hooks = useMemo<PracticeHooks>(
    () => ({
      advance: async (puzzleId) => {
        const left = pendingIn(book.id, chapter.puzzles, cycle).filter((p) => p.id !== puzzleId);
        return left[0] ? toItem(left[0]) : null;
      },
    }),
    [book.id, chapter, cycle],
  );
  const { controller, state: s, onMove, boardRef } = usePractice('library', hooks);
  const { note } = useSyncExternalStore(tracker.subscribe, tracker.getSnap);
  const attempts = useAttempts();
  const finished = useRef(false);

  const doneHref = `/library/done?book=${book.id}&chapter=${chapterIndex}&cycle=${cycle}` as Href;

  useEffect(() => {
    const off = controller.subscribe(() => tracker.onState(controller.getState()));
    const first = pendingIn(book.id, chapter.puzzles, cycle)[0];
    if (first) controller.dispatch({ type: 'start', items: [toItem(first)] });
    else router.replace(doneHref);
    return off;
  }, [controller, tracker]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (s.phase === 'done' && !finished.current) {
      finished.current = true;
      router.replace(doneHref);
    }
  }, [s.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving flushes what was just played.
  useEffect(() => () => void requestLibrarySync('runner'), []);

  const progress = useMemo(() => bookProgress(book, attempts), [book, attempts]);
  const target = cycleTargetSec(progress.cycles, cycle);
  const results = useMemo(() => {
    const m = new Map<string, LibraryResult>();
    for (const a of attempts) if (a.bookId === book.id && a.cycle === cycle) m.set(a.puzzleId, a.result);
    return m;
  }, [attempts, book.id, cycle]);

  const puzzleId = s.item?.puzzle.id ?? null;
  const pIndex = chapter.puzzles.findIndex((p) => p.id === puzzleId);
  const puzzle = pIndex >= 0 ? chapter.puzzles[pIndex] : null;
  const before = book.chapters.slice(0, chapterIndex).reduce((n, c) => n + c.puzzles.length, 0);
  const total = book.chapters.reduce((n, c) => n + c.puzzles.length, 0);
  const ch = roman(chapterIndex + 1);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/library/${book.id}` as Href);
  };

  const side = s.playerColor;
  const goal = !puzzle
    ? t('play.loading_puzzle')
    : puzzle.goal === 'mate' && puzzle.mateIn
      ? plural(tn, side === 'w' ? 'library.goal.mate_w' : 'library.goal.mate_b', puzzle.mateIn)
      : t(side === 'w' ? 'library.goal.win_w' : 'library.goal.win_b');
  const solved = s.phase === 'solved' || s.phase === 'advancing';
  const step = solutionStepOf(s);
  const noteText = note === 'missed' ? t('library.missed_note') : note === 'hint' ? t('library.hint_note') : note === 'solution' ? t('library.solution_note') : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(space[6], insets.bottom) }]} testID="library-solve">
      <FocusStatusBar />
      <View style={styles.header}>
        <Tap testID="library-solve-exit" accessibilityRole="button" accessibilityLabel={t('library.exit_a11y')} onPress={close} style={styles.exit}>
          <ChevronLeft size={18} color={eos.ash} strokeWidth={1.8} />
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('library.ch_short', { ch })}
          </AppText>
        </Tap>
        <View style={styles.flex} />
        <View style={[styles.chip, styles.cycleChip]}>
          <AppText variant="captionStrong" color={tone.roseSoft} style={styles.caps} testID="library-cycle-chip">
            {t('library.cycle_chip', { n: cycle })}
          </AppText>
        </View>
        <PuzzleClock tracker={tracker} target={target} />
      </View>

      <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {chapter.puzzles.map((p) => {
          const r = results.get(p.id);
          const bg = p.id === puzzleId && !r ? eos.bone : r === 'clean' ? tone.sageDeep : r ? alpha(tone.rose, 0.7) : tone.ringTrack;
          return <View key={p.id} style={[styles.segment, { backgroundColor: bg }]} />;
        })}
      </View>

      <View style={styles.turn}>
        <View style={[styles.side, { backgroundColor: side === 'w' ? eos.bone : tone.iron }]} />
        <View style={styles.flex}>
          <AppText variant="navTitle" numberOfLines={1} color={solved ? tone.sage : undefined} testID="library-goal">
            {solved ? t('review.solved') : goal}
          </AppText>
          <AppText variant="caption" color={eos.ash} numberOfLines={1} testID="library-position">
            {t('library.position', {
              n: before + Math.max(0, pIndex) + 1,
              total,
              ch,
              chapter: localized(chapter.title, lang),
            })}
          </AppText>
        </View>
      </View>

      <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={s.phase === 'idle' || s.phase === 'advancing'} />

      <View style={styles.noteLine}>
        {noteText ? (
          <AppText variant="caption" color={tone.rose} numberOfLines={1} testID="library-note">
            {noteText}
          </AppText>
        ) : null}
      </View>

      {puzzle ? <GameCard puzzle={puzzle} lang={lang} /> : null}

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
          <PlateButton testID="library-next" label={t('library.next')} size="md" block onPress={() => controller.dispatch({ type: 'skip' })} />
        </View>
      ) : chapter.exam ? (
        <View style={styles.bottom}>
          <AppText variant="caption" color={eos.ash} style={styles.flex} testID="library-exam-note">
            {t('library.exam_note')}
          </AppText>
          <Tap
            testID="library-skip"
            accessibilityRole="button"
            accessibilityLabel={t('library.skip_a11y')}
            disabled={s.phase !== 'playerTurn' && s.phase !== 'rewinding'}
            onPress={() => {
              tracker.skip();
              controller.dispatch({ type: 'skip' });
            }}
            style={styles.solutionBtn}
          >
            <AppText variant="bodyStrong" color={eos.ash}>
              {t('library.skip')}
            </AppText>
          </Tap>
        </View>
      ) : (
        <View style={styles.bottom}>
          <View style={styles.flex}>
            <PlateButton
              testID="library-hint"
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
            testID="library-show-solution"
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

function GameCard({ puzzle, lang }: { puzzle: LibraryPuzzle; lang: 'en' | 'uk' }) {
  const t = useT();
  const g = puzzle.game;
  const place = g.site || g.event;
  const where = place ? t('library.game_where', { place, year: g.year }) : String(g.year);
  const note = localized(puzzle.note, lang);
  return (
    <View style={styles.game} testID="library-game">
      <View style={styles.gameIcon}>
        <BookOpen size={18} color={tone.gold} strokeWidth={1.8} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {t('library.game_vs', { white: g.white, black: g.black })}
        </AppText>
        <AppText variant="caption" color={tone.mist} numberOfLines={3} style={styles.gameNote}>
          {note ? `${where} · ${note}` : where}
        </AppText>
      </View>
    </View>
  );
}

export const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** "0:14 / 0:25": this puzzle's time against the cycle target. Re-renders only itself, at 1 Hz. */
export function PuzzleClock({ tracker, target }: { tracker: ResultTracker; target: number | null }) {
  const t = useT();
  const { startedAt, endedAt } = useSyncExternalStore(tracker.subscribe, tracker.getSnap);
  const [now, setNow] = useState(() => Date.now());
  const running = startedAt > 0 && endedAt === 0;
  useEffect(() => {
    if (!running) return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [running, startedAt]);
  const end = endedAt || now;
  const sec = startedAt ? Math.max(0, Math.floor((end - startedAt) / 1000)) : 0;
  const over = target != null && sec > target;
  const time = fmt(sec);
  return (
    <View
      style={[styles.chip, styles.clock]}
      testID="library-clock"
      accessible
      accessibilityLabel={target != null ? t('library.timer_a11y', { time, target: fmt(target) }) : t('library.timer_a11y_free', { time })}
    >
      <Clock size={14} color={over ? tone.rose : eos.bone} strokeWidth={1.8} />
      <AppText variant="captionStrong" color={over ? tone.rose : eos.bone} style={styles.tabular}>
        {target != null ? `${time} / ${fmt(target)}` : time}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  caps: { textTransform: 'uppercase' },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  exit: { height: layout.headerButton, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  chip: { height: 26, paddingHorizontal: space[2.5], borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: 5 },
  cycleChip: { backgroundColor: alpha(eos.ember, 0.18) },
  clock: { backgroundColor: eos.rise, marginRight: space[2] },
  segments: { paddingHorizontal: layout.gutter, paddingTop: space[1], flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 4, borderRadius: radii.full },
  turn: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: layout.gutter, paddingTop: space[3.5], paddingBottom: space[2.5] },
  side: { width: 14, height: 14, borderRadius: 3 },
  noteLine: { height: space[6], justifyContent: 'center', paddingHorizontal: layout.gutter },
  game: {
    marginHorizontal: layout.gutter,
    paddingHorizontal: space[3.5],
    paddingVertical: space[3],
    borderRadius: radii.xl,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: alpha(eos.bone, 0.05),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  gameIcon: { width: space[9], height: space[9], borderRadius: radii.lg, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  gameNote: { marginTop: 1 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], paddingHorizontal: layout.gutter },
  solutionBtn: { flex: 1, height: space[12], alignItems: 'center', justifyContent: 'center' },
  solution: { paddingHorizontal: layout.gutter, gap: space[3] },
});
