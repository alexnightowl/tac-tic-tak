import { alpha, eos, layout, radii, space } from '@tac/core/tokens';
import { router, usePathname, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { feel } from '@/feel';
import { Avatar } from '@/features/profile/Avatar';
import { useIncomingRequestCount } from '@/features/social/badge';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { BrandLogo, HEADER_LOGO_GLOW } from '@/ui/BrandLogo';
import { CountBadge } from '@/ui/Buttons';
import { useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { TabGlyph } from './TabGlyph';
import { SHELL_TABS, type ShellTabId } from './tabs';

export const RAIL_W = 248;

const HREF: Record<ShellTabId, string> = { home: '/', play: '/play', learn: '/learn', rivals: '/rivals', stats: '/stats' };

function activeTab(path: string): ShellTabId | null {
  if (path === '/' || path === '') return 'home';
  const hit = SHELL_TABS.find((tab) => tab.id !== 'home' && path === HREF[tab.id]);
  return hit?.id ?? null;
}

/**
 * Desktop web navigation (D35, ≥ 1024 px): the tab bar turned on its side,
 * as the D31 web shell drew it. Brand on top, the five tabs as 48 pt rows
 * (the tab bar's glyphs and colours, the ember rule as a 2 pt bar on the
 * row's left edge over its middle 44 %), and the player at the bottom,
 * which opens the account menu. Replaces the header and the tab bar.
 */
export function WebRail() {
  const t = useT();
  const path = usePathname();
  const user = useAuthStore((s) => s.user);
  const incoming = useIncomingRequestCount();
  const active = activeTab(path);
  return (
    <View style={styles.rail} testID="web-rail">
      <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel={t('brand.name')}>
        <BrandLogo size={layout.shellLogo} glow={HEADER_LOGO_GLOW} />
        <AppText variant="brand" lang="en" numberOfLines={1}>
          {t('brand.name')}
        </AppText>
      </View>
      <View style={styles.nav} accessibilityRole="tablist" accessibilityLabel={t('shell.tabs')}>
        {SHELL_TABS.map((tab) => {
          const on = tab.id === active;
          const label = t(tab.labelKey);
          return (
            <Tap
              key={tab.id}
              testID={`rail-${tab.id}`}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              style={[styles.item, on && styles.itemOn]}
              onPress={() => {
                if (on) return;
                feel.emit('tabChange');
                router.navigate(HREF[tab.id] as Href);
              }}
            >
              {on && <View style={styles.rule} />}
              <View style={[styles.icon, tab.id === 'home' && !on && styles.dim]}>
                <TabGlyph id={tab.id} color={on ? eos.bone : eos.dust} strong={on} />
              </View>
              <AppText variant="bodyStrong" numberOfLines={1} style={{ color: on ? eos.bone : eos.dust }}>
                {label}
              </AppText>
            </Tap>
          );
        })}
      </View>
      <View style={styles.foot}>
        <Tap
          testID="rail-account"
          accessibilityRole="button"
          accessibilityLabel={incoming ? `${t('shell.menu.open')}, ${incoming}` : t('shell.menu.open')}
          style={styles.me}
          onPress={() => router.push('/menu')}
        >
          <View>
            <Avatar nickname={user?.nickname ?? ''} avatarUrl={user?.avatarUrl} size={layout.shellAvatar} />
            <CountBadge count={incoming} style={styles.badge} />
          </View>
          <View style={styles.meText}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {user?.displayName || user?.nickname || ''}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {user ? `@${user.nickname}` : ''}
            </AppText>
          </View>
        </Tap>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_W,
    height: '100%',
    paddingTop: space[5],
    paddingHorizontal: space[3],
    paddingBottom: space[4],
    backgroundColor: eos.shade,
    boxShadow: [{ offsetX: -1, offsetY: 0, blurRadius: 0, spreadDistance: 0, color: eos.seam, inset: true }],
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], paddingHorizontal: space[3], paddingVertical: space[1], marginBottom: space[6] },
  nav: { gap: 4 },
  item: { height: 48, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[3], borderRadius: radii.control },
  itemOn: { backgroundColor: alpha(eos.bone, 0.04) },
  rule: { position: 'absolute', left: 0, top: '28%', bottom: '28%', width: layout.tabRule.height, borderRadius: 1, backgroundColor: eos.ember },
  icon: { width: 28, height: 24, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
  foot: { marginTop: 'auto', paddingTop: space[4], boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 0, spreadDistance: 0, color: eos.seam, inset: true }] },
  me: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[2], borderRadius: radii.control },
  meText: { flex: 1, minWidth: 0 },
  badge: { position: 'absolute', top: -4, right: -6 },
});
