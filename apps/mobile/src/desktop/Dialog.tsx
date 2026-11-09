import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';

import { useT } from '@/ui/lang';
import { useHotkeys } from './hotkeys';
import { DText, Hover } from './kit';
import { dx } from './tokens';

const fixed = { position: 'fixed' } as unknown as ViewStyle;

/**
 * A centred desktop dialog over the blurred scrim (DXSessionExit,
 * DXAchievementModal, DXProfileEdit): the whole window, Escape and a click
 * on the scrim close it. `side` docks it to the right edge as a full-height
 * panel instead (DXLevelsInfo).
 */
export function Dialog({
  children,
  onClose,
  width = 420,
  side = false,
  title,
  testID,
  style,
}: {
  children: ReactNode;
  onClose: () => void;
  width?: number;
  side?: boolean;
  /** Optional header row: display-face title + close button. */
  title?: string;
  testID: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  useHotkeys({ Escape: onClose });
  return (
    <View style={styles.root} testID={testID}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('shell.menu.close')} testID={`${testID}-scrim`} />
      <View style={[side ? styles.side : styles.card, { width }, style]} accessibilityViewIsModal>
        {title ? (
          <View style={styles.head}>
            <DText serif weight={700} size={20} style={styles.flex}>
              {title}
            </DText>
            <CloseButton onPress={onClose} testID={`${testID}-close`} />
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** The 32 px square × in a dialog's corner. */
export function CloseButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  const t = useT();
  return (
    <Hover testID={testID} accessibilityLabel={t('shell.menu.close')} onPress={onPress} style={styles.close} hoverStyle={styles.closeHover}>
      <X size={16} color={dx.ash} strokeWidth={2} />
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { ...fixed, top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dx.scrim, backdropFilter: 'blur(3px)' } as ViewStyle,
  card: {
    maxWidth: '92%',
    padding: 22,
    borderRadius: 16,
    backgroundColor: dx.card,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true },
      { offsetX: 0, offsetY: 24, blurRadius: 60, spreadDistance: 0, color: dx.popShadow },
    ],
  },
  side: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    backgroundColor: dx.card,
    borderLeftWidth: 1,
    borderLeftColor: dx.cardEdge,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dx.ghost,
  },
  closeHover: { backgroundColor: dx.ghostHover },
});
