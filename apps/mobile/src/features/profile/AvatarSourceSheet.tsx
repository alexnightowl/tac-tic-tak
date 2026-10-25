import { eos, layout, radii, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import { Camera, ImageIcon, X, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { pickAndUpload } from './avatarUpload';

/**
 * The /avatar-source formSheet (deep links). Same two sources as the native
 * action sheet behind chooseAvatar(); the sheet closes first so the system
 * picker presents over the screen underneath, not over a dismissing sheet.
 */
export function AvatarSourceSheet() {
  const t = useT();
  const pick = (source: 'camera' | 'library') => {
    router.back();
    void pickAndUpload(source);
  };
  return (
    <View style={styles.sheet} testID="screen-avatar-source">
      <View style={styles.close}>
        <Tap
          testID="screen-avatar-source-close"
          accessibilityRole="button"
          accessibilityLabel={t('shell.menu.close')}
          onPress={() => router.back()}
          style={styles.closeHit}
        >
          <X size={22} color={eos.bone} />
        </Tap>
      </View>
      <AppText variant="title" accessibilityRole="header">
        {t('profile.change_avatar')}
      </AppText>
      <View style={styles.group}>
        <Row icon={Camera} label={t('profile.avatar_camera')} testID="avatar-source-camera" onPress={() => pick('camera')} />
        <Row
          icon={ImageIcon}
          label={t('profile.avatar_library')}
          testID="avatar-source-library"
          onPress={() => pick('library')}
        />
      </View>
    </View>
  );
}

function Row({ icon: Icon, label, testID, onPress }: { icon: LucideIcon; label: string; testID: string; onPress: () => void }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
      <Icon size={20} color={eos.ash} strokeWidth={1.8} />
      <AppText variant="body" style={styles.rowLabel} numberOfLines={1}>
        {label}
      </AppText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  // No flex: the fitToContents sheet measures this view.
  sheet: { padding: layout.gutter, paddingTop: space[8], paddingBottom: space[10], gap: space[4], backgroundColor: eos.shade },
  close: { position: 'absolute', top: space[2], right: space[2], zIndex: 1 },
  closeHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: radii.cardComponent, backgroundColor: eos.slate, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 52,
    paddingHorizontal: space[4],
    boxShadow: [{ offsetX: 0, offsetY: -1, blurRadius: 0, spreadDistance: 0, color: eos.ink, inset: true }],
  },
  rowLabel: { flex: 1 },
});
