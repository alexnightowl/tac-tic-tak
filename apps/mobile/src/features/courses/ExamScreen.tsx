import { examOutcome, localized, type Course, type LibraryResult } from '@tac/core/library';
import { alpha, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router, usePreventRemove } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCourseContent, useCourseProgress } from '@/features/library/model';
import { PuzzleClock, ResultTracker, toItem } from '@/features/library/SolveScreen';
import { libraryStore } from '@/features/library/store';
import { requestLibrarySync } from '@/features/library/sync';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import type { PracticeHooks } from '@/features/review/practice/PracticeController';
import { usePractice } from '@/features/review/practice/usePractice';
import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { AppText, confirm, PlateButton, useLang } from '@/ui';
import { useT } from '@/ui/lang';
import { courseHref } from './model';
import { BackLink, Segments, type SegmentLook } from './parts';
import { solveStyles, TurnLine } from './SolveScreen';

// /course/exam?course (canvas LearnExam): 30 mixed puzzles, the theme
// hidden, no hint and no solution; only Skip (= missed). Opens only when
// every chapter of the cycle is done. Each answer is a Library attempt
// (the server keeps the first per puzzle and cycle, so a retake's answers
// may be dropped there; expected) and also lands in this try's own tally,
// which scores the try at the end (examOutcome) and is queued as an exam
// record. Leaving mid-way asks first and drops the try (attempts stay).

export function ExamScreen({ courseId }: { courseId: string }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { course, loading } = useCourseContent(courseId);
  const progress = useCourseProgress(course);
  if (!course || !progress) {
    return (
      <View style={[solveStyles.root, styles.center, { paddingTop: insets.top }]} testID="course-exam">
        {loading || course ? <ActivityIndicator color={eos.ash} /> : <Closed text={t('courses.needs_download')} />}
      </View>
    );
  }
  return <Gate course={course} open={progress.examOpen} cycle={progress.cycle} />;
}

/** The gate is read once, at entry: finishing the exam must not flip it mid-screen. */
function Gate({ course, open, cycle }: { course: Course; open: boolean; cycle: number }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [gate] = useState(() => ({ open, cycle }));
  if (!gate.open) {
    return (
      <View style={[solveStyles.root, styles.center, { paddingTop: insets.top }]} testID="course-exam">
        <Closed text={t('courses.exam_closed')} />
      </View>
    );
  }
  return <Exam course={course} cycle={gate.cycle} />;
}

function Closed({ text }: { text: string }) {
  const t = useT();
  return (
    <>
      <AppText variant="body" color={eos.ash} style={styles.centerText} testID="course-exam-closed">
        {text}
      </AppText>
      <PlateButton testID="course-exam-back" label={t('courses.done.back')} variant="slate" size="sm" onPress={() => router.back()} />
    </>
  );
}

/** One exam try on the runner: shared by the phone Exam and the desktop web layout. */
export function useExamRunner(course: Course, cycle: number) {
  const t = useT();
  const { lang } = useLang();
  const exam = course.exam;
  const [results, setResults] = useState<Record<string, LibraryResult>>({});
  // This try's own tally (a retake's attempts may be dropped by the server's first-wins rule).
  const [tally] = useState(() => new Map<string, LibraryResult>());
  const [tracker] = useState(
    () =>
      new ResultTracker(course.id, cycle, (id, r) => {
        tally.set(id, r);
        setResults(Object.fromEntries(tally));
      }),
  );
  const hooks = useMemo<PracticeHooks>(
    () => ({
      advance: async (puzzleId) => {
        const i = exam.puzzles.findIndex((p) => p.id === puzzleId);
        const next = exam.puzzles[i + 1];
        return next ? toItem(next) : null;
      },
    }),
    [exam],
  );
  const { controller, state: s, onMove, boardRef } = usePractice('library', hooks);
  const { note } = useSyncExternalStore(tracker.subscribe, tracker.getSnap);
  const finished = useRef(false);

  // Back, hardware back and gestures ask first; the try is dropped on leave.
  const [guard, setGuard] = useState(true);
  const allowLeave = usePreventRemove(guard, ({ repeat }) => {
    confirm({
      testID: 'exam-leave',
      title: t('courses.exam_leave_title'),
      body: t('courses.exam_leave_body'),
      confirmLabel: t('courses.exam_leave'),
      cancelLabel: t('courses.exam_stay'),
      onConfirm: () => {
        setGuard(false);
        repeat();
      },
    });
  });
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(courseHref.page(course.id));
  };

  useEffect(() => {
    const off = controller.subscribe(() => tracker.onState(controller.getState()));
    const first = exam.puzzles[0];
    if (first) controller.dispatch({ type: 'start', items: [toItem(first)] });
    return off;
  }, [controller, tracker]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (s.phase !== 'done' || finished.current) return;
    finished.current = true;
    const o = examOutcome(exam.puzzles, Object.fromEntries(tally), exam.passMark);
    const takenAt = new Date().toISOString();
    libraryStore.getState().enqueueExam({ courseId: course.id, cycle, score: o.score, total: o.total, passed: o.passed, byTheme: o.byTheme, takenAt });
    void requestLibrarySync('runner');
    allowLeave();
    router.replace(o.passed ? courseHref.certificate(course.id, takenAt) : courseHref.result(course.id, takenAt));
  }, [s.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving flushes the answers already given.
  useEffect(() => () => void requestLibrarySync('runner'), []);

  const puzzleId = s.item?.puzzle.id ?? null;
  const pIndex = exam.puzzles.findIndex((p) => p.id === puzzleId);
  const answered = Object.keys(results).length;
  const right = Object.values(results).filter((r) => r === 'clean').length;
  const looks: SegmentLook[] = exam.puzzles.map((p) => {
    const r = results[p.id];
    return r === 'clean' ? 'right' : r ? 'wrong' : p.id === puzzleId ? 'now' : 'rest';
  });
  const side = s.playerColor;

  return { t, lang, exam, controller, s, onMove, boardRef, tracker, note, leave, puzzleId, pIndex, answered, right, looks, side };
}

function Exam({ course, cycle }: { course: Course; cycle: number }) {
  const insets = useSafeAreaInsets();
  const { t, lang, exam, controller, s, onMove, boardRef, tracker, note, leave, pIndex, answered, right, looks, side } = useExamRunner(course, cycle);

  return (
    <View style={[solveStyles.root, { paddingTop: insets.top, paddingBottom: Math.max(space[6], insets.bottom) }]} testID="course-exam">
      <FocusStatusBar />
      <View style={solveStyles.header}>
        <BackLink testID="course-exam-exit" label={t('courses.exam_back')} a11y={t('courses.exit_a11y')} onPress={leave} />
        <View style={solveStyles.flex} />
        <View style={[solveStyles.chip, styles.examChip]}>
          <AppText variant="captionStrong" color={tone.gold} style={solveStyles.caps} testID="course-exam-chip">
            {t('courses.exam_chip')}
          </AppText>
        </View>
        <PuzzleClock tracker={tracker} target={null} />
      </View>

      <Segments looks={looks} gap={2} testID="course-exam-segments" label={t('courses.exam_score_a11y', { right, answered })} />

      <TurnLine
        side={side}
        title={t(side === 'w' ? 'courses.goal.move_w' : 'courses.goal.move_b')}
        sub={t('courses.exam_position', { n: Math.max(0, pIndex) + 1, total: exam.count })}
      />

      <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={s.phase === 'idle' || s.phase === 'advancing'} />

      <View style={solveStyles.noteLine}>
        {note === 'missed' ? (
          <AppText variant="caption" color={tone.rose} numberOfLines={1} testID="course-note">
            {t('library.missed_note')}
          </AppText>
        ) : null}
      </View>

      <View style={styles.note} testID="course-exam-note">
        <Star size={18} color={tone.gold} strokeWidth={1.8} />
        <AppText variant="caption" color={tone.goldInk} style={[solveStyles.flex, styles.noteText]}>
          {t('courses.exam_note', { course: localized(course.title, lang), pass: exam.passMark, total: exam.count })}
        </AppText>
        <AppText variant="captionStrong" style={styles.score} testID="course-exam-score" accessibilityLabel={t('courses.exam_score_a11y', { right, answered })}>
          {`${right}/${answered}`}
        </AppText>
      </View>

      <View style={solveStyles.flex} />
      <View style={styles.bottom}>
        <PlateButton
          testID="course-exam-skip"
          label={t('library.skip')}
          accessibilityLabel={t('library.skip_a11y')}
          variant="slate"
          size="md"
          block
          disabled={s.phase !== 'playerTurn' && s.phase !== 'rewinding'}
          onPress={() => {
            tracker.skip();
            controller.dispatch({ type: 'skip' });
          }}
        />
      </View>
      {E2E && <PracticeE2EStrip controller={controller} state={s} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  examChip: { backgroundColor: alpha(tone.gold, 0.16) },
  note: {
    marginHorizontal: layout.gutter,
    paddingHorizontal: space[3.5],
    paddingVertical: space[3],
    borderRadius: radii.xl,
    backgroundColor: alpha(tone.gold, 0.07),
    borderWidth: 1,
    borderColor: alpha(tone.gold, 0.25),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2.5],
  },
  noteText: { fontSize: 12.5, lineHeight: 18 },
  score: { fontSize: 13, fontVariant: ['tabular-nums'] },
  bottom: { paddingHorizontal: layout.gutter },
});
