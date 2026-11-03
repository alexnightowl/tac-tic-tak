import { tzOffsetMinutes } from '@tac/core/offline';
import type { StormRunBody, StormRunSaved, StormStreamResponse, StormSummary } from '@tac/core/storm';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { apiClient } from '@/platform/api';
import { queryClient } from '@/platform/query';

// Puzzle Storm (docs/mobile/STORM.md "API"). Streams are fetched by the
// runner (never cached: a stream is played once); the summary feeds Start,
// the friends list and the Play row.

export const stormKeys = {
  all: ['storm'] as const,
  summary: () => ['storm', 'summary'] as const,
};

const enc = encodeURIComponent;

export const stormApi = {
  /** Solo: a fresh stream from base 1000; race: the challenge's stream (same for both players). */
  stream: (challengeId?: string) =>
    apiClient.post<StormStreamResponse>('/storm/streams', challengeId ? { challengeId } : {}, { timeoutMs: 30_000 }),
  streamById: (id: string) => apiClient.get<StormStreamResponse>(`/storm/streams/${enc(id)}`),
  /** Idempotent per clientId: a retry after a lost response returns the same run. */
  run: (body: StormRunBody) => apiClient.post<StormRunSaved>('/storm/runs', body, { timeoutMs: 20_000 }),
  summary: (signal?: AbortSignal) =>
    apiClient.get<StormSummary>('/storm/summary', { query: { tzOffsetMin: tzOffsetMinutes(new Date()) }, signal }),
};

export const stormSummaryQuery = () =>
  queryOptions({
    queryKey: stormKeys.summary(),
    queryFn: ({ signal }) => stormApi.summary(signal),
    staleTime: 15_000,
  });

/** The summary, refetched whenever the calling screen gains focus (a run may have landed). */
export function useStormSummary() {
  const q = useQuery(stormSummaryQuery());
  const { refetch } = q;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  return q;
}

export function invalidateStorm(): void {
  void queryClient.invalidateQueries({ queryKey: stormKeys.all });
}
