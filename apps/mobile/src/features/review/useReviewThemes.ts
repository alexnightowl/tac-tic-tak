import type { ReviewThemeRow } from '@tac/core/runner';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { queryClient } from '@/platform/query';
import { reviewApi, reviewKeys } from './api';

/** B9 adds firstPuzzleId to /review/themes; until then the tap fetches the theme's list. */
export type ThemeRow = ReviewThemeRow & { firstPuzzleId?: string };

/**
 * The Review page's theme list and the card tap (phone ReviewTabScreen and
 * the desktop page). fix: the web fired GET /review?theme= for every card on
 * mount (N+1) and a tap before it resolved went nowhere; here the list is
 * fetched on tap (and reused by the drill's counter), or skipped once B9
 * sends firstPuzzleId.
 */
export function useReviewThemes() {
  const q = useQuery({
    queryKey: reviewKeys.themes(),
    queryFn: () => reviewApi.themes() as Promise<ThemeRow[]>,
  });
  const [opening, setOpening] = useState<string | null>(null);

  // Tabs stay mounted, so a mount refetch never runs again: a session that
  // just added misses would leave this list stale. Refetch on focus once
  // the cached list is past its staleTime (the web remounted the page).
  useFocusEffect(
    useCallback(() => {
      const key = reviewKeys.themes();
      if (queryClient.getQueryState(key)?.status !== 'success') return;
      void queryClient.refetchQueries({ queryKey: key, stale: true, type: 'active' });
    }, []),
  );

  const open = async (row: ThemeRow) => {
    if (opening) return;
    let id = row.firstPuzzleId ?? null;
    if (!id) {
      setOpening(row.slug);
      try {
        const list = await queryClient.fetchQuery({
          queryKey: reviewKeys.list(row.slug),
          queryFn: () => reviewApi.list(row.slug),
          staleTime: 30_000,
        });
        id = list[0]?.puzzleId ?? null;
      } catch {
        id = null;
      } finally {
        setOpening(null);
      }
    }
    if (id) router.push(`/review/${encodeURIComponent(id)}?theme=${encodeURIComponent(row.slug)}` as Href);
    else void q.refetch();
  };

  return { q, opening, open };
}
