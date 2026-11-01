import { bookProgress, type BookProgress, type LibraryAttemptRecord, type LibraryBook, type LibraryBookSummary } from '@tac/core/library';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { libraryApi, libraryKeys } from './api';
import { useAttempts, useLibraryStore } from './store';
import { refreshShelf } from './sync';

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
