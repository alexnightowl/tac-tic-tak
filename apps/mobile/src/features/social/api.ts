import { queryKeys, type Progression } from '@tac/core/api';
import type { SessionRow } from '@tac/core/format';
import type { TrainingStyle } from '@tac/core/rules';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/platform/api';

// Social routes on today's API (inventory social.md): leaderboard, friends,
// pending requests, user search, friendship state, public profile.

export type UserCard = {
  id: string;
  nickname: string;
  displayName: string | null;
  avatarUrl: string | null;
  country: string | null;
  verified?: boolean;
};

export type LeaderboardScope = 'global' | 'friends';

export type LeaderboardRow = {
  rank: number;
  rating: number;
  unlocked: number;
  isSelf: boolean;
  streakDays: number;
  streakLastDay: string | null;
  user: UserCard;
};

export type FriendRow = { friendshipId: string; since: string | null; user: UserCard };
export type PendingRow = { id: string; createdAt: string; user: UserCard };
export type Pending = { incoming: PendingRow[]; outgoing: PendingRow[] };

export type FriendshipState = 'none' | 'self' | 'outgoing' | 'incoming' | 'friends';
export type FriendshipStatus = { state: FriendshipState; friendshipId: string | null };

export type SearchResult = UserCard & { friendship: FriendshipStatus };

export type PublicProfile = {
  id: string;
  nickname: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  createdAt: string;
  verified?: boolean;
  progressions: Partial<Record<TrainingStyle, Progression>>;
  allTimePeak: number | null;
  streak?: { days: number; freezes: number; lastDay: string | null };
  recentSessions: SessionRow[];
};

type Unlocks = { achievementsUnlocked?: string[] };

/** Top N; the viewer's own row outside it needs B13 `me` (LEADERBOARD_ME_ROW). */
export const LEADERBOARD_LIMIT = 100;

export const leaderboardQuery = (style: TrainingStyle, scope: LeaderboardScope) =>
  queryOptions({
    queryKey: queryKeys.leaderboard(style, scope),
    queryFn: ({ signal }) =>
      apiClient.get<LeaderboardRow[]>('/leaderboard', { query: { style, scope, limit: LEADERBOARD_LIMIT }, signal }),
  });

export const friendsQuery = () =>
  queryOptions({
    queryKey: queryKeys.friends(),
    queryFn: ({ signal }) => apiClient.get<FriendRow[]>('/friends', { signal }),
  });

export const pendingQuery = () =>
  queryOptions({
    queryKey: queryKeys.friendsPending(),
    queryFn: ({ signal }) => apiClient.get<Pending>('/friends/pending', { signal }),
    // Drives the Social badge: poll gently while the app is open (push for
    // requests arrives with B15 / Phase 10).
    refetchInterval: 60_000,
  });

const nick = (n: string) => encodeURIComponent(n);

/** Cache keys are lower-cased: the web keyed on raw route casing, so two
 *  casings of one nickname were two cache entries (inventory social.md). */
export const profileQuery = (nickname: string) =>
  queryOptions({
    queryKey: queryKeys.profile(nickname.toLowerCase()),
    queryFn: ({ signal }) => apiClient.get<PublicProfile>(`/users/by-nickname/${nick(nickname)}`, { signal }),
    retry: (n, e) => (e as { status?: number }).status !== 404 && n < 1,
  });

export const friendshipQuery = (nickname: string) =>
  queryOptions({
    queryKey: queryKeys.friendshipWith(nickname.toLowerCase()),
    queryFn: ({ signal }) =>
      apiClient.get<FriendshipStatus>(`/users/by-nickname/${nick(nickname)}/friendship`, { signal }),
    meta: { persist: false },
  });

/** Never persisted, never placeholder-kept: a stale list for another query
 *  must not flash under a new one. */
export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ['user-search', q.toLowerCase()] as const,
    // react-query aborts the signal when the key changes, so a slow older
    // response can never overwrite newer results (web bug).
    queryFn: ({ signal }) => apiClient.get<SearchResult[]>('/users/search', { query: { q }, signal }),
    enabled: q.length >= 2,
    staleTime: 10_000,
    gcTime: 60_000,
    placeholderData: undefined,
    meta: { persist: false },
  });

export const friendsApi = {
  /** Also accepts: the server auto-accepts when the target already asked us. */
  request: (nickname: string) => apiClient.post<Unlocks & { status?: string }>('/friends/request', { nickname }),
  accept: (id: string) => apiClient.post<Unlocks>(`/friends/${encodeURIComponent(id)}/accept`),
  /** Decline an incoming or cancel an outgoing request. */
  remove: (id: string) => apiClient.del<unknown>(`/friends/${encodeURIComponent(id)}`),
  unfriend: (userId: string) => apiClient.del<unknown>(`/friends/by-user/${encodeURIComponent(userId)}`),
};
