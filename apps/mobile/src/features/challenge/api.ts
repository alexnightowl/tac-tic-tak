import type {
  ChallengeCreateBody,
  ChallengeCreated,
  ChallengeDetail,
  ChallengeList,
  ChallengeSummary,
} from '@tac/core/storm';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { apiClient } from '@/platform/api';
import { queryClient } from '@/platform/query';

// The async Race (docs/mobile/STORM.md "Challenge a friend"). No push yet:
// the list is fetched on screen focus and on app foreground (focusManager).

export const challengeKeys = {
  all: ['challenges'] as const,
  list: () => ['challenges', 'list'] as const,
  detail: (id: string) => ['challenges', 'detail', id] as const,
};

const enc = encodeURIComponent;

export const challengeApi = {
  list: (signal?: AbortSignal) => apiClient.get<ChallengeList>('/challenges', { signal }),
  detail: (id: string, signal?: AbortSignal) => apiClient.get<ChallengeDetail>(`/challenges/${enc(id)}`, { signal }),
  create: (body: ChallengeCreateBody) => apiClient.post<ChallengeCreated>('/challenges', body),
  decline: (id: string) => apiClient.post<ChallengeSummary>(`/challenges/${enc(id)}/decline`),
};

export const challengeListQuery = () =>
  queryOptions({
    queryKey: challengeKeys.list(),
    queryFn: ({ signal }) => challengeApi.list(signal),
    staleTime: 10_000,
  });

export const challengeDetailQuery = (id: string) =>
  queryOptions({
    queryKey: challengeKeys.detail(id),
    queryFn: ({ signal }) => challengeApi.detail(id, signal),
    staleTime: 5_000,
    // A 404 (not mine, or a draft that isn't visible) will not heal.
    retry: (n, e) => (e as { status?: number }).status !== 404 && n < 1,
  });

/** Refetch the list whenever the calling screen gains focus. */
export function useChallengeList() {
  const q = useQuery(challengeListQuery());
  const { refetch } = q;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  return q;
}

/** Incoming (pending, waiting for my run) count for the Play row and Rivals. */
export function useIncomingChallenges(): { count: number } {
  const q = useChallengeList();
  return { count: q.data?.incoming.length ?? 0 };
}

/** After a create / decline / run: every challenge view refreshes. */
export function invalidateChallenges(): void {
  void queryClient.invalidateQueries({ queryKey: challengeKeys.all });
}
