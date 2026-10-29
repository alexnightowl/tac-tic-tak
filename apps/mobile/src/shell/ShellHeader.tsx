import { eos, layout, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/features/profile/Avatar';
import { useIncomingRequestCount } from '@/features/social/badge';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { BrandLogo, HEADER_LOGO_GLOW } from '@/ui/BrandLogo';
import { CountBadge } from '@/ui/Buttons';
import { useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';

/**
 * Top bar of every tab (design v2 MobRivals / MobStats header): a 56 pt
 * row under the status bar on the ink ground — the 32 pt knight with its
 * 120 pt ember glow, the Cinzel 20/22 wordmark (gap 10), and the 36 pt
 * avatar on the right. The avatar opens the account sheet (/menu) and
 * carries the incoming friend-request count (DECISIONS D22).
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
          <BrandLogo size={layout.shellLogo} glow={HEADER_LOGO_GLOW} />
          {/* The wordmark is Latin in every language: always the Latin display face. */}
          <AppText variant="brand" lang="en" numberOfLines={1}>
            {t('brand.name')}
          </AppText>
        </View>
        <Tap
          testID="header-avatar"
          accessibilityRole="button"
          accessibilityLabel={incoming ? `${t('shell.menu.open')}, ${incoming}` : t('shell.menu.open')}
          onPress={() => router.push('/menu')}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Avatar nickname={user?.nickname ?? ''} avatarUrl={user?.avatarUrl} size={layout.shellAvatar} />
          <CountBadge count={incoming} style={styles.badge} testID="header-friends-badge" />
        </Tap>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: eos.ink, zIndex: 1 },
  row: {
    height: layout.shellHeaderHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], flexShrink: 1 },
  badge: { position: 'absolute', top: -4, right: -6 },
});
