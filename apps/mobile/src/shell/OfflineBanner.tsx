import { eos, radii, space, surface } from '@tac/core/tokens';
import { useNetworkState } from 'expo-network';
import { router, usePathname, type Href } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { Tap } from '@/ui/Tap';
import { useT } from '@/ui/lang';
import { useShellStore } from './store';

/**
 * Only a definite "no" counts: isInternetReachable is undefined while iOS
 * is still probing, and a cold start must not flash the banner.
 */
export function useIsOffline(): boolean {
  const net = useNetworkState();
  const forced = useShellStore((s) => s.forceOffline);
  return forced || net.isConnected === false || net.isInternetReachable === false;
}

/** Height the pill takes at the top; toasts start below it. */
export const OFFLINE_SLOT = 36;

/**
 * Offline pill over the top of the app window (PLAN §2.10), mounted in the
 * root layout. Signed in, a tap opens Offline puzzles (OFFLINE.md entry
 * points); signed out it is not touchable. Read screens keep rendering from the
 * persisted query cache underneath. Lives in the app window, not the
 * toast overlay window, so e2e flows can still see the app while offline.
 */
export function OfflineHost() {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  const signedIn = useAuthStore((s) => s.status === 'authed');
  const pathname = usePathname();
  const t = useT();
  // The offline screens carry their own offline state (note, OFFLINE chip).
  if (!offline || pathname.startsWith('/offline')) return null;
  // No link where a tap would pull the player out of a runner.
  const linked = signedIn && !/^\/(play\/[^/]+$|review\/|sessions\/[^/]+\/review|onboarding)/.test(pathname);
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + space[2] }]}>
      {linked ? (
        <Tap
          testID="offline-banner-link"
          accessibilityRole="link"
          accessibilityLabel={`${t('shell.offline')}. ${t('offline.title')}`}
          onPress={() => router.push('/offline?from=pill' as Href)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <OfflineBanner />
        </Tap>
      ) : (
        <View pointerEvents="none">
          <OfflineBanner />
        </View>
      )}
    </View>
  );
}

function OfflineBanner() {
  const t = useT();
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      style={styles.pill}
      testID="offline-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <WifiOff size={14} color={eos.ash} />
      <AppText variant="caption" numberOfLines={1} style={styles.text}>
        {t('shell.offline')}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: eos.seam,
    backgroundColor: surface.floatCard,
  },
  text: { color: eos.bone, flexShrink: 1 },
});
