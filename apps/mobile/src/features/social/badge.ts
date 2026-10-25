import { useQuery } from '@tanstack/react-query';

import { useIsSignedIn } from '@/stores/authStore';
import { pendingQuery } from './api';

/**
 * Incoming friend requests, for the Social tab badge and the Friends
 * segment (PLAN Phase 8). Polls every minute while mounted; the tab bar
 * (shell) should render it on the Social tab.
 */
export function useIncomingRequestCount(): number {
  const signedIn = useIsSignedIn();
  const q = useQuery({ ...pendingQuery(), enabled: signedIn });
  return q.data?.incoming.length ?? 0;
}
