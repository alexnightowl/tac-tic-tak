import { localized, type Course, type LibraryBook, type LibraryResult } from '@tac/core/library';
import { canHint, type PracticeState } from '@tac/core/runner';
import { alpha, eos, tone } from '@tac/core/tokens';
import { router } from 'expo-router';
import { BookOpen, ChevronLeft, Lightbulb, Star } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';

import type { BoardHandle, BoardMove } from '@/board';
import { useCourseRunner } from '@/features/courses/SolveScreen';
import { useExamRunner } from '@/features/courses/ExamScreen';
import { ChapterIntro } from '@/features/courses/IntroScreen';
import { goalLine } from '@/features/courses/model';
import { useBookContent, useCourseContent, useCourseProgress } from '@/features/library/model';
import { fmt, useLibraryRunner, usePuzzleClock, type ResultTracker } from '@/features/library/SolveScreen';
import { SolutionStepper } from '@/features/puzzles/SolutionStepper';
import { ThemeIcon } from '@/features/review/ThemeIcon';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import type { PracticeController } from '@/features/review/practice/PracticeController';
import { useRawWindow } from '@/platform/webFrame';
import { PlateButton } from '@/ui';
import { useT, type TFn } from '@/ui/lang';
import { Dialog } from '../Dialog';
import { useHotkeys, type HotkeyMap } from '../hotkeys';
import { DText, GhostButton, Hover, KeyHints } from '../kit';
import { dx } from '../tokens';
import { Card2, ClockText, Dashes, Spacer, TurnCard, type Dash } from './parts';
import { BoardStage, StageMessage } from './Stage';

// Course and book chapters on a desktop-wide window (canvas DXChapterSolve):
// /course/solve, /course/exam and /library/solve. Board left; right the
// way back, the cycle pill and this puzzle's clock, one dash per puzzle,
// the goal, the theme (course) / game (book) / exam card, and hint +
// "show solution" (or the solution stepper, or Skip in an exam). The
// runners are the phone screens' (useCourseRunner, useLibraryRunner,
// useExamRunner).

type Board = {
  controller: PracticeController;
  s: PracticeState;
  onMove: (m: BoardMove) => boolean;
  boardRef: (h: BoardHandle | null) => void;
};

// ── Course chapter ──────────────────────────────────────────────────────

export function DxCourseSolve({ courseId, chapter, cycle, replay = false }: { courseId: string; chapter: number; cycle: number; replay?: boolean }) {
  const t = useT();
  const { course, loading } = useCourseContent(courseId);
  if (!course || !course.chapters[chapter]) {
    return <Missing loading={loading} text={t('courses.needs_download')} back={t('courses.done.back')} testID="course-solve" />;
  }
  return <CourseRunner course={course} chapterIndex={chapter} cycle={cycle} replay={replay} />;
}

function CourseRunner({ course, chapterIndex, cycle, replay }: { course: Course; chapterIndex: number; cycle: number; replay: boolean }) {
  const r = useCourseRunner(course, chapterIndex, cycle, replay);
  const { t, lang, chapter, tones, controller, s, step } = r;
  const { height } = useRawWindow();
  return (
    <>
      <ChapterStage
        testID="course-solve"
        board={{ controller, s, onMove: r.onMove, boardRef: r.boardRef }}
        back={{ label: t('courses.ch_short', { n: chapterIndex + 1 }), a11y: t('courses.exit_a11y'), onPress: r.close, testID: 'course-solve-exit' }}
        chip={{ label: t('courses.cycle_chip', { n: cycle }), color: tones.chip, bg: tones.tint(0.18), testID: 'course-cycle-chip' }}
        tracker={r.tracker}
        target={r.target}
        dashes={{ looks: r.looks, label: t('courses.progress_a11y', { done: r.doneCount, total: chapter.puzzles.length }), testID: 'course-segments' }}
        turn={{
          side: r.side,
          title: r.solved ? t('review.solved') : goalLine(r.puzzle, r.side, t, r.tn),
          solved: r.solved,
          sub: t('courses.position', { title: r.title, n: Math.max(0, r.pIndex) + 1, total: chapter.puzzles.length }),
        }}
        note={r.noteText}
        noteTestID="course-note"
        cards={
          <Card2 style={styles.themeCard} testID="course-theme-card">
            <View style={styles.themeTile}>
              <ThemeIcon slug={chapter.theme} size={20} color={tones.glyph} />
            </View>
            <View style={styles.flex}>
              <DText size={13.5} weight={800}>
                {r.title}
              </DText>
              <DText size={12.5} color={dx.ash}>
                {localized(chapter.tip, lang)}
              </DText>
            </View>
            <Hover testID="course-intro-link" accessibilityLabel={t('courses.intro_link_a11y')} onPress={() => r.setIntro(true)} style={styles.link}>
              <DText size={12.5} weight={700} color={dx.ash}>
                {t('courses.intro_link')}
              </DText>
            </Hover>
          </Card2>
        }
        footer={<SolveFooter controller={controller} s={s} step={step} prefix="course" t={t} />}
        keys={step ? stepKeys(t) : solveKeys(t)}
        hotkeys={solveHotkeys(controller, s, !!step, r.close)}
        hotkeysOn={!r.intro}
      />
      {r.intro ? (
        <Dialog onClose={() => r.setIntro(false)} width={440} testID="course-intro-dialog" style={[styles.introDialog, { height: Math.min(820, height - 60) }]}>
          <ChapterIntro
            course={course}
            chapter={chapterIndex}
            backLabel={t('courses.ch_short', { n: chapterIndex + 1 })}
            onBack={() => r.setIntro(false)}
            cta={t('courses.intro_back_to_puzzle')}
            onCta={() => r.setIntro(false)}
          />
        </Dialog>
      ) : null}
    </>
  );
}

// ── Book chapter ────────────────────────────────────────────────────────

export function DxLibrarySolve({ bookId, chapter, cycle }: { bookId: string; chapter: number; cycle: number }) {
  const t = useT();
  const { book, loading } = useBookContent(bookId);
  if (!book || !book.chapters[chapter]) {
    return <Missing loading={loading} text={t('library.needs_download')} back={t('library.done.back')} testID="library-solve" />;
  }
  return <BookRunner book={book} chapterIndex={chapter} cycle={cycle} />;
}

function BookRunner({ book, chapterIndex, cycle }: { book: LibraryBook; chapterIndex: number; cycle: number }) {
  const r = useLibraryRunner(book, chapterIndex, cycle);
  const { t, lang, chapter, controller, s, step, puzzle } = r;
  const looks: Dash[] = chapter.puzzles.map((p) => {
    const res: LibraryResult | undefined = r.results.get(p.id);
    return p.id === r.puzzleId && !res ? 'now' : res === 'clean' ? 'right' : res ? 'wrong' : 'rest';
  });
  const exam = !!chapter.exam;
  const g = puzzle?.game;
  const place = g ? g.site || g.event : null;
  const where = g ? (place ? t('library.game_where', { place, year: g.year }) : String(g.year)) : '';
  const gameNote = puzzle ? localized(puzzle.note, lang) : '';
  return (
    <ChapterStage
      testID="library-solve"
      board={{ controller, s, onMove: r.onMove, boardRef: r.boardRef }}
      back={{ label: t('library.ch_short', { ch: r.ch }), a11y: t('library.exit_a11y'), onPress: r.close, testID: 'library-solve-exit' }}
      chip={{ label: t('library.cycle_chip', { n: cycle }), color: tone.roseSoft, bg: alpha(eos.ember, 0.18), testID: 'library-cycle-chip' }}
      tracker={r.tracker}
      target={r.target}
      dashes={{ looks, label: t('library.position', { n: r.before + Math.max(0, r.pIndex) + 1, total: r.total, ch: r.ch, chapter: localized(chapter.title, lang) }), testID: 'library-segments' }}
      turn={{
        side: r.side,
        title: r.solved ? t('review.solved') : r.goal,
        solved: r.solved,
        sub: t('library.position', { n: r.before + Math.max(0, r.pIndex) + 1, total: r.total, ch: r.ch, chapter: localized(chapter.title, lang) }),
      }}
      note={r.noteText}
      noteTestID="library-note"
      cards={
        g ? (
          <Card2 style={styles.themeCard} testID="library-game">
            <View style={[styles.themeTile, styles.gameTile]}>
              <BookOpen size={18} color={tone.gold} strokeWidth={1.8} />
            </View>
            <View style={styles.flex}>
              <DText size={13.5} weight={800} numberOfLines={1}>
                {t('library.game_vs', { white: g.white, black: g.black })}
              </DText>
              <DText size={12.5} color={dx.ash} numberOfLines={3}>
                {gameNote ? `${where} · ${gameNote}` : where}
              </DText>
            </View>
          </Card2>
        ) : null
      }
      footer={
        exam && !step ? (
          <ExamSkip
            note={t('library.exam_note')}
            noteTestID="library-exam-note"
            testID="library-skip"
            disabled={s.phase !== 'playerTurn' && s.phase !== 'rewinding'}
            onSkip={() => {
              r.tracker.skip();
              controller.dispatch({ type: 'skip' });
            }}
            t={t}
          />
        ) : (
          <SolveFooter controller={controller} s={s} step={step} prefix="library" t={t} />
        )
      }
      keys={step ? stepKeys(t) : exam ? [{ keys: ['S'], label: t('dx.board.key.skip') }, { keys: ['Esc'], label: t('dx.board.key.back') }] : solveKeys(t)}
      hotkeys={
        exam && !step
          ? {
              s: () => {
                if (s.phase !== 'playerTurn' && s.phase !== 'rewinding') return;
                r.tracker.skip();
                controller.dispatch({ type: 'skip' });
              },
              Escape: r.close,
            }
          : solveHotkeys(controller, s, !!step, r.close)
      }
    />
  );
}

// ── Course exam ─────────────────────────────────────────────────────────

export function DxCourseExam({ courseId }: { courseId: string }) {
  const t = useT();
  const { course, loading } = useCourseContent(courseId);
  const progress = useCourseProgress(course);
  if (!course || !progress) {
    return <Missing loading={loading || !!course} text={t('courses.needs_download')} back={t('courses.done.back')} testID="course-exam" />;
  }
  return <ExamGate course={course} open={progress.examOpen} cycle={progress.cycle} />;
}

/** The gate is read once, at entry (as on the phone): finishing must not flip it mid-screen. */
function ExamGate({ course, open, cycle }: { course: Course; open: boolean; cycle: number }) {
  const t = useT();
  const [gate] = useState(() => ({ open, cycle }));
  if (!gate.open) return <Missing loading={false} text={t('courses.exam_closed')} back={t('courses.done.back')} testID="course-exam" textTestID="course-exam-closed" />;
  return <ExamRunner course={course} cycle={gate.cycle} />;
}

function ExamRunner({ course, cycle }: { course: Course; cycle: number }) {
  const r = useExamRunner(course, cycle);
  const { t, lang, exam, controller, s } = r;
  const canSkip = s.phase === 'playerTurn' || s.phase === 'rewinding';
  const skip = () => {
    if (!canSkip) return;
    r.tracker.skip();
    controller.dispatch({ type: 'skip' });
  };
  return (
    <ChapterStage
      testID="course-exam"
      board={{ controller, s, onMove: r.onMove, boardRef: r.boardRef }}
      back={{ label: t('courses.exam_back'), a11y: t('courses.exit_a11y'), onPress: r.leave, testID: 'course-exam-exit' }}
      chip={{ label: t('courses.exam_chip'), color: tone.gold, bg: alpha(tone.gold, 0.16), testID: 'course-exam-chip' }}
      tracker={r.tracker}
      target={null}
      dashes={{ looks: r.looks, label: t('courses.exam_score_a11y', { right: r.right, answered: r.answered }), testID: 'course-exam-segments' }}
      turn={{
        side: r.side,
        title: t(r.side === 'w' ? 'courses.goal.move_w' : 'courses.goal.move_b'),
        sub: t('courses.exam_position', { n: Math.max(0, r.pIndex) + 1, total: exam.count }),
      }}
      note={r.note === 'missed' ? t('library.missed_note') : null}
      noteTestID="course-note"
      cards={
        <View style={styles.examNote} testID="course-exam-note">
          <Star size={18} color={tone.gold} strokeWidth={1.8} />
          <DText size={12.5} lh={18} color={tone.goldInk} style={styles.flex}>
            {t('courses.exam_note', { course: localized(course.title, lang), pass: exam.passMark, total: exam.count })}
          </DText>
          <DText size={13} weight={800} tabular testID="course-exam-score" accessibilityLabel={t('courses.exam_score_a11y', { right: r.right, answered: r.answered })}>
            {`${r.right}/${r.answered}`}
          </DText>
        </View>
      }
      footer={
        <PlateButton
          testID="course-exam-skip"
          label={t('library.skip')}
          accessibilityLabel={t('library.skip_a11y')}
          variant="slate"
          size="md"
          block
          disabled={!canSkip}
          onPress={skip}
        />
      }
      keys={[
        { keys: ['S'], label: t('dx.board.key.skip') },
        { keys: ['Esc'], label: t('dx.board.key.back') },
      ]}
      hotkeys={{ s: skip, Escape: r.leave }}
    />
  );
}

// ── Shared stage ────────────────────────────────────────────────────────

function ChapterStage({
  testID,
  board,
  back,
  chip,
  tracker,
  target,
  dashes,
  turn,
  note,
  noteTestID,
  cards,
  footer,
  keys,
  hotkeys,
  hotkeysOn = true,
}: {
  testID: string;
  board: Board;
  back: { label: string; a11y: string; onPress: () => void; testID: string };
  chip: { label: string; color: ColorValue; bg: ColorValue; testID: string };
  tracker: ResultTracker;
  target: number | null;
  dashes: { looks: readonly Dash[]; label: string; testID: string };
  turn: { side: 'w' | 'b'; title: string; sub: string; solved?: boolean };
  note: string | null;
  noteTestID: string;
  cards: ReactNode;
  footer: ReactNode;
  keys: readonly { keys: readonly string[]; label: string }[];
  hotkeys: HotkeyMap;
  hotkeysOn?: boolean;
}) {
  useHotkeys(hotkeys, hotkeysOn);
  const { controller, s, onMove, boardRef } = board;
  const panel = (
    <>
      <View style={styles.row}>
        <GhostButton testID={back.testID} label={back.label} accessibilityLabel={back.a11y} icon={ChevronLeft} onPress={back.onPress} />
        <Spacer />
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <DText size={11.5} weight={800} upper color={chip.color} testID={chip.testID}>
            {chip.label}
          </DText>
        </View>
        <Clock tracker={tracker} target={target} />
      </View>
      <Dashes looks={dashes.looks} label={dashes.label} testID={dashes.testID} />
      <TurnCard side={turn.side} title={turn.title} titleColor={turn.solved ? eos.sage : undefined} sub={turn.sub} />
      {note ? (
        <DText size={13} color={tone.rose} numberOfLines={1} testID={noteTestID}>
          {note}
        </DText>
      ) : null}
      {cards}
      <Spacer />
      {E2E && <PracticeE2EStrip controller={controller} state={s} />}
      {footer}
      <KeyHints items={keys} style={styles.hints} />
    </>
  );
  return (
    <BoardStage
      testID={`${testID}-desk`}
      board={(size) => <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={s.phase === 'idle' || s.phase === 'advancing'} size={size} />}
      panel={panel}
    />
  );
}

/** This puzzle's time (against the cycle target when there is one). */
function Clock({ tracker, target }: { tracker: ResultTracker; target: number | null }) {
  const t = useT();
  const { time, over } = usePuzzleClock(tracker, target);
  return (
    <View
      testID="library-clock"
      accessible
      accessibilityLabel={target != null ? t('library.timer_a11y', { time, target: fmt(target) }) : t('library.timer_a11y_free', { time })}
    >
      <ClockText text={target != null ? `${time} / ${fmt(target)}` : time} size={15} color={over ? tone.rose : eos.bone} />
    </View>
  );
}

/** Hint + "show solution", or the solution stepper + Next once the solution is up. */
function SolveFooter({
  controller,
  s,
  step,
  prefix,
  t,
}: {
  controller: PracticeController;
  s: PracticeState;
  step: { ply: number; maxPly: number } | null;
  prefix: 'course' | 'library';
  t: TFn;
}) {
  if (step) {
    return (
      <View style={styles.solution}>
        <SolutionStepper
          ply={step.ply}
          maxPly={step.maxPly}
          onStep={(delta, source) => controller.dispatch({ type: 'step', delta, source })}
          onSeek={(ply) => controller.dispatch({ type: 'seek', ply })}
          t={t}
        />
        <PlateButton testID={`${prefix}-next`} label={t('library.next')} size="md" block onPress={() => controller.dispatch({ type: 'skip' })} />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <PlateButton
          testID={`${prefix}-hint`}
          label={t('review.hint')}
          variant="slate"
          size="md"
          block
          icon={<Lightbulb size={16} color={s.hintLevel > 0 ? eos.ember : eos.bone} strokeWidth={1.8} />}
          disabled={!canHint(s)}
          onPress={() => controller.dispatch({ type: 'hint' })}
        />
      </View>
      <GhostButton
        testID={`${prefix}-show-solution`}
        label={t('library.show_solution')}
        accessibilityLabel={t('library.show_solution')}
        height={44}
        disabled={s.phase !== 'playerTurn' && s.phase !== 'rewinding'}
        onPress={() => controller.dispatch({ type: 'showSolution' })}
      />
    </View>
  );
}

function ExamSkip({ note, noteTestID, testID, disabled, onSkip, t }: { note: string; noteTestID: string; testID: string; disabled: boolean; onSkip: () => void; t: TFn }) {
  return (
    <View style={styles.row}>
      <DText size={12.5} color={dx.ash} style={styles.flex} testID={noteTestID}>
        {note}
      </DText>
      <GhostButton testID={testID} label={t('library.skip')} accessibilityLabel={t('library.skip_a11y')} height={44} disabled={disabled} onPress={onSkip} />
    </View>
  );
}

const solveKeys = (t: TFn) => [
  { keys: ['H'], label: t('dx.board.key.hint') },
  { keys: ['R'], label: t('dx.board.key.solution') },
  { keys: ['Esc'], label: t('dx.board.key.back') },
];

const stepKeys = (t: TFn) => [
  { keys: ['←', '→'], label: t('dx.board.key.browse') },
  { keys: ['Enter'], label: t('library.next') },
  { keys: ['Esc'], label: t('dx.board.key.back') },
];

function solveHotkeys(controller: PracticeController, s: PracticeState, stepping: boolean, close: () => void): HotkeyMap {
  if (stepping) {
    return {
      ArrowLeft: () => controller.dispatch({ type: 'step', delta: -1, source: 'tap' }),
      ArrowRight: () => controller.dispatch({ type: 'step', delta: 1, source: 'tap' }),
      Enter: () => controller.dispatch({ type: 'skip' }),
      Escape: close,
    };
  }
  return {
    h: () => canHint(s) && controller.dispatch({ type: 'hint' }),
    r: () => (s.phase === 'playerTurn' || s.phase === 'rewinding') && controller.dispatch({ type: 'showSolution' }),
    Escape: close,
  };
}

/** The content isn't on this device (or still loading). */
function Missing({ loading, text, back, testID, textTestID }: { loading: boolean; text: string; back: string; testID: string; textTestID?: string }) {
  return (
    <StageMessage testID={testID}>
      {loading ? (
        <ActivityIndicator color={eos.ash} />
      ) : (
        <>
          <DText size={14.5} color={dx.ash} align="center" testID={textTestID}>
            {text}
          </DText>
          <PlateButton testID={`${testID}-back`} label={back} variant="slate" size="sm" style={styles.center} onPress={() => router.back()} />
        </>
      )}
    </StageMessage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center' },
  themeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeTile: { width: 36, height: 36, borderRadius: 9, backgroundColor: dx.themeTile, alignItems: 'center', justifyContent: 'center' },
  gameTile: { backgroundColor: dx.ghost },
  link: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  examNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: alpha(tone.gold, 0.07),
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(tone.gold, 0.25), inset: true }],
  },
  solution: { gap: 12 },
  center: { alignSelf: 'center' },
  hints: { gap: 14 },
  introDialog: { padding: 0, overflow: 'hidden' },
});
