import { radii, surface } from '@tac/core/tokens';
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useT } from '@/ui/lang';

export type WebSheetSize = 'fit' | 'tall';

/** A phone-width window keeps the bottom sheet; wider ones get a centred dialog. */
const DIALOG_MIN = 600;

/**
 * The web has no native formSheet: a sheet route renders over a backdrop as
 * a centred dialog (or a bottom sheet on a phone-width window). The
 * backdrop and Escape close it, like a swipe down in the app.
 */
export function WebSheet({ size, children }: { size: WebSheetSize; children: ReactNode }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const dialog = width >= DIALOG_MIN;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && router.canGoBack()) router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <View style={[styles.fill, dialog ? styles.center : styles.bottom]}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        accessibilityRole="button"
        accessibilityLabel={t('shell.menu.close')}
        onPress={() => router.canGoBack() && router.back()}
      />
      <View style={[styles.card, dialog ? styles.cardDialog : styles.cardSheet, size === 'tall' && styles.tall]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  bottom: { justifyContent: 'flex-end' },
  backdrop: { backgroundColor: surface.backdrop },
  card: { backgroundColor: surface.sheet, overflow: 'hidden', maxHeight: '88%' },
  cardDialog: { width: '100%', maxWidth: 480, borderRadius: radii.sheet },
  cardSheet: { width: '100%', borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet },
  tall: { height: '88%' },
});
