import {
  localized,
  type Course,
  type CourseExamRecord,
  type CourseProgress,
  type CoursePuzzle,
  type CourseSummary,
  type LibraryAttemptRecord,
} from '@tac/core/library';
import { router, type Href } from 'expo-router';

import { plural } from '@/features/offline/format';
import type { TFn, TnFn } from '@/ui/lang';

// Course screens: routes, the docked CTA, chapter states and the goal
// line. Progress itself is @tac/core/library courseProgress (the exam is
// the last "chapter" of the course shape there).

export type CourseLike = CourseSummary | Course;

/** /course/[courseId] and its stack (see (app)/_layout). */
export const courseHref = {
  page: (id: string) => `/course/${id}` as Href,
  intro: (id: string, chapter: number, reread = false) => `/course/intro?course=${id}&chapter=${chapter}${reread ? '&reread=1' : ''}` as Href,
  solve: (id: string, chapter: number, cycle: number) => `/course/solve?course=${id}&chapter=${chapter}&cycle=${cycle}` as Href,
  /** The chapter's puzzles again from the top (practice after a failed exam); results in the cycle stay first-wins. */
  replay: (id: string, chapter: number, cycle: number) => `/course/solve?course=${id}&chapter=${chapter}&cycle=${cycle}&replay=1` as Href,
  exam: (id: string) => `/course/exam?course=${id}` as Href,
  done: (id: string, chapter: number, cycle: number, fresh = false) =>
    `/course/done?course=${id}&chapter=${chapter}&cycle=${cycle}${fresh ? '&fresh=1' : ''}` as Href,
  result: (id: string, at: string) => `/course/result?course=${id}&at=${encodeURIComponent(at)}` as Href,
  certificate: (id: string, at?: string) => `/course/certificate?course=${id}${at ? `&at=${encodeURIComponent(at)}` : ''}` as Href,
};

/** The lessons (the exam excluded) of a course progress. */
export const lessonsOf = (p: CourseProgress) => p.chapters.slice(0, -1);

/** A try passed in the progress's current cycle. */
export const passedInCycle = (p: CourseProgress) => p.examTries.some((e) => e.passed);

/** The latest try of the current cycle, if any. */
export const lastTry = (p: CourseProgress): CourseExamRecord | null => p.examTries[p.examTries.length - 1] ?? null;

/** The next lesson in course order without a result this cycle (the recommended one), else null. */
export function nextLesson(course: CourseLike, p: CourseProgress): number | null {
  const n = p.next?.chapterIndex;
  return n != null && n < course.chapters.length ? n : null;
}

/** Did the player already play this chapter in this cycle (any result)? Cycle 1 shows the intro first. */
export function wantsIntro(p: CourseProgress, chapter: number, cycle: number): boolean {
  return cycle <= 1 && (p.chapters[chapter]?.done ?? 0) === 0;
}

/**
 * Opens a chapter as the course page does: a complete one shows its
 * summary, a fresh one in the first cycle its intro, else the runner.
 */
export function openChapter(course: CourseLike, p: CourseProgress, index: number, replace = false) {
  const ch = p.chapters[index];
  const href = ch?.complete
    ? courseHref.done(course.id, index, p.cycle)
    : wantsIntro(p, index, p.cycle)
      ? courseHref.intro(course.id, index)
      : courseHref.solve(course.id, index, p.cycle);
  if (replace) router.replace(href);
  else router.push(href);
}

export type CourseCta = { kind: 'start' | 'continue' | 'exam' | 'retake' | 'cycle'; label: string; run: () => void };

export function courseCta(course: CourseLike, p: CourseProgress, t: TFn, lang: string): CourseCta {
  if (passedInCycle(p) || (p.cycleComplete && !p.examOpen)) {
    const n = p.cycle + 1;
    return { kind: 'cycle', label: t('courses.cta_cycle', { n }), run: () => router.push(courseHref.solve(course.id, 0, n)) };
  }
  if (p.examOpen) {
    const retake = p.examTries.length > 0;
    return { kind: retake ? 'retake' : 'exam', label: t(retake ? 'courses.cta_retake' : 'courses.cta_exam'), run: () => router.push(courseHref.exam(course.id)) };
  }
  const index = nextLesson(course, p) ?? 0;
  if (!p.started) {
    return { kind: 'start', label: t('courses.cta_start'), run: () => openChapter(course, p, index) };
  }
  const ch = p.chapters[index];
  const title = localized(course.chapters[index].title, lang);
  return {
    kind: 'continue',
    label: t('courses.cta_continue', { title, n: Math.min(ch.total, ch.done + 1), total: ch.total }),
    run: () => openChapter(course, p, index),
  };
}

/** m:ss */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

/** "White wins material" / "White mates in 2" / "White to move" from the puzzle and the side to move. */
export function goalLine(puzzle: Pick<CoursePuzzle, 'goal' | 'mateIn'> | null, side: 'w' | 'b', t: TFn, tn: TnFn): string {
  if (!puzzle) return t('play.loading_puzzle');
  if (puzzle.goal === 'mate' && puzzle.mateIn) return plural(tn, side === 'w' ? 'library.goal.mate_w' : 'library.goal.mate_b', puzzle.mateIn);
  if (puzzle.goal === 'win') return t(side === 'w' ? 'courses.goal.win_w' : 'courses.goal.win_b');
  return t(side === 'w' ? 'courses.goal.move_w' : 'courses.goal.move_b');
}

/** Results of one cycle for a course, by puzzle id. */
export function resultsIn(courseId: string, attempts: readonly LibraryAttemptRecord[], cycle: number) {
  const m = new Map<string, LibraryAttemptRecord>();
  for (const a of attempts) if (a.bookId === courseId && a.cycle === cycle && !m.has(a.puzzleId)) m.set(a.puzzleId, a);
  return m;
}

/** The chapter title for a theme slug (the exam breakdown). */
export function themeTitle(course: CourseLike, theme: string, lang: string): string {
  const ch = course.chapters.find((c) => c.theme === theme);
  return ch ? localized(ch.title, lang) : theme;
}

/** A non-negative integer route param, else the default. */
export function intParam(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : d;
}
