// Courses (docs/mobile/COURSES.md): themed puzzle courses next to the
// Library books, under the Learn tab. A course is a book whose chapters are
// tactical themes (Lichess puzzles by their own ids) plus a final exam that
// opens once every chapter of the cycle is done. Results ride the Library's
// attempts (bookId = the course id); exam tries are kept apart, since a
// retake replays puzzles that already have a result in the cycle.
import type { BookProgress, BookShape, LibraryAttemptRecord, LibraryResult, Localized } from './index';
import { bookProgress } from './index';

export type CoursePiece = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

/** An arrow on the intro diagram: the move to find, or what it then hits. */
export type CourseArrow = { from: string; to: string; kind: 'move' | 'threat' };

/** The chapter intro: the motif in two or three sentences and one diagram. */
export type CourseIntro = {
  text: Localized;
  /** Full FEN; the side to move is the one making the arrowed move. */
  fen: string;
  arrows: CourseArrow[];
  /** One line under the diagram ("Nc7+ hits the king and the rook"). */
  caption: Localized;
};

export type CourseChapterSummary = {
  id: string;
  /** Lichess theme slug: the chapter's icon and its name in the exam breakdown. */
  theme: string;
  title: Localized;
  /** One line on the solving card ("One piece, two targets."). */
  tip: Localized;
  count: number;
  puzzleIds: string[];
};

export type CourseExamSummary = {
  id: string;
  count: number;
  /** Right answers needed to pass (24 of 30). */
  passMark: number;
  puzzleIds: string[];
};

/** GET /library/courses → { courses } */
export type CourseSummary = {
  id: string;
  version: number;
  title: Localized;
  description: Localized;
  /** The course colour ('#8e4542'): emblem ring, tints, seal. */
  color: string;
  piece: CoursePiece;
  /** The level the course is written for (not the puzzles' spread). */
  ratingMin: number;
  ratingMax: number;
  /** Offered by "At {rating} we suggest …" (the tactics ladder, not Endgames). */
  suggest: boolean;
  puzzleCount: number;
  minutesPerCycle: number;
  chapters: CourseChapterSummary[];
  exam: CourseExamSummary;
};

export type CoursePuzzle = {
  id: string;
  fen: string;
  /** UCI; the first is the opponent's setup move. */
  moves: string[];
  rating: number;
  themes: string[];
  goal: 'mate' | 'win' | 'equal';
  mateIn: number | null;
  /** The chapter theme it was picked for (the exam breakdown). */
  theme: string;
};

export type CourseChapter = CourseChapterSummary & { intro: CourseIntro; puzzles: CoursePuzzle[] };
export type CourseExam = CourseExamSummary & { puzzles: CoursePuzzle[] };

/** GET /library/courses/:id — what a download stores. */
export type Course = Omit<CourseSummary, 'chapters' | 'exam'> & { chapters: CourseChapter[]; exam: CourseExam };

/** One finished exam try, as the server keeps it (GET /library/progress → exams). */
export type CourseExamRecord = {
  courseId: string;
  cycle: number;
  score: number;
  total: number;
  passed: boolean;
  /** theme slug → [right, asked]. */
  byTheme: Record<string, [number, number]>;
  /** ISO. */
  takenAt: string;
};

/** A try on the phone, queued until POST /library/sync takes it. */
export type CoursePendingExam = CourseExamRecord & { clientId: string };

// ─── Progress ────────────────────────────────────────────────────────────

type CourseShapeInput = { id: string; chapters: { id: string; puzzleIds: string[] }[]; exam: { id: string; puzzleIds: string[] } };

/** The course as a book: its chapters, then the exam as the last one. */
export function courseShape(c: CourseShapeInput): BookShape {
  return { id: c.id, chapters: [...c.chapters, { id: c.exam.id, puzzleIds: c.exam.puzzleIds }] };
}

export type CourseEmblemState = 'new' | 'progress' | 'passed';

export type CourseProgress = BookProgress & {
  /** Every chapter (not the exam) of the current cycle is done: the exam is open. */
  examOpen: boolean;
  /** Tries in the current cycle, oldest first. */
  examTries: CourseExamRecord[];
  /** The best passing try in any cycle (the certificate), else null. */
  passedExam: CourseExamRecord | null;
  emblem: CourseEmblemState;
  /** Ring fill, 0..1: done / total in the current cycle (1 once passed and not restarted). */
  ring: number;
};

export function courseProgress(
  c: CourseShapeInput,
  attempts: readonly LibraryAttemptRecord[],
  exams: readonly CourseExamRecord[],
): CourseProgress {
  const base = bookProgress(courseShape(c), attempts);
  const mine = exams.filter((e) => e.courseId === c.id);
  const passed = mine.filter((e) => e.passed);
  const passedExam = passed.reduce<CourseExamRecord | null>((b, e) => (!b || e.score > b.score ? e : b), null);
  // An exam try can come before any attempt of a newer cycle: the cycle is the later of the two.
  const cycle = Math.max(base.cycle, ...mine.map((e) => e.cycle));
  const lessons = base.chapters.slice(0, -1);
  const examOpen = cycle === base.cycle && lessons.every((ch) => ch.complete);
  const examTries = mine.filter((e) => e.cycle === cycle).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const emblem: CourseEmblemState = passedExam ? 'passed' : base.started || mine.length > 0 ? 'progress' : 'new';
  const restarted = !!passedExam && cycle > passedExam.cycle && base.done > 0;
  const ring = passedExam && !restarted ? 1 : base.total > 0 ? base.done / base.total : 0;
  return { ...base, examOpen, examTries, passedExam, emblem, ring };
}

// ─── Exam ────────────────────────────────────────────────────────────────

export type ExamOutcome = {
  score: number;
  total: number;
  passed: boolean;
  byTheme: Record<string, [number, number]>;
  /** Up to two themes to practise, weakest first (only ones with a miss). */
  weakest: string[];
};

/**
 * Scores one try. Only a clean solve counts: the exam has no hint and no
 * solution, so 'hint' cannot happen and a Skip or a wrong move is 'missed'.
 * Unanswered puzzles count as missed.
 */
export function examOutcome(
  puzzles: readonly { id: string; theme: string }[],
  results: Readonly<Record<string, LibraryResult>>,
  passMark: number,
): ExamOutcome {
  const byTheme: Record<string, [number, number]> = {};
  let score = 0;
  for (const p of puzzles) {
    const ok = results[p.id] === 'clean';
    if (ok) score++;
    const row = (byTheme[p.theme] ??= [0, 0]);
    if (ok) row[0]++;
    row[1]++;
  }
  const order = puzzles.map((p) => p.theme).filter((t, i, a) => a.indexOf(t) === i);
  const weakest = order
    .filter((t) => byTheme[t][0] < byTheme[t][1])
    .sort((a, b) => {
      const ra = byTheme[a][0] / byTheme[a][1];
      const rb = byTheme[b][0] / byTheme[b][1];
      return ra - rb || byTheme[b][1] - byTheme[a][1] || order.indexOf(a) - order.indexOf(b);
    })
    .slice(0, 2);
  return { score, total: puzzles.length, passed: score >= passMark, byTheme, weakest };
}

// ─── Suggestion ──────────────────────────────────────────────────────────

/**
 * "At {rating} we suggest {course}": a suggestable course whose range holds
 * the rating, the one whose middle is nearest; null when none does.
 */
export function suggestedCourse<T extends Pick<CourseSummary, 'id' | 'ratingMin' | 'ratingMax' | 'suggest'>>(
  courses: readonly T[],
  rating: number | null | undefined,
): T | null {
  if (rating == null) return null;
  const fits = courses.filter((c) => c.suggest && rating >= c.ratingMin && rating <= c.ratingMax);
  const mid = (c: T) => (c.ratingMin + c.ratingMax) / 2;
  return fits.reduce<T | null>((b, c) => (!b || Math.abs(mid(c) - rating) < Math.abs(mid(b) - rating) ? c : b), null);
}

export const COURSE_EXAM_PASS_RATIO = 0.8;
