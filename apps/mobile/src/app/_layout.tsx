import { eos } from '@tac/core/tokens';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { boot } from '@/features/auth/session';
import { preloadSounds } from '@/feel';
import { persistOptions, queryClient, wireQueryManagers } from '@/platform/query';
import { ShellErrorBoundary } from '@/shell/ErrorScreen';
import { OfflineHost } from '@/shell/OfflineBanner';
import { ToastHost } from '@/shell/toast/ToastHost';
import { useToastStore } from '@/shell/toast/store';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { LangProvider } from '@/ui/lang';

// Module scope, before the first render: hold the splash while a stored
// session's keychain read runs (MMKV state is already synchronous), and
// start that read as early as possible.
void SplashScreen.preventAutoHideAsync();
wireQueryManagers();
void boot();

/** Never trap the user behind the splash if the keychain read stalls. */
const SPLASH_MAX_MS = 3000;

/** A crash anywhere below the root lands here instead of a red screen / blank app. */
export const ErrorBoundary = ShellErrorBoundary;

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const signedIn = status !== 'anon';
  const lang = useAppStore((s) => s.settings.language);

  // Decode every short clip up front: without it the first sound of a
  // session lands ~200 ms late.
  useEffect(() => {
    void preloadSounds();
    const t = setTimeout(() => SplashScreen.hide(), SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status !== 'booting') SplashScreen.hide();
    // A previous account's toasts must not show over the login screen.
    if (status === 'anon') useToastStore.getState().clear();
  }, [status]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: eos.ink }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <LangProvider lang={lang}>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: eos.ink } }}>
                {/* PLAN §2.3 guard. A booting session counts as signed in, so a
                    cold start with a stored session lands on the cached Home. */}
                <Stack.Protected guard={!signedIn} redirectTo="/">
                  <Stack.Screen name="(auth)" />
                </Stack.Protected>
                <Stack.Protected guard={signedIn} redirectTo="/login">
                  <Stack.Screen name="(app)" />
                </Stack.Protected>
                {/* Dev labs stay reachable signed in or out (open-dev on both). */}
                <Stack.Screen name="dev" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <OfflineHost />
              {/* Above every navigator, iOS modals included (FullWindowOverlay). */}
              <ToastHost />
            </LangProvider>
          </PersistQueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
