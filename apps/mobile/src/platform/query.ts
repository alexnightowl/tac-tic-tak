import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { focusManager, keepPreviousData, onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

import { APP_VERSION } from './config';
import { queryKV } from './storage';

/** PLAN §2.4: persisted read-screen cache lives at most a week. */
const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// One QueryClient for the app. Defaults copy the web Providers (retry 1,
// keepPreviousData, 30 s staleTime); "window focus" is the app returning
// to the foreground, which replaces the web's global pull-to-refresh.
// gcTime matches the persist window: a query evicted from memory would
// also vanish from the persisted snapshot.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
      gcTime: PERSIST_MAX_AGE,
    },
  },
});

/**
 * The cache snapshot goes to MMKV `query` (synchronous JSI, so the restore
 * is a single read). resetAll() wipes that instance on logout.
 */
const persister = createSyncStoragePersister({
  storage: {
    getItem: (k) => queryKV.getString(k) ?? null,
    setItem: (k, v) => queryKV.set(k, v),
    removeItem: (k) => {
      queryKV.remove(k);
    },
  },
  key: 'rq-cache',
  throttleTime: 1000,
});

/**
 * Read screens only: a query opts out with `meta: { persist: false }`
 * (anything session-bound, e.g. a runner's next puzzle). Only successful
 * data is written; errors and pending states never survive a restart.
 */
function shouldPersist(q: Query): boolean {
  return q.state.status === 'success' && q.meta?.persist !== false;
}

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: PERSIST_MAX_AGE,
  // A new app version can change response shapes: start from an empty cache.
  buster: APP_VERSION,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
};

let wired = false;

/** Wires focusManager to AppState and onlineManager to expo-network. Idempotent. */
export function wireQueryManagers(): void {
  if (wired) return;
  wired = true;
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (s) => {
      if (Platform.OS !== 'web') setFocused(s === 'active');
    });
    return () => sub.remove();
  });
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((s) => {
      // isInternetReachable is undefined while unknown: only a definite
      // "no" pauses queries, so a slow probe never blocks the first fetch.
      setOnline(s.isConnected !== false && s.isInternetReachable !== false);
    });
    return () => sub.remove();
  });
}
