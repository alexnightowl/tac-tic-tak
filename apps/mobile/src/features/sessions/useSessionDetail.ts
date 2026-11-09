import { isApiError } from '@tac/core/api';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { feel } from '@/feel';
import { reviewKeys, sessionApi } from '@/features/review/api';

/**
 * One finished session (headline stats + attempts) and its review items
 * (shared with the mistakes runner), with pull-to-refresh. Shared by the
 * phone SessionDetailScreen and the desktop page.
 */
export function useSessionDetail(id: string) {
  const q = useQuery({
    queryKey: reviewKeys.session(id),
    queryFn: () => sessionApi.detail(id),
    retry: (n, e) => !(isApiError(e) && e.status === 404) && n < 1,
  });
  // Shared with the mistakes runner (the web used two different fetches).
  const items = useQuery({
    queryKey: reviewKeys.sessionReviewItems(id),
    queryFn: () => sessionApi.reviewItems(id),
    staleTime: 60_000,
    enabled: q.isSuccess,
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    try {
      await Promise.all([q.refetch(), items.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const failed = items.data?.items.filter((i) => i.reason === 'failed').length ?? 0;
  const slow = (items.data?.items.length ?? 0) - failed;
  return { q, items, refreshing, onRefresh, failed, slow };
}
