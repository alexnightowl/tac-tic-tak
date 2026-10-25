import { control, eos, layout, radii, space, wordmark } from '@tac/core/tokens';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/features/profile/Avatar';
import { useIncomingRequestCount } from '@/features/social/badge';
import { useAuthStore } from '@/stores/authStore';
import { BrandLogo } from '@/ui/BrandLogo';
import { fontFamily } from '@/ui/fonts';
import { useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';

const BAR_H = 56;
/** Web mobile top bar: Logo 32 + wordmark at 20 px (wordmark(size) = size * 0.6). */
const MARK = wordmark(20 / 0.6);

/**
 * Top bar of every tab (web Nav.tsx mobile header): logo + wordmark left,
 * the avatar right. The avatar opens the account sheet (/menu) instead of
 * linking straight to the profile; it carries the incoming friend-request
 * count, since Friends live behind it (DECISIONS D22).
 */
export function ShellHeader() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const incoming = useIncomingRequestCount();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]} testID="shell-header">
      <View style={styles.row}>
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel={t('brand.name')}>
          <BrandLogo size={32} />
          {/* The wordmark is Latin in every language: always the Latin display face. */}
          <Text
            style={[styles.mark, { fontFamily: fontFamily('en', 'display', 700) }]}
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
          >
            {t('brand.name')}
          </Text>
        </View>
        <Tap
          testID="header-avatar"
          accessibilityRole="button"
          accessibilityLabel={incoming ? `${t('shell.menu.open')}, ${incoming}` : t('shell.menu.open')}
          onPress={() => router.push('/menu')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Avatar nickname={user?.nickname ?? ''} avatarUrl={user?.avatarUrl} size={36} />
          {incoming ? (
            <View style={styles.badge} pointerEvents="none" testID="header-friends-badge">
              <Text style={[styles.badgeText, { fontFamily: fontFamily('en', 'body', 700) }]} maxFontSizeMultiplier={1}>
                {incoming > 9 ? '9+' : String(incoming)}
              </Text>
            </View>
          ) : null}
        </Tap>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: eos.ink },
  row: {
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], flexShrink: 1 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radii.full,
    backgroundColor: eos.ember,
    borderWidth: 2,
    borderColor: eos.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: control.segmentedActiveText, fontSize: 10, lineHeight: 12 },
  mark: { color: eos.bone, fontSize: MARK.fontSize, letterSpacing: MARK.letterSpacing, lineHeight: MARK.fontSize * 1.1 },
});
