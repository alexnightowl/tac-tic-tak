import { queryKeys } from '@tac/core/api';
import type { Achievement } from '@tac/core/catalogs';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/platform/api';
import { queryClient } from '@/platform/query';
import { toast } from '@/shell/toast/store';
import { appStore } from '@/stores/appStore';
import { translatorFor } from '@/ui/lang';

/**
 * Hidden from the grid and from the done/total count:
 *  - star-repo: PLAN §8 #16 (PROVISIONAL Q16), the trust-based "star the
 *    repo" unlock (store review risk), kept on the web;
 *  - set-accent, set-board: the app has no accent or board-theme setting
 *    (DECISIONS #19), so they can't be earned here, and the design v2
 *    "Style" section leaves them out.
 */
export const HIDDEN_ACHIEVEMENTS = new Set<string>(['star-repo', 'set-accent', 'set-board']);

export const achievementsQuery = () =>
  queryOptions({
    queryKey: queryKeys.achievements(),
    queryFn: ({ signal }) => apiClient.get<Achievement[]>('/achievements', { signal }),
    select: (list) => list.filter((a) => !HIDDEN_ACHIEVEMENTS.has(a.slug)),
  });

/**
 * Web catch-all: POST /achievements/evaluate on opening the grid picks up
 * unlocks the inline write paths missed; new ones toast and refresh.
 */
export async function evaluateAchievements(): Promise<void> {
  try {
    const r = await apiClient.post<{ newly: string[] }>('/achievements/evaluate', {});
    const newly = (r?.newly ?? []).filter((s) => !HIDDEN_ACHIEVEMENTS.has(s));
    if (newly.length === 0) return;
    toast.achievements(newly, translatorFor(appStore.getState().settings.language).t);
    void queryClient.invalidateQueries({ queryKey: queryKeys.achievements() });
  } catch {
    // Best effort, as on the web.
  }
}
