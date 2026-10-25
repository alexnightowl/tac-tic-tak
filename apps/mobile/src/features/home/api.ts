import { queryKeys } from '@tac/core/api';
import type { SessionRow } from '@tac/core/format';
import type { TrainingStyle } from '@tac/core/rules';

import { apiClient } from '@/platform/api';
import { appKV, readJSON, writeJSON } from '@/platform/storage';

/**
 * GET /analytics (no style filter): the Home dashboard's data. `lifetime`
 * is in the response but was missing from the web Overview type, which is
 * why the web Sessions tile counted the take-20 recentSessions (fix).
 */
export type Overview = {
  recentSessions: SessionRow[];
  allTimePeak: number;
  lifetime?: { solved: number; attempts: number; accuracy: number; peakRating: number; sessions: number };
};

/** Same key and body as the web dashboard (['overview']), shared with Stats. */
export const overviewQuery = {
  queryKey: queryKeys.overview(),
  queryFn: () => apiClient.get<Overview>('/analytics'),
};

/** Mobile-only device pref: ratings as Home last showed them (count-up deltas). */
const LAST_SEEN_KEY = 'taktic.lastSeenRatings';

export type SeenRatings = Partial<Record<TrainingStyle, number>>;

/** Keyed by account, so a second account on the device starts fresh. */
export function readLastSeenRatings(userId: string): SeenRatings {
  const v = readJSON<{ uid?: string; ratings?: SeenRatings }>(appKV, LAST_SEEN_KEY, {});
  return v.uid === userId && v.ratings ? v.ratings : {};
}

export function writeLastSeenRatings(userId: string, ratings: SeenRatings): void {
  writeJSON(appKV, LAST_SEEN_KEY, { uid: userId, ratings });
}
