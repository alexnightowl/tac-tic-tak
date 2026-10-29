import * as Network from 'expo-network';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useShellStore } from '@/shell/store';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineStore } from './store';
import { requestSync } from './sync';

/**
 * Routes where a "Welcome back" sheet must not cut in: runners, drills,
 * onboarding, and the summary itself. It waits for the next calm screen.
 */
const BUSY = /^\/(play\/(?!norm$|theme-picker$)[^/]+|offline\/(solve|synced)|review\/.+|sessions\/[^/]+\/review|onboarding)/;

/**
 * Mounted once in the signed-in stack: runs the offline sync on app start,
 * on return to the foreground and when the network comes back (also when
 * the dev/e2e "force offline" switch is turned off), and shows the sync
 * summary once the player is not mid-puzzle.
 */
export function OfflineSyncHost() {
  const status = useAuthStore((s) => s.status);
  const pending = useOfflineStore((s) => s.summaryPending);
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'authed') return;
    void requestSync('start');
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void requestSync('foreground');
    });
    let online: boolean | null = null;
    const net = Network.addNetworkStateListener((s) => {
      const now = s.isConnected !== false && s.isInternetReachable !== false;
      if (online === false && now) void requestSync('network');
      online = now;
    });
    const forced = useShellStore.subscribe((s, prev) => {
      if (prev.forceOffline && !s.forceOffline) void requestSync('network');
    });
    return () => {
      app.remove();
      net.remove();
      forced();
    };
  }, [status]);

  useEffect(() => {
    if (!pending || BUSY.test(pathname)) return;
    useOfflineStore.getState().ackSummary();
    router.push('/offline/synced' as Href);
  }, [pending, pathname]);

  return null;
}
