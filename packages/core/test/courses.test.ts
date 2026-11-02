import { describe, expect, it } from 'vitest';
import { courseProgress, examOutcome, suggestedCourse, type CourseExamRecord, type LibraryAttemptRecord } from '../src/library';

const course = {
  id: 'basic',
  chapters: [
    { id: 'basic-fork', puzzleIds: ['f1', 'f2'] },
    { id: 'basic-pin', puzzleIds: ['p1', 'p2'] },
  ],
  exam: { id: 'basic-exam', puzzleIds: ['e1', 'e2'] },
};

let t = 0;
const rec = (puzzleId: string, cycle = 1, result: LibraryAttemptRecord['result'] = 'clean'): LibraryAttemptRecord => ({
  bookId: 'basic',
  puzzleId,
  cycle,
  result,
  timeMs: 10_000,
  solvedAt: new Date(Date.UTC(2026, 10, 2, 0, 0, t++)).toISOString(),
});
const exam = (cycle: number, score: number, passed: boolean): CourseExamRecord => ({
  courseId: 'basic',
  cycle,
  score,
  total: 2,
  passed,
  byTheme: {},
  takenAt: new Date(Date.UTC(2026, 10, 2, 1, 0, t++)).toISOString(),
});

describe('courseProgress', () => {
  it('is new before any result, with the exam closed', () => {
    const p = courseProgress(course, [], []);
    expect(p).toMatchObject({ emblem: 'new', ring: 0, examOpen: false, total: 6, cycle: 1 });
  });

  it('opens the exam once every chapter of the cycle is done', () => {
    const some = courseProgress(course, [rec('f1'), rec('f2'), rec('p1')], []);
    expect(some.examOpen).toBe(false);
    expect(some.emblem).toBe('progress');
    expect(some.ring).toBeCloseTo(3 / 6);
    const all = courseProgress(course, [rec('f1'), rec('f2'), rec('p1'), rec('p2')], []);
    expect(all.examOpen).toBe(true);
    expect(all.next?.chapterIndex).toBe(2);
  });

  it('keeps a failed try in the cycle and passes on a later one', () => {
    const atts = ['f1', 'f2', 'p1', 'p2', 'e1', 'e2'].map((id) => rec(id));
    const failed = courseProgress(course, atts, [exam(1, 1, false)]);
    expect(failed.emblem).toBe('progress');
    expect(failed.examTries).toHaveLength(1);
    const passed = courseProgress(course, atts, [exam(1, 1, false), exam(1, 2, true)]);
    expect(passed).toMatchObject({ emblem: 'passed', ring: 1 });
    expect(passed.passedExam?.score).toBe(2);
  });

  it('shows the new cycle after a restart and keeps the pass', () => {
    const atts = [...['f1', 'f2', 'p1', 'p2', 'e1', 'e2'].map((id) => rec(id)), rec('f1', 2)];
    const p = courseProgress(course, atts, [exam(1, 2, true)]);
    expect(p).toMatchObject({ emblem: 'progress', cycle: 2, examOpen: false });
    expect(p.passedExam?.score).toBe(2);
    expect(p.ring).toBeCloseTo(1 / 6);
  });
});

describe('examOutcome', () => {
  const puzzles = [
    { id: 'a', theme: 'fork' },
    { id: 'b', theme: 'fork' },
    { id: 'c', theme: 'pin' },
    { id: 'd', theme: 'pin' },
    { id: 'e', theme: 'skewer' },
  ];

  it('counts clean solves only and names the weakest themes', () => {
    const o = examOutcome(puzzles, { a: 'clean', b: 'clean', c: 'missed', d: 'clean', e: 'missed' }, 4);
    expect(o).toMatchObject({ score: 3, total: 5, passed: false });
    expect(o.byTheme).toEqual({ fork: [2, 2], pin: [1, 2], skewer: [0, 1] });
    expect(o.weakest).toEqual(['skewer', 'pin']);
  });

  it('passes at the mark and treats unanswered as missed', () => {
    expect(examOutcome(puzzles, { a: 'clean', b: 'clean', c: 'clean', d: 'clean' }, 4)).toMatchObject({ score: 4, passed: true, weakest: ['skewer'] });
  });
});

describe('suggestedCourse', () => {
  const courses = [
    { id: 'basic', ratingMin: 400, ratingMax: 1400, suggest: true },
    { id: 'intermediate', ratingMin: 1100, ratingMax: 1900, suggest: true },
    { id: 'advanced', ratingMin: 1800, ratingMax: 2600, suggest: true },
    { id: 'endgames', ratingMin: 800, ratingMax: 2300, suggest: false },
  ];

  it('picks the course whose middle is nearest among those that fit', () => {
    expect(suggestedCourse(courses, 1612)?.id).toBe('intermediate');
    expect(suggestedCourse(courses, 1150)?.id).toBe('basic');
    expect(suggestedCourse(courses, 1950)?.id).toBe('advanced');
    expect(suggestedCourse(courses, 300)).toBeNull();
    expect(suggestedCourse(courses, null)).toBeNull();
  });
});
