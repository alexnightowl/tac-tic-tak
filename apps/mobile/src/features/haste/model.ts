import { queryKeys } from '@tac/core/api';
import type { Language } from '@tac/core/i18n';
import { queryOptions } from '@tanstack/react-query';

import { api } from '@/platform/api';

// Haste indicator (D40): shared helpers for the runner nudge, the summary
// card and the Stats card (phone and desktop).

export const HASTE_DAYS = 30;

/** Under ['analytics']: a finished session refreshes it with the other stats. */
export const hasteQuery = () =>
  queryOptions({
    queryKey: queryKeys.haste(HASTE_DAYS),
    queryFn: () => api.haste(HASTE_DAYS),
  });

/** "1.2 s" / "1,2 с": one decimal under 10 s, whole seconds above. */
export function fmtSecs(ms: number, lang: Language, t: (k: string, v?: Record<string, string | number>) => string): string {
  const s = ms / 1000;
  const n = s >= 10 || Number.isInteger(s) ? String(Math.round(s)) : s.toFixed(1);
  return t('haste.secs', { n: lang === 'uk' ? n.replace('.', ',') : n });
}

export const pct = (share: number) => Math.round(share * 100);

/** The summary tip: none hasty, some, or at least half of the mistakes. */
export function hasteTipKey(hasty: number, mistakes: number): string {
  if (hasty === 0) return 'haste.tip_none';
  return hasty * 2 >= mistakes ? 'haste.tip_many' : 'haste.tip_some';
}

export type HasteTrend = { dir: 'down' | 'up' | 'same'; prev: number };

/** The trend against the previous period; null when it had no mistakes. */
export function hasteTrend(total: { share: number }, previous: { mistakes: number; share: number }): HasteTrend | null {
  if (previous.mistakes <= 0) return null;
  const now = pct(total.share);
  const prev = pct(previous.share);
  return { dir: now < prev ? 'down' : now > prev ? 'up' : 'same', prev };
}

/** "10.11" / "10 лист." style short date of a week's Monday (UTC). */
export function weekLabel(weekStart: string, locale: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
