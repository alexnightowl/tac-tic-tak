import { eos, layout, space } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Page shell of the settings screens (design v2 MobSettings* artboards:
// `main` padding 16/16/32, sections 24 apart). The rows, groups, toggles,
// blocks and sheets come from @/ui (ListSection, Row, ToggleRow,
// ControlBlock, Sheet, DangerButton): docs/mobile/DESIGN-SYSTEM-V2.md.

/**
 * Scrolling settings body. A push screen passes `title` (the nested
 * `.back` header reads it); the Settings tab passes none (the shell header
 * is already there). Bottom padding is 32 above the home indicator (0 in a
 * tab scene, where the tab bar owns the inset).
 */
export function SettingsPage({
  testID,
  title,
  children,
  keyboard = false,
}: {
  testID: string;
  title?: string;
  children: ReactNode;
  /** Forms: keep the focused field above the keyboard. */
  keyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const content = [styles.scroll, { paddingBottom: insets.bottom + space[8] }];
  return (
    <View style={styles.root} testID={testID}>
      {title ? <Stack.Screen options={{ title }} /> : null}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[4], gap: space[6] },
});
