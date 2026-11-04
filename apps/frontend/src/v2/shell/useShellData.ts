'use client';

import { queryKeys } from '@tac/core/api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore, type MouseEvent } from 'react';

import { getToken, http } from '@/lib/api';

type Pending = { incoming: unknown[]; outgoing: unknown[] };

/**
 * Incoming friend requests for the header avatar and the menu's Friends
 * row (app features/social/badge). Same key as the friends page, so an
 * accept there clears the badge; polls gently like the app.
 */
export function useIncomingRequestCount(): number {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(!!getToken()), []);
  const q = useQuery({
    queryKey: queryKeys.friendsPending(),
    queryFn: () => http.get<Pending>('/friends/pending'),
    enabled: signedIn,
    refetchInterval: 60_000,
  });
  return q.data?.incoming?.length ?? 0;
}

const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
}

/**
 * Re-selecting the active tab scrolls the page to the top (the app's
 * tabPress), instead of reloading the same route.
 */
export function scrollTopIfActive(active: boolean, reduced: boolean) {
  return (e: MouseEvent) => {
    if (!active || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };
}
