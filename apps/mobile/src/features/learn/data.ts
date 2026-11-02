import { courseProgress, type CourseExamRecord, type CourseProgress, type CourseSummary, type LibraryAttemptRecord } from '@tac/core/library';
import { useMemo } from 'react';

import { useCourses, type DownloadView, type ShelfLoad } from '@/features/library/model';
import { useAttempts, useExams, useLibraryStore } from '@/features/library/store';

// The Learn tab's course data: the Library store's course list, results
// and exam tries.

export type LearnCourses = {
  courses: CourseSummary[] | null;
  load: ShelfLoad;
  retry: () => void;
  attempts: readonly LibraryAttemptRecord[];
  exams: readonly CourseExamRecord[];
};

export function useLearnCourses(): LearnCourses {
  const { courses, load, retry } = useCourses();
  const attempts = useAttempts();
  const exams = useExams();
  return useMemo(() => ({ courses, load, retry, attempts, exams }), [courses, load, retry, attempts, exams]);
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
