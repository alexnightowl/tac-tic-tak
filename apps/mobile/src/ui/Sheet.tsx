import { layout, radii, space, surface } from '@tac/core/tokens';
import type { ReactNode } from 'react';
import { Modal, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { SHEET_DISMISS, sheetSpring, sheetTiming } from './motion';
import { Tap } from './Tap';

export type GrabberTone = 'seam' | 'ash' | 'glass' | 'light' | 'iron';

const GRABBER: Record<GrabberTone, string> = {
  seam: surface.grabber,
  ash: surface.grabberAsh,
  glass: surface.grabberGlass,
  light: surface.grabberLight,
  iron: surface.grabberIron,
};

/**
 * 36 × 5 sheet grabber. Inline (default) it sits centred with 8 pt below
 * (confirm sheets); `floating` pins it 5 pt from the top edge, centred
 * (account menu, streak, achievement sheets drawn over route sheets).
 */
export function SheetGrabber({ tone = 'seam', floating = false }: { tone?: GrabberTone; floating?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.grabber, { backgroundColor: GRABBER[tone] }, floating ? styles.grabberFloating : styles.grabberInline]}
    />
  );
}

/**
 * Bottom sheet over everything, native header included (RN Modal with its
 * own gesture root). Design v2 confirm sheets (Reset, Exit, sound variant):
 * shade ground, radius 16 top corners, 1 pt bone/4 % top rule, padding
 * 12/16 (20 without the grabber), bottom = home indicator + 8, gap 12;
 * backdrop ink/70 fades in while the panel slides up (200 ms ease-out).
 * The backdrop and a downward drag (80 pt or a fling) call `onClose`.
 */
export function Sheet({
  visible,
  onClose,
  testID,
  closeLabel,
  grabber = true,
  dismissible = true,
  children,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  testID: string;
  /** a11y label of the backdrop ("Cancel" / "Keep playing"). */
  closeLabel: string;
  grabber?: boolean;
  /** False: the backdrop and the drag do nothing (busy confirmations). */
  dismissible?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* The Modal is its own window: measure its insets here, or a sheet
          opened from a tab inherits the tab scene's zeroed bottom inset. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.fill}>
        <GestureHandlerRootView style={styles.fill}>
          {visible ? (
            <SheetBody
              onClose={onClose}
              testID={testID}
              closeLabel={closeLabel}
              grabber={grabber}
              dismissible={dismissible}
              style={style}
            >
              {children}
            </SheetBody>
          ) : null}
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  );
}

/**
 * The sheet without the Modal, for overlays that must stay inside a screen
 * (the runner's ExitSheet keeps the board mounted underneath). Render it
 * conditionally inside an absolutely-filled parent.
 */
export function SheetBody({
  onClose,
  testID,
  closeLabel,
  grabber = true,
  dismissible = true,
  children,
  style,
}: {
  onClose: () => void;
  testID: string;
  closeLabel: string;
  grabber?: boolean;
  dismissible?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const drag = useSharedValue(0);

  const pan = usePanGesture({
    enabled: dismissible,
    activeOffsetY: 8,
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      // Free downward, rubber-banded upward.
      drag.set(e.translationY > 0 ? e.translationY : e.translationY * 0.15);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > SHEET_DISMISS.distance || e.velocityY > SHEET_DISMISS.velocity) {
        scheduleOnRN(onClose);
      } else {
        drag.set(withSpring(0, sheetSpring));
      }
    },
  });
  const follow = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));

  const fadeIn = reduced ? undefined : FadeIn.duration(sheetTiming.duration ?? 200).easing(sheetTiming.easing!);
  const slideIn = reduced ? FadeIn.duration(120) : SlideInDown.duration(sheetTiming.duration ?? 200).easing(sheetTiming.easing!);
  const slideOut = reduced ? FadeOut.duration(120) : SlideOutDown.duration(sheetTiming.duration ?? 200);

  return (
    <View style={styles.fill} testID={testID}>
      <Animated.View entering={fadeIn} exiting={FadeOut} style={styles.fill}>
        <Tap
          testID={`${testID}-backdrop`}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={dismissible ? onClose : undefined}
          style={[styles.fill, styles.backdrop]}
        />
      </Animated.View>
      <Animated.View entering={slideIn} exiting={slideOut} style={styles.dock} pointerEvents="box-none">
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.panel,
              {
                paddingTop: grabber ? layout.sheetPadTop : layout.sheetPadTopPlain,
                paddingBottom: Math.max(insets.bottom, space[4]) + layout.sheetPadBottom,
              },
              follow,
              style,
            ]}
            accessibilityViewIsModal
          >
            {grabber ? <SheetGrabber /> : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  backdrop: { backgroundColor: surface.backdrop },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  panel: {
    gap: space[3],
    paddingHorizontal: layout.gutter,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: surface.sheet,
    borderTopWidth: 1,
    borderColor: surface.sheetBorder,
  },
  grabber: { width: layout.grabber.width, height: layout.grabber.height, borderRadius: radii.full },
  grabberInline: { alignSelf: 'center', marginBottom: space[2] },
  grabberFloating: {
    position: 'absolute',
    top: 5,
    left: '50%',
    marginLeft: -layout.grabber.width / 2,
  },
});
