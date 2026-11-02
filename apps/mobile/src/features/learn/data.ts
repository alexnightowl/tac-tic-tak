import { courseProgress, type CourseExamRecord, type CourseProgress, type CourseSummary, type LibraryAttemptRecord } from '@tac/core/library';
import { useMemo } from 'react';

import { useCourses, type DownloadView, type ShelfLoad } from '@/features/library/model';
import { useAttempts, useExams, useLibraryStore } from '@/features/library/store';
import { FIXTURE_ATTEMPTS, FIXTURE_COURSES, FIXTURE_EXAMS } from './fixture';

// The Learn tab's course data: the Library store's course list, results
// and exam tries. In __DEV__ only, while the API has no course list yet,
// the fixture stands in (fixture.ts).

export type LearnCourses = {
  courses: CourseSummary[] | null;
  load: ShelfLoad;
  retry: () => void;
  attempts: readonly LibraryAttemptRecord[];
  exams: readonly CourseExamRecord[];
  fixture: boolean;
};

export function useLearnCourses(): LearnCourses {
  const { courses, load, retry } = useCourses();
  const attempts = useAttempts();
  const exams = useExams();
  const fixture = __DEV__ && (!courses || courses.length === 0) && load !== 'loading';
  return useMemo(
    () =>
      fixture
        ? { courses: FIXTURE_COURSES, load, retry, attempts: [...attempts, ...FIXTURE_ATTEMPTS], exams: [...exams, ...FIXTURE_EXAMS], fixture }
        : { courses, load, retry, attempts, exams, fixture },
    [fixture, courses, load, retry, attempts, exams],
  );
}

export function useCourseProgressMap(data: LearnCourses): Map<string, CourseProgress> {
  const { courses, attempts, exams } = data;
  return useMemo(() => new Map((courses ?? []).map((c) => [c.id, courseProgress(c, attempts, exams)])), [courses, attempts, exams]);
}

/**
 * Download state of a course. Local adapter: model.useDownloadView only
 * looks at downloaded books, a downloaded course lives in `courses`.
 */
export function useCourseDownloadView(id: string): DownloadView {
  return useLibraryStore((s) => (s.courses[id] ? 'downloaded' : s.downloads[id] === 'loading' ? 'downloading' : 'remote'));
}

/** Lesson chapters only (the course shape ends with the exam). */
export function lessonTotals(p: CourseProgress): { done: number; total: number } {
  const lessons = p.chapters.slice(0, -1);
  return { done: lessons.reduce((n, c) => n + c.done, 0), total: lessons.reduce((n, c) => n + c.total, 0) };
}
