import type { CreateWoodpeckerSetBody, WoodpeckerSet } from '@tac/core/api';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/platform/api';
import { queryClient } from '@/platform/query';

// Woodpecker sets (D40): GET/POST/DELETE /woodpecker/sets. A set's
// puzzles never change, so the full set stays cached for the session;
// the list is refetched on mount (another device may have made a set).

export const woodpeckerKeys = {
  sets: () => ['woodpecker-sets'] as const,
  set: (id: string) => ['woodpecker-set', id] as const,
};

export function useWoodpeckerSets() {
  return useQuery({ queryKey: woodpeckerKeys.sets(), queryFn: () => api.woodpecker.list(), staleTime: 30_000 });
}

export function useWoodpeckerSet(id: string | null) {
  return useQuery({
    queryKey: woodpeckerKeys.set(id ?? ''),
    queryFn: () => api.woodpecker.get(id ?? ''),
    enabled: !!id,
    staleTime: Infinity,
    retry: 1,
  });
}

/**
 * Makes a set; with `replace`, archives that one after the new set exists
 * (one active set at a time: a failed create keeps the old one).
 */
export function useCreateSet() {
  return useMutation({
    mutationFn: async ({ body, replace }: { body: CreateWoodpeckerSetBody; replace?: string | null }): Promise<WoodpeckerSet> => {
      const set = await api.woodpecker.create(body);
      queryClient.setQueryData(woodpeckerKeys.set(set.id), set);
      if (replace) await api.woodpecker.archive(replace).catch(() => undefined);
      return set;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: woodpeckerKeys.sets() }),
  });
}

export function useArchiveSet() {
  return useMutation({
    mutationFn: (id: string) => api.woodpecker.archive(id),
    onSuccess: (_r, id) => queryClient.removeQueries({ queryKey: woodpeckerKeys.set(id) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: woodpeckerKeys.sets() }),
  });
}
