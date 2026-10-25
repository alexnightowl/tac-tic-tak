import { control, eos, easing, keyframes, layout, mixed, radii, semantic, shadows, space, surface, timing } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/ui/AppText';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { bezier } from '@/ui/motion';
import { Tap } from '@/ui/Tap';
import { OFFLINE_SLOT, useIsOffline } from '../OfflineBanner';
import { useToastStore, type Toast } from './store';

// Top-of-screen toasts (web ToastContainer, re-laid for phones per the
// inventory: drops from the top centre instead of sliding in from the
// right, swipe up to dismiss, exit animation). Toasts sit above every
// navigator, including iOS modals and sheets: on iOS they render in a
// FullWindowOverlay (its own UIWindow, which passes touches through
// outside its subviews). That window is mounted only while a toast shows:
// XCUITest (Maestro) reads just the topmost window, so a permanent one
// hides the whole app from e2e flows (a flow sees only the toast while one
// is up). The offline banner therefore lives in the app window
// (OfflineHost); toasts start below it while it shows.

const MAX_VISIBLE = 3;
const MAX_W = 360;
/** Web slideInRight (220 ms ease-out), re-aimed downward. */
const ENTER_MS = keyframes.slideInRight.duration;
const ENTER_EASE = bezier(keyframes.slideInRight.easing);
/** Mobile-only exit (the web toast just vanished): a touch quicker than the enter. */
const EXIT_MS = 180;
const EXIT_EASE = bezier(easing.easeIn);
/** Upward travel or fling that dismisses. */
const DISMISS_DY = -28;
const DISMISS_VY = -600;
/** Web border rgba(ember, .35); nearest baked token. */
const BORDER = mixed.heat2;

export function ToastHost() {
  const offline = useIsOffline();
  const any = useToastStore((s) => s.toasts.length > 0);
  if (!any) return null;
  const content = <ToastLayer offline={offline} />;
  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay>
        {/* A separate UIWindow: gestures need their own root there. */}
        <GestureHandlerRootView style={styles.overlayRoot} pointerEvents="box-none">
          {content}
        </GestureHandlerRootView>
      </FullWindowOverlay>
    );
  }
  return content;
}

function ToastLayer({ offline }: { offline: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toasts = useToastStore((s) => s.toasts);
  const visible = toasts.slice(0, MAX_VISIBLE);
  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { paddingTop: insets.top + space[2] + (offline ? OFFLINE_SLOT : 0) }]}
      testID="toast-host"
    >
      <View pointerEvents="box-none" style={[styles.column, { width: Math.min(MAX_W, width - space[6]) }]}>
        {visible.map((t) => (
          <ToastCard key={t.id} t={t} />
        ))}
      </View>
    </View>
  );
}

function ToastCard({ t }: { t: Toast }) {
  const tr = useT();
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const dismiss = useToastStore((s) => s.dismiss);
  const y = useSharedValue(reduced ? 0 : -96);
  const opacity = useSharedValue(0);
  const height = useSharedValue(96);
  const leaving = useSharedValue(false);

  // Exit runs on the UI thread; the store entry goes once it has finished.
  const leave = () => {
    'worklet';
    if (leaving.get()) return;
    leaving.set(true);
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(dismiss, t.id);
    };
    if (reduced) {
      opacity.set(withTiming(0, { duration: EXIT_MS }, done));
    } else {
      opacity.set(withTiming(0, { duration: EXIT_MS }));
      y.set(withTiming(-(height.get() + space[6]), { duration: EXIT_MS, easing: EXIT_EASE }, done));
    }
  };

  useEffect(() => {
    opacity.set(withTiming(1, { duration: ENTER_MS, easing: ENTER_EASE }));
    if (!reduced) y.set(withTiming(0, { duration: ENTER_MS, easing: ENTER_EASE }));
    const ms = t.durationMs ?? timing.toastDismiss;
    if (ms <= 0) return;
    const id = setTimeout(leave, ms);
    return () => clearTimeout(id);
    // Mount-only: one enter + one timer per toast id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      if (leaving.get()) return;
      // Free upward, rubber-banded downward.
      y.set(e.translationY < 0 ? e.translationY : e.translationY * 0.2);
    },
    onDeactivate: (e) => {
      'worklet';
      if (leaving.get()) return;
      if (e.translationY < DISMISS_DY || e.velocityY < DISMISS_VY) leave();
      else y.set(withSpring(0, { damping: 20, stiffness: 260 }));
    },
  });

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: y.get() }],
  }));

  const Icon = t.icon ?? Trophy;
  const eyebrow = tr(t.tone === 'achievement' ? 'shell.toast.achievement' : 'shell.toast.notice');

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, style]}
        onLayout={(e) => height.set(e.nativeEvent.layout.height)}
        testID={`toast-${t.tone}`}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <LinearGradient
          colors={[control.rankProgress[1], control.rankProgress[0]]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.iconTile}
        >
          <Icon size={20} color={semantic.accentContrast} />
        </LinearGradient>
        <View style={styles.text}>
          <AppText variant="label" color={eos.rose}>
            {eyebrow}
          </AppText>
          <AppText
            variant="body"
            numberOfLines={1}
            style={[styles.title, { fontFamily: fontFamily(lang, 'body', 600) }]}
            testID="toast-title"
          >
            {t.title}
          </AppText>
          {t.description ? (
            <AppText variant="caption" numberOfLines={2} testID="toast-description">
              {t.description}
            </AppText>
          ) : null}
        </View>
        <Tap
          testID="toast-dismiss"
          accessibilityRole="button"
          accessibilityLabel={tr('shell.toast.dismiss')}
          onPress={() => leave()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.close}
        >
          <X size={14} color={eos.ash} />
        </Tap>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  overlayRoot: { flex: 1 },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center' },
  column: { gap: space[2] },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: surface.floatCard,
    boxShadow: shadows.floatCard,
  },
  iconTile: {
    width: layout.toastIcon,
    height: layout.toastIcon,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  title: { color: eos.bone },
  close: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginTop: -space[1], marginRight: -space[1] },
});
