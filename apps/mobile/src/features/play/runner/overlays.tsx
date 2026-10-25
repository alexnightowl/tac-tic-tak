import { fmtDuration } from '@tac/core/format';
import { control, eos, layout, radii, space, surface, transitions } from '@tac/core/tokens';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, PlateButton } from '@/ui';
import { Tap } from '@/ui/Tap';
import type { PlayT } from '../strings';

// Overlays that must keep the runner mounted (PLAN §2.3): the pause veil
// and the ExitSheet. Fades reuse the 200 ms toggle transition (no sheet
// token yet).
const t200 = transitions.toggle;
const ease = Easing.bezier(...t200.easing);
const fadeIn = FadeIn.duration(t200.duration).easing(ease);
const fadeOut = FadeOut.duration(t200.duration).easing(ease);

/**
 * web PauseOverlay: hides the position, shows the frozen time. Blur on
 * iOS, 92 % ink on Android (PLAN §2.5).
 */
export function PauseOverlay({ remainingMs, onResume, t }: { remainingMs: number; onResume: () => void; t: PlayT }) {
  return (
    <Animated.View entering={fadeIn} exiting={fadeOut} style={styles.fill} testID="pause-overlay">
      {Platform.OS === 'ios' ? (
        <>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.inkVeil]} />
      )}
      <View style={styles.pauseBody}>
        <AppText variant="display" testID="pause-remaining" style={styles.tabular}>
          {fmtDuration(Math.max(0, Math.ceil(remainingMs / 1000)))}
        </AppText>
        <AppText variant="title">{t('play.paused')}</AppText>
        <AppText variant="body" color={eos.ash} style={styles.center}>
          {t('play.paused_hint')}
        </AppText>
        <PlateButton testID="runner-resume" label={t('play.resume')} onPress={onResume} size="lg" style={styles.resume} />
      </View>
    </Animated.View>
  );
}

/** web ExitDialog as a bottom sheet: Save (early exit) / Discard / Keep playing. The clock keeps running. */
export function ExitSheet({
  onSave,
  onDiscard,
  onCancel,
  t,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  t: PlayT;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.fill} testID="exit-sheet">
      <Animated.View entering={fadeIn} exiting={fadeOut} style={StyleSheet.absoluteFill}>
        <Tap
          testID="exit-backdrop"
          accessibilityRole="button"
          accessibilityLabel={t('play.exit_keep')}
          onPress={onCancel}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(t200.duration).easing(ease)}
        exiting={SlideOutDown.duration(t200.duration).easing(ease)}
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}
        accessibilityViewIsModal
      >
        <AppText variant="title">{t('play.exit_title')}</AppText>
        <AppText variant="body" color={eos.ash}>
          {t('play.exit_dialog_hint')}
        </AppText>
        <View style={styles.sheetButtons}>
          <PlateButton testID="exit-save" label={t('play.exit_save')} onPress={onSave} size="lg" block />
          <Tap
            testID="exit-discard"
            accessibilityRole="button"
            accessibilityLabel={t('play.exit_discard')}
            onPress={onDiscard}
            style={styles.discard}
          >
            <AppText variant="plateLabel" color={control.dangerText}>
              {t('play.exit_discard')}
            </AppText>
          </Tap>
          <PlateButton testID="exit-keep" label={t('play.exit_keep')} onPress={onCancel} variant="slate" block />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, zIndex: 10 },
  backdrop: { backgroundColor: surface.backdrop },
  inkVeil: { backgroundColor: surface.inkVeil92 },
  pauseBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: layout.gutter * 2,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  // An inline PlateButton aligns itself flex-start; centre it (web items-center).
  resume: { marginTop: space[2], minWidth: space[20] * 2.5, alignSelf: 'center' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: space[3],
    paddingTop: space[5],
    paddingHorizontal: layout.gutter,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: eos.shade,
    borderTopWidth: 1,
    borderColor: surface.cardBorder,
  },
  sheetButtons: { gap: space[2.5], marginTop: space[2] },
  discard: {
    height: layout.plateHeight.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: control.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
