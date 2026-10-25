import { eos, radii, space, surface } from '@tac/core/tokens';
import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/ui/AppText';
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
 * root layout. Not touchable. Read screens keep rendering from the
 * persisted query cache underneath. Lives in the app window, not the
 * toast overlay window, so e2e flows can still see the app while offline.
 */
export function OfflineHost() {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  if (!offline) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + space[2] }]}>
      <OfflineBanner />
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
      pointerEvents="none"
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
