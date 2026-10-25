import { control, eos, fontSize, layout, radii, space, surface, transitions } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/ui/AppText';
import { Tap } from '@/ui/Tap';
import { Toggle } from '@/ui/Toggle';

// Building blocks of the settings screens: an iOS-style grouped list in the
// ember-on-stone look (slate groups, ash labels, ink seams), the web's
// ToggleRow / labelled Segmented, and a destructive confirm sheet.

/** Push screen shell: native header title, scrolling body padded to the home indicator. */
export function SettingsPage({
  testID,
  title,
  children,
  keyboard = false,
}: {
  testID: string;
  title: string;
  children: ReactNode;
  /** Forms: keep the focused field above the keyboard. */
  keyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const content = [styles.scroll, { paddingBottom: insets.bottom + space[8] }];
  return (
    <View style={styles.root} testID={testID}>
      <Stack.Screen options={{ title }} />
      {keyboard ? (
        <KeyboardAwareScrollView
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          bottomOffset={space[6]}
          testID={`${testID}-scroll`}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          testID={`${testID}-scroll`}
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}

/** A titled group of rows; children are separated by a 1 pt ink seam. */
export function Section({
  title,
  footer,
  children,
  testID,
}: {
  title?: string;
  footer?: string | null;
  children: ReactNode;
  testID?: string;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section} testID={testID}>
      {title ? (
        <AppText variant="label" accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </AppText>
      ) : null}
      <View style={styles.group}>
        {items.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {i > 0 ? <View style={styles.seam} /> : null}
            {child}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <AppText variant="caption" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

type RowText = { label: string; hint?: string | null };

function RowLabel({ label, hint, color }: RowText & { color?: string }) {
  return (
    <View style={styles.rowText}>
      <AppText variant="body" style={[styles.rowLabel, color ? { color } : null]}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="caption" style={styles.rowHint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Tappable row that pushes a screen (chevron) or runs an action. */
export function NavRow({
  icon: Icon,
  label,
  hint,
  value,
  onPress,
  testID,
  danger = false,
  disabled = false,
  chevron = true,
}: RowText & {
  icon?: LucideIcon;
  value?: string | null;
  onPress: () => void;
  testID: string;
  danger?: boolean;
  disabled?: boolean;
  chevron?: boolean;
}) {
  const color = danger ? control.dangerText : undefined;
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && styles.disabled]}
    >
      {Icon ? <Icon size={20} color={danger ? control.dangerText : eos.ash} strokeWidth={1.8} /> : null}
      <RowLabel label={label} hint={hint} color={color} />
      {value ? (
        <AppText variant="body" color={eos.ash} numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {chevron && !danger ? <ChevronRight size={18} color={eos.dust} /> : null}
    </Tap>
  );
}

/** web ToggleRow: title + hint on the left, the carved switch on the right. */
export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  testID,
  disabled,
}: RowText & { value: boolean; onChange: (v: boolean) => void; testID: string; disabled?: boolean }) {
  return (
    <View style={styles.row}>
      <RowLabel label={label} hint={hint} />
      <Toggle value={value} onChange={onChange} testID={testID} accessibilityLabel={label} disabled={disabled} />
    </View>
  );
}

/** A label and hint above a full-width control (Segmented, slider, grid). */
export function ControlRow({ label, hint, children }: RowText & { children: ReactNode }) {
  return (
    <View style={styles.block}>
      <RowLabel label={label} hint={hint} />
      {children}
    </View>
  );
}

/** Plain content inside a group (previews, forms). */
export function GroupBody({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View style={styles.block} testID={testID}>
      {children}
    </View>
  );
}

const t200 = transitions.toggle;
const ease = Easing.bezier(...t200.easing);

/**
 * Bottom sheet over everything, native header included (RN Modal; its own
 * gesture root, since a Modal is a separate native root on iOS). Used for
 * destructive confirmations and the variant picker. The backdrop cancels.
 */
export function BottomSheet({
  visible,
  onClose,
  testID,
  closeLabel,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  testID: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.fill}>
        {visible ? (
          <View style={styles.fill} testID={testID}>
            <Animated.View entering={FadeIn.duration(t200.duration).easing(ease)} exiting={FadeOut} style={styles.fill}>
              <Tap
                testID={`${testID}-backdrop`}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                onPress={onClose}
                style={[styles.fill, styles.backdrop]}
              />
            </Animated.View>
            <Animated.View
              entering={SlideInDown.duration(t200.duration).easing(ease)}
              exiting={SlideOutDown.duration(t200.duration)}
              style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}
              accessibilityViewIsModal
            >
              <View style={styles.grabber} />
              {children}
            </Animated.View>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  fill: { ...StyleSheet.absoluteFill },
  scroll: { padding: layout.gutter, gap: space[6] },
  section: { gap: space[2] },
  sectionTitle: { paddingHorizontal: space[1] },
  group: { borderRadius: radii.cardComponent, backgroundColor: eos.slate, overflow: 'hidden', borderWidth: 1, borderColor: surface.cardBorder },
  seam: { height: 1, backgroundColor: eos.ink, marginLeft: space[4] },
  footer: { paddingHorizontal: space[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 52,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  disabled: { opacity: 0.5 },
  rowText: { flex: 1, minWidth: 0, gap: space[0.5] },
  rowLabel: { fontSize: fontSize.base[0], lineHeight: fontSize.base[1] },
  rowHint: { color: eos.ash },
  value: { maxWidth: '45%' },
  block: { paddingHorizontal: space[4], paddingVertical: space[3.5], gap: space[3] },
  backdrop: { backgroundColor: surface.backdrop },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: space[3],
    paddingTop: space[3],
    paddingHorizontal: layout.gutter,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: eos.shade,
    borderTopWidth: 1,
    borderColor: surface.cardBorder,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: radii.full, backgroundColor: eos.seam, marginBottom: space[2] },
});
