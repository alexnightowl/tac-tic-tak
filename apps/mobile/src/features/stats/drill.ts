import { router } from 'expo-router';

import { useThemePick } from '@/features/play/startSession';
import { reviewApi } from '@/features/review/api';
import { toast } from '@/shell/toast/store';
import { appStore } from '@/stores/appStore';
import { translatorFor } from '@/ui/lang';

/**
 * Themes list / recommendation tap (new: the web rows had no action). A
 * drill needs a queued review puzzle of that theme; with none queued, the
 * Play tab opens with the theme picked for a theme session instead.
 */
export async function startThemeDrill(slug: string): Promise<void> {
  try {
    const list = await reviewApi.list(slug);
    const first = list[0];
    if (first) {
      router.push({ pathname: '/review/[puzzleId]', params: { puzzleId: first.puzzleId, theme: slug } });
      return;
    }
    useThemePick.getState().setTheme(slug);
    router.navigate({ pathname: '/play', params: { mode: 'theme', at: String(Date.now()) } });
  } catch {
    toast.show({ title: translatorFor(appStore.getState().settings.language).t('stats.drill_failed') });
  }
}
