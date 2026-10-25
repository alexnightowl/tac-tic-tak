import { focusManager, keepPreviousData, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

// One QueryClient for the app. Defaults copy the web Providers (retry 1,
// keepPreviousData, 30 s staleTime); "window focus" is the app returning
// to the foreground, which replaces the web's global pull-to-refresh.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
    },
  },
});

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
