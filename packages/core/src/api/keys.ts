// react-query keys, mirroring the web's literal keys so invalidation rules
// port 1:1 (grep `queryKey:` in apps/frontend). `me` is new: the web kept
// /users/me outside react-query (providers.tsx); PLAN §2.4 names ['me'].
import type { TrainingStyle } from '../rules';

export const queryKeys = {
  me: () => ['me'] as const,
  overview: () => ['overview'] as const,
  analytics: (filter: string) => ['analytics', filter] as const,
  analyticsAll: () => ['analytics'] as const,
  analyticsThemes: (filter: string) => ['analytics-themes', filter] as const,
  analyticsThemesAll: () => ['analytics-themes'] as const,
  analyticsRec: (filter: string) => ['analytics-rec', filter] as const,
  analyticsTimeline: () => ['analytics-timeline'] as const,
  reviewThemes: () => ['review-themes'] as const,
  /** Web passes '__all__' for the unfiltered drill list. */
  reviewList: (theme: string) => ['review-list', theme] as const,
  session: (id: string) => ['session', id] as const,
  sessionReviewItems: (id: string) => ['session-review-items', id] as const,
  leaderboard: (style: TrainingStyle, scope: string) => ['leaderboard', style, scope] as const,
  puzzle: (id: string) => ['puzzle', id] as const,
  profile: (nickname: string) => ['profile', nickname] as const,
  profileThemes: (nickname: string) => ['profile-themes', nickname] as const,
  profileTimeline: (nickname: string) => ['profile-timeline', nickname] as const,
  friends: () => ['friends'] as const,
  friendsPending: () => ['friends-pending'] as const,
  friendshipWith: (nickname: string) => ['friendship-with', nickname] as const,
  achievements: () => ['achievements'] as const,
} as const;
