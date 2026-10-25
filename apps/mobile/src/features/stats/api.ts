import { queryKeys } from '@tac/core/api';
import { isTrainingStyle, type TrainingStyle } from '@tac/core/rules';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/platform/api';

// Analytics routes (today's /api/analytics*, inventory stats-settings-shell.md)
// and the public-profile twins (/users/by-nickname/:n/themes|timeline). Typed
// here rather than in core's endpoint list, which only covers the Phase 2
// slice; fold into core when the contract settles (B-series).

export type StyleFilter = 'all' | TrainingStyle;

export type Overview = {
  allTimePeak: number;
  lifetime: { solved: number; attempts: number; accuracy: number; peakRating: number; sessions: number };
};

export type ThemeRow = {
  slug: string;
  attempts: number;
  failures: number;
  avgResponseMs: number;
  failureRate: number;
  weakness: number;
  rating: number;
};

export type Recommendation = { theme: string | null; reason: string };

export type TimelinePoint = {
  id: string;
  endedAt: string;
  style: string;
  startRating: number;
  peakRating: number;
  solved: number;
  durationSec: number;
};

const styleQuery = (f: StyleFilter) => (f === 'all' ? undefined : { style: f });

export const overviewQuery = (f: StyleFilter) =>
  queryOptions({
    queryKey: queryKeys.analytics(f),
    queryFn: ({ signal }) => apiClient.get<Overview>('/analytics', { query: styleQuery(f), signal }),
  });

export const themesQuery = (f: StyleFilter) =>
  queryOptions({
    queryKey: queryKeys.analyticsThemes(f),
    queryFn: ({ signal }) => apiClient.get<ThemeRow[]>('/analytics/themes', { query: styleQuery(f), signal }),
  });

export const recommendationQuery = (f: StyleFilter) =>
  queryOptions({
    queryKey: queryKeys.analyticsRec(f),
    queryFn: ({ signal }) =>
      apiClient.get<Recommendation>('/analytics/recommendations', { query: styleQuery(f), signal }),
  });

/** Unfiltered on purpose (web): the heatmap counts every style; the rating
 *  chart dims the others instead of dropping them. */
export const timelineQuery = () =>
  queryOptions({
    queryKey: queryKeys.analyticsTimeline(),
    queryFn: ({ signal }) => apiClient.get<TimelinePoint[]>('/analytics/timeline', { query: { days: 365 }, signal }),
  });

const nick = (n: string) => encodeURIComponent(n);

export const profileThemesQuery = (nickname: string) =>
  queryOptions({
    queryKey: queryKeys.profileThemes(nickname.toLowerCase()),
    queryFn: ({ signal }) => apiClient.get<ThemeRow[]>(`/users/by-nickname/${nick(nickname)}/themes`, { signal }),
  });

export const profileTimelineQuery = (nickname: string) =>
  queryOptions({
    queryKey: queryKeys.profileTimeline(nickname.toLowerCase()),
    queryFn: ({ signal }) =>
      apiClient.get<TimelinePoint[]>(`/users/by-nickname/${nick(nickname)}/timeline`, { signal }),
  });

/** Web ratingPoints: training-style sessions, peak rating per session. */
export function toRatingPoints(timeline: TimelinePoint[] | undefined) {
  if (!timeline) return [];
  return timeline
    .filter((p) => isTrainingStyle(p.style))
    .map((p) => ({ endedAt: p.endedAt, style: p.style as TrainingStyle, rating: p.peakRating }));
}
