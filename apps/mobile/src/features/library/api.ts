import type { AbortSignalLike } from '@tac/core/api';
import type {
  Course,
  CourseSummary,
  LibraryBook,
  LibraryBookSummary,
  LibraryProgressResponse,
  LibrarySyncBody,
  LibrarySyncResponse,
} from '@tac/core/library';

import { apiClient } from '@/platform/api';

// docs/mobile/LIBRARY.md "API" (backend branch api/library).

export const libraryApi = {
  books: () => apiClient.get<{ books: LibraryBookSummary[] }>('/library/books'),
  book: (id: string, signal?: AbortSignalLike) =>
    apiClient.get<LibraryBook>(`/library/books/${encodeURIComponent(id)}`, { signal, timeoutMs: 30_000 }),
  courses: () => apiClient.get<{ courses: CourseSummary[] }>('/library/courses'),
  course: (id: string, signal?: AbortSignalLike) =>
    apiClient.get<Course>(`/library/courses/${encodeURIComponent(id)}`, { signal, timeoutMs: 30_000 }),
  progress: () => apiClient.get<LibraryProgressResponse>('/library/progress'),
  /** Idempotent per clientId, and per puzzle and cycle: a retry is always safe. */
  sync: (body: LibrarySyncBody) => apiClient.post<LibrarySyncResponse>('/library/sync', body, { timeoutMs: 30_000 }),
};

export const libraryKeys = {
  books: () => ['library-books'] as const,
  book: (id: string) => ['library-book', id] as const,
  courses: () => ['library-courses'] as const,
  course: (id: string) => ['library-course', id] as const,
};
