import { queryKeys, type SessionDetail } from '@tac/core/api';
import type { SessionRow } from '@tac/core/format';
import type { ServerPuzzle } from '@tac/core/puzzle';
import type { ReviewListItem, ReviewThemeRow, SessionReviewItem } from '@tac/core/runner';

import { apiClient } from '@/platform/api';

// Review / puzzle / session-history routes of today's API (apps/backend
// review, puzzles, sessions, analytics controllers). They are not in
// @tac/core/api's endpoint list yet (the Phase 2 slice only); paths and
// query keys copy the web call sites so the caches line up.

const enc = encodeURIComponent;

/** GET /analytics: the web dashboard's `recentSessions` is today's only history source. */
export type OverviewResponse = {
  recentSessions: SessionRow[];
  allTimePeak?: number;
  lifetime?: Record<string, number>;
};

export const reviewApi = {
  themes: () => apiClient.get<ReviewThemeRow[]>('/review/themes'),
  list: (theme?: string) => apiClient.get<ReviewListItem[]>('/review', { query: { theme } }),
  /** 404 when the puzzle has no ReviewItem for this user. */
  puzzle: (id: string) => apiClient.get<ServerPuzzle>(`/review/${enc(id)}`),
  /** 500s on a missing item (Prisma update); callers swallow errors as the web did. */
  resolve: (id: string) => apiClient.post<{ ok: true }>(`/review/${enc(id)}/resolve`),
};

export const puzzleApi = {
  /** Anti-spoiler: 404 unless the user has an attempt on this puzzle. */
  get: (id: string) => apiClient.get<ServerPuzzle>(`/puzzles/${enc(id)}`),
};

export const sessionApi = {
  detail: (id: string) => apiClient.get<SessionDetail>(`/sessions/${enc(id)}`),
  reviewItems: (id: string) => apiClient.get<{ items: SessionReviewItem[] }>(`/sessions/${enc(id)}/review-items`),
  remove: (id: string) => apiClient.del<{ ok: true }>(`/sessions/${enc(id)}`),
  /** Latest 20 finished sessions; paginated history needs B9. */
  overview: () => apiClient.get<OverviewResponse>('/analytics'),
};

/** Query keys (web literals, from @tac/core/api). */
export const reviewKeys = {
  themes: queryKeys.reviewThemes,
  list: (theme: string | undefined) => queryKeys.reviewList(theme ?? '__all__'),
  reviewPuzzle: (id: string) => ['review-puzzle', id] as const,
  puzzle: queryKeys.puzzle,
  session: queryKeys.session,
  sessionReviewItems: queryKeys.sessionReviewItems,
  overview: queryKeys.overview,
};
