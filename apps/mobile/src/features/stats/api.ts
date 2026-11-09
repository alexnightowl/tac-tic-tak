import { queryKeys } from '@tac/core/api';
import { levelPoints, type RatingPoint } from '@tac/core/charts';
import type { TrainingStyle } from '@tac/core/rules';
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
  /** 'mixed' | 'casual' | 'theme' (older servers don't send it). */
  mode?: string | null;
  /** 'v2' for Play v2 sessions, null for the old norm rules (older servers don't send it). */
  ruleset?: string | null;
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

/**
 * D39 "Level over time": each rated v2 session at the level it started at
 * (core levelPoints). The chart component keeps its RatingPoint shape.
 */
export function toLevelPoints(timeline: TimelinePoint[] | undefined): RatingPoint[] {
  return levelPoints(timeline);
}

/** @deprecated D39: the rating is gone; same as toLevelPoints (the web plotted the peak rating). */
export const toRatingPoints = toLevelPoints;
