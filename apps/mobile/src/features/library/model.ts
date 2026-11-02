import {
  bookProgress,
  courseProgress,
  type BookProgress,
  type Course,
  type CourseProgress,
  type CourseSummary,
  type LibraryAttemptRecord,
  type LibraryBook,
  type LibraryBookSummary,
} from '@tac/core/library';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { libraryApi, libraryKeys } from './api';
import { useAttempts, useExams, useLibraryStore } from './store';
import { refreshCourses, refreshShelf } from './sync';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/** Chapter numbers are roman, as in the design (I, II, III…). */
export const roman = (n: number) => ROMAN[n - 1] ?? String(n);

export type ShelfLoad = 'idle' | 'loading' | 'error';

/** The shelf: the stored list at once, refreshed from the server on mount. */
export function useShelf(): { books: LibraryBookSummary[] | null; load: ShelfLoad; retry: () => void } {
  const books = useLibraryStore((s) => s.shelf);
  const [load, setLoad] = useState<ShelfLoad>('loading');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    refreshShelf()
      .then(() => alive && setLoad('idle'))
      .catch(() => alive && setLoad('error'));
    return () => {
      alive = false;
    };
  }, [tick]);
  const retry = () => {
    setLoad('loading');
    setTick((n) => n + 1);
  };
  return { books, load, retry };
}

export function useBookSummary(id: string): LibraryBookSummary | null {
  return useLibraryStore((s) => s.shelf?.find((b) => b.id === id) ?? s.books[id] ?? null);
}

/**
 * The full book: the downloaded copy when there is one, else fetched (and
 * kept in the query cache for the session, not on disk).
 */
export function useBookContent(id: string): { book: LibraryBook | null; downloaded: boolean; loading: boolean; error: boolean } {
  const stored = useLibraryStore((s) => s.books[id] ?? null);
  const q = useQuery({
    queryKey: libraryKeys.book(id),
    queryFn: () => libraryApi.book(id),
    enabled: !stored,
    staleTime: Infinity,
    retry: 1,
  });
  return { book: stored ?? q.data ?? null, downloaded: !!stored, loading: !stored && q.isLoading, error: !stored && q.isError };
}

export function useBookProgress(book: LibraryBookSummary | null): BookProgress | null {
  const attempts = useAttempts();
  return useMemo(() => (book ? bookProgress(book, attempts) : null), [book, attempts]);
}

/** The book read last (the latest result), for "Continue reading". */
export function lastReadBookId(attempts: readonly LibraryAttemptRecord[]): string | null {
  let best: LibraryAttemptRecord | null = null;
  for (const a of attempts) if (!best || a.solvedAt > best.solvedAt) best = a;
  return best?.bookId ?? null;
}

export type DownloadView = 'downloaded' | 'downloading' | 'remote';

export function useDownloadView(id: string): DownloadView {
  return useLibraryStore((s) => (s.books[id] ? 'downloaded' : s.downloads[id] === 'loading' ? 'downloading' : 'remote'));
}

// ─── Courses (Learn tab) ─────────────────────────────────────────────────

/** The course list: the stored one at once, refreshed from the server on mount. */
export function useCourses(): { courses: CourseSummary[] | null; load: ShelfLoad; retry: () => void } {
  const courses = useLibraryStore((s) => s.courseList);
  const [load, setLoad] = useState<ShelfLoad>('loading');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    refreshCourses()
      .then(() => alive && setLoad('idle'))
      .catch(() => alive && setLoad('error'));
    return () => {
      alive = false;
    };
  }, [tick]);
  const retry = () => {
    setLoad('loading');
    setTick((n) => n + 1);
  };
  return { courses, load, retry };
}

export function useCourseSummary(id: string): CourseSummary | null {
  return useLibraryStore((s) => s.courseList?.find((c) => c.id === id) ?? s.courses[id] ?? null);
}

/** The full course: the downloaded copy when there is one, else fetched for the session. */
export function useCourseContent(id: string): { course: Course | null; downloaded: boolean; loading: boolean; error: boolean } {
  const stored = useLibraryStore((s) => s.courses[id] ?? null);
  const q = useQuery({
    queryKey: libraryKeys.course(id),
    queryFn: () => libraryApi.course(id),
    enabled: !stored,
    staleTime: Infinity,
    retry: 1,
  });
  return { course: stored ?? q.data ?? null, downloaded: !!stored, loading: !stored && q.isLoading, error: !stored && q.isError };
}

export function useCourseProgress(course: CourseSummary | Course | null): CourseProgress | null {
  const attempts = useAttempts();
  const exams = useExams();
  return useMemo(() => (course ? courseProgress(course, attempts, exams) : null), [course, attempts, exams]);
}

/** The course or book played last (the latest result), for the Continue cards. */
export function lastPlayedIn(attempts: readonly LibraryAttemptRecord[], ids: ReadonlySet<string>): string | null {
  let best: LibraryAttemptRecord | null = null;
  for (const a of attempts) if (ids.has(a.bookId) && (!best || a.solvedAt > best.solvedAt)) best = a;
  return best?.bookId ?? null;
}
