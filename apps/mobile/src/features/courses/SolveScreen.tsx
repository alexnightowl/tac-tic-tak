import { bookProgress, courseShape, cycleTargetSec, localized, type Course, type CoursePuzzle } from '@tac/core/library';
import { canHint, solutionStepOf, type PracticeState } from '@tac/core/runner';
import { alpha, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router } from 'expo-router';
import { Lightbulb } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCourseContent } from '@/features/library/model';
import { PuzzleClock, ResultTracker, toItem } from '@/features/library/SolveScreen';
import { attemptsOf, libraryStore, useAttempts } from '@/features/library/store';
import { requestLibrarySync } from '@/features/library/sync';
import { SolutionStepper } from '@/features/puzzles/SolutionStepper';
import { ThemeIcon } from '@/features/review/ThemeIcon';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import type { PracticeHooks } from '@/features/review/practice/PracticeController';
import { usePractice } from '@/features/review/practice/usePractice';
import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { AppText, PlateButton, Tap, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { ChapterIntro } from './IntroScreen';
import { courseHref, goalLine } from './model';
import { BackLink, Segments, type SegmentLook } from './parts';
import { courseTones } from './tones';

// /course/solve?course&chapter&cycle (canvas LearnSolve): a course chapter
// on the book runner (practice runner, `library` mode). Results queue and
// sync exactly as a book's (bookId = the course id): clean, hint, or
// missed (a wrong move or the solution shown); misses go to Review.
// The theme card's "Intro" link reopens the chapter intro over the board.

/** The chapter's puzzles still without a result in this cycle, read at call time. */
function pendingIn(courseId: string, puzzles: readonly CoursePuzzle[], cycle: number): CoursePuzzle[] {
  const done = new Set(
    attemptsOf(libraryStore.getState())
      .filter((a) => a.bookId === courseId && a.cycle === cycle)
      .map((a) => a.puzzleId),
  );
  return puzzles.filter((p) => !done.has(p.id));
}

export function CourseSolveScreen({ courseId, chapter, cycle }: { courseId: string; chapter: number; cycle: number }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { course, loading } = useCourseContent(courseId);
  if (!course || !course.chapters[chapter]) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="course-solve">
        {loading ? (
          <ActivityIndicator color={eos.ash} />
        ) : (
          <>
            <AppText variant="body" color={eos.ash} style={styles.centerText}>
              {t('courses.needs_download')}
            </AppText>
            <PlateButton testID="course-solve-back" label={t('courses.done.back')} variant="slate" size="sm" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }
  return <Runner course={course} chapterIndex={chapter} cycle={cycle} />;
}

function Runner({ course, chapterIndex, cycle }: { course: Course; chapterIndex: number; cycle: number }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const chapter = course.chapters[chapterIndex];
  const tones = courseTones(course.color);
  const [tracker] = useState(() => new ResultTracker(course.id, cycle));
  const hooks = useMemo<PracticeHooks>(
    () => ({
      advance: async (puzzleId) => {
        const left = pendingIn(course.id, chapter.puzzles, cycle).filter((p) => p.id !== puzzleId);
        return left[0] ? toItem(left[0]) : null;
      },
    }),
    [course.id, chapter, cycle],
  );
  const { controller, state: s, onMove, boardRef } = usePractice('library', hooks);
  const { note } = useSyncExternalStore(tracker.subscribe, tracker.getSnap);
  const attempts = useAttempts();
  const finished = useRef(false);
  const [intro, setIntro] = useState(false);

  const doneHref = courseHref.done(course.id, chapterIndex, cycle);

  useEffect(() => {
    const off = controller.subscribe(() => tracker.onState(controller.getState()));
    const first = pendingIn(course.id, chapter.puzzles, cycle)[0];
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

  const progress = useMemo(() => bookProgress(courseShape(course), attempts), [course, attempts]);
  const target = cycleTargetSec(progress.cycles, cycle);
  const done = useMemo(() => {
    const m = new Set<string>();
    for (const a of attempts) if (a.bookId === course.id && a.cycle === cycle) m.add(a.puzzleId);
    return m;
  }, [attempts, course.id, cycle]);

  const puzzleId = s.item?.puzzle.id ?? null;
  const pIndex = chapter.puzzles.findIndex((p) => p.id === puzzleId);
  const puzzle = pIndex >= 0 ? chapter.puzzles[pIndex] : null;
  const title = localized(chapter.title, lang);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(courseHref.page(course.id));
  };

  const side = s.playerColor;
  const solved = s.phase === 'solved' || s.phase === 'advancing';
  const step = solutionStepOf(s);
  const noteText = note === 'missed' ? t('library.missed_note') : note === 'hint' ? t('library.hint_note') : note === 'solution' ? t('library.solution_note') : null;
  const looks: SegmentLook[] = chapter.puzzles.map((p) => (done.has(p.id) ? 'right' : p.id === puzzleId ? 'now' : 'rest'));
  const doneCount = chapter.puzzles.filter((p) => done.has(p.id)).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(space[6], insets.bottom) }]} testID="course-solve">
      <FocusStatusBar />
      <View style={styles.header}>
        <BackLink testID="course-solve-exit" label={t('courses.ch_short', { n: chapterIndex + 1 })} a11y={t('courses.exit_a11y')} onPress={close} />
        <View style={styles.flex} />
        <View style={[styles.chip, { backgroundColor: tones.tint(0.18) }]}>
          <AppText variant="captionStrong" color={tones.chip} style={styles.caps} testID="course-cycle-chip">
            {t('courses.cycle_chip', { n: cycle })}
          </AppText>
        </View>
        <PuzzleClock tracker={tracker} target={target} />
      </View>

      <Segments looks={looks} testID="course-segments" label={t('courses.progress_a11y', { done: doneCount, total: chapter.puzzles.length })} />

      <TurnLine
        side={side}
        title={solved ? t('review.solved') : goalLine(puzzle, side, t, tn)}
        solved={solved}
        sub={t('courses.position', { title, n: Math.max(0, pIndex) + 1, total: chapter.puzzles.length })}
      />

      <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={s.phase === 'idle' || s.phase === 'advancing'} />

      <View style={styles.noteLine}>
        {noteText ? (
          <AppText variant="caption" color={tone.rose} numberOfLines={1} testID="course-note">
            {noteText}
          </AppText>
        ) : null}
      </View>

      <View style={styles.theme} testID="course-theme-card">
        <View style={styles.themeIcon}>
          <ThemeIcon slug={chapter.theme} size={22} color={tones.ink} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" style={styles.themeTitle}>
            {title}
          </AppText>
          <AppText variant="caption" color={tone.mist} style={styles.themeTip}>
            {localized(chapter.tip, lang)}
          </AppText>
        </View>
        <Tap testID="course-intro-link" accessibilityRole="button" accessibilityLabel={t('courses.intro_link_a11y')} onPress={() => setIntro(true)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <AppText variant="captionStrong" color={eos.ash}>
            {t('courses.intro_link')}
          </AppText>
        </Tap>
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
          <PlateButton testID="course-next" label={t('library.next')} size="md" block onPress={() => controller.dispatch({ type: 'skip' })} />
        </View>
      ) : (
        <View style={styles.bottom}>
          <View style={styles.flex}>
            <PlateButton
              testID="course-hint"
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
            testID="course-show-solution"
            accessibilityRole="button"
            accessibilityLabel={t('library.show_solution')}
            disabled={s.phase !== 'playerTurn' && s.phase !== 'rewinding'}
            onPress={() => controller.dispatch({ type: 'showSolution' })}
            style={styles.textBtn}
          >
            <AppText variant="bodyStrong" color={eos.ash}>
              {t('library.show_solution')}
            </AppText>
          </Tap>
        </View>
      )}
      {E2E && <PracticeE2EStrip controller={controller} state={s} />}

      {intro ? (
        <View style={StyleSheet.absoluteFill}>
          <ChapterIntro
            course={course}
            chapter={chapterIndex}
            backLabel={t('courses.ch_short', { n: chapterIndex + 1 })}
            onBack={() => setIntro(false)}
            cta={t('courses.intro_back_to_puzzle')}
            onCta={() => setIntro(false)}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The side square, the goal (Cinzel 19) and the line under it; shared with the exam. */
export function TurnLine({ side, title, sub, solved = false }: { side: PracticeState['playerColor']; title: string; sub: string; solved?: boolean }) {
  return (
    <View style={styles.turn}>
      <View style={[styles.side, { backgroundColor: side === 'w' ? eos.bone : tone.iron }]} />
      <View style={styles.flex}>
        <AppText variant="navTitle" numberOfLines={1} adjustsFontSizeToFit color={solved ? tone.sage : undefined} testID="course-goal" style={styles.goal}>
          {title}
        </AppText>
        <AppText variant="caption" color={eos.ash} numberOfLines={1} testID="course-position" style={styles.sub}>
          {sub}
        </AppText>
      </View>
    </View>
  );
}

export const solveStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  chip: { height: 26, paddingHorizontal: space[2.5], borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: 5 },
  caps: { textTransform: 'uppercase' },
  flex: { flex: 1, minWidth: 0 },
  noteLine: { height: space[6], justifyContent: 'center', paddingHorizontal: layout.gutter },
});

const styles = StyleSheet.create({
  ...solveStyles,
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  turn: { height: 70, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: layout.gutter, paddingTop: space[3.5], paddingBottom: space[2.5] },
  side: { width: 14, height: 14, borderRadius: 3 },
  goal: { fontSize: 19 },
  sub: { marginTop: space[0.5], fontSize: 12.5 },
  theme: {
    marginHorizontal: layout.gutter,
    paddingHorizontal: space[3.5],
    paddingVertical: space[3],
    borderRadius: radii.xl,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: alpha(eos.bone, 0.05),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  themeIcon: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  themeTitle: { fontSize: 13.5 },
  themeTip: { marginTop: 1 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], paddingHorizontal: layout.gutter },
  textBtn: { flex: 1, height: space[12], alignItems: 'center', justifyContent: 'center' },
  solution: { paddingHorizontal: layout.gutter, gap: space[3] },
});
