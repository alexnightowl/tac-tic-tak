import type { WoodpeckerSet } from '@tac/core/api';
import type { TrainingStyle } from '@tac/core/rules';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/platform/api';
import { queryClient } from '@/platform/query';

// Woodpecker sets: GET/POST/DELETE /woodpecker/sets, POST …/close. The
// server keeps a "book" set's first cycle (it closes it after four weeks
// and tunes the pool once), so the set is refetched whenever a screen
// mounts; the list too (another device may have started a set).

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
    staleTime: 30_000,
    retry: 1,
  });
}

const settle = (set: WoodpeckerSet) => {
  queryClient.setQueryData(woodpeckerKeys.set(set.id), set);
  void queryClient.invalidateQueries({ queryKey: woodpeckerKeys.sets() });
};

/**
 * Starts the method: a new "book" set for `style`; with `replace`, that
 * set goes to the archive once the new one exists (one active set: a
 * failed start keeps the old one).
 */
export function useStartSet() {
  return useMutation({
    mutationFn: async ({ style, replace }: { style: TrainingStyle; replace?: string | null }): Promise<WoodpeckerSet> => {
      const set = await api.woodpecker.create({ style });
      if (replace) await api.woodpecker.archive(replace).catch(() => undefined);
      return set;
    },
    onSuccess: settle,
  });
}

/** Ends the first cycle now: the set becomes the puzzles solved so far. */
export function useCloseFirstCycle() {
  return useMutation({ mutationFn: (id: string) => api.woodpecker.close(id), onSuccess: settle });
}

export function useArchiveSet() {
  return useMutation({
    mutationFn: (id: string) => api.woodpecker.archive(id),
    onSuccess: (_r, id) => queryClient.removeQueries({ queryKey: woodpeckerKeys.set(id) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: woodpeckerKeys.sets() }),
  });
}
