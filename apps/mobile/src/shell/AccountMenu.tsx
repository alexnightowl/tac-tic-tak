import type { Language } from '@tac/core/i18n';
import { control, eos, fontSize, layout, radii, space } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { ChevronRight, LogOut, Terminal, User, Users, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEV_MENU } from '@/dev/flags';
import { Avatar } from '@/features/profile/Avatar';
import { resetAll } from '@/features/auth/session';
import { useIncomingRequestCount } from '@/features/social/badge';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { scriptLang } from '@/ui/fonts';
import { useT } from '@/ui/lang';
import { Segmented } from '@/ui/Segmented';
import { Tap } from '@/ui/Tap';
import { patchSettings } from './settings';

/**
 * The account sheet behind the header avatar: profile, friends (with the
 * incoming-request count), language, log out. Settings is a tab (D22). A
 * native formSheet sized to its content; rows dismiss it and push their route.
 */
export function AccountMenu() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const lang = useAppStore((s) => s.settings.language);
  const nickname = user?.nickname ?? '';
  const incoming = useIncomingRequestCount();

  const go = (href: Href) => {
    // Close the sheet, then push onto the (app) stack beneath it.
    router.back();
    router.push(href);
  };

  const langOptions = [
    { value: 'en', label: t('shell.lang.en') },
    { value: 'uk', label: t('shell.lang.uk') },
  ] as const;

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="account-menu">
      <Tap
        testID="menu-me"
        accessibilityRole="button"
        accessibilityLabel={t('shell.menu.profile')}
        onPress={() => go(`/profile/${encodeURIComponent(nickname)}`)}
        style={styles.me}
      >
        <Avatar nickname={nickname} avatarUrl={user?.avatarUrl} size={48} />
        <View style={styles.meText}>
          <AppText variant="title" lang={scriptLang(user?.displayName || nickname)} numberOfLines={1} testID="menu-name">
            {user?.displayName || nickname}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {`@${nickname}`}
          </AppText>
        </View>
      </Tap>

      <View style={styles.group}>
        <Row icon={User} label={t('shell.menu.profile')} testID="menu-profile" onPress={() => go(`/profile/${encodeURIComponent(nickname)}`)} />
        <Row icon={Users} label={t('nav.friends')} testID="menu-friends" count={incoming} onPress={() => go('/friends')} />
      </View>

      <View style={styles.langRow}>
        <AppText variant="label">{t('settings.language')}</AppText>
        <View style={styles.langSeg}>
          <Segmented
            options={langOptions}
            value={lang}
            onChange={(v: Language) => void patchSettings({ language: v })}
            size="sm"
            testID="menu-lang"
            accessibilityLabel={t('settings.language')}
          />
        </View>
      </View>

      <View style={styles.group}>
        {DEV_MENU ? <Row icon={Terminal} label={t('dev.open')} testID="menu-dev" onPress={() => go('/dev')} /> : null}
        <Row
          icon={LogOut}
          label={t('logout')}
          testID="menu-logout"
          danger
          // No router.back() first: the guard drops the whole (app) stack,
          // sheet included, and a GO_BACK racing it throws in dev.
          onPress={() => void resetAll()}
        />
      </View>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  testID,
  onPress,
  count = 0,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  testID: string;
  onPress: () => void;
  /** Pending items, shown as an ember pill before the chevron. */
  count?: number;
  danger?: boolean;
}) {
  const color = danger ? eos.rose : eos.bone;
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label} onPress={onPress} style={styles.row}>
      <Icon size={20} color={danger ? eos.rose : eos.ash} strokeWidth={1.8} />
      <AppText variant="body" style={[styles.rowLabel, { color }]} numberOfLines={1}>
        {label}
      </AppText>
      {count ? (
        <View style={styles.count} testID={`${testID}-count`}>
          <AppText variant="label" color={control.segmentedActiveText} style={styles.countText}>
            {String(count)}
          </AppText>
        </View>
      ) : null}
      {danger ? null : <ChevronRight size={18} color={eos.dust} />}
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: layout.gutter, paddingTop: space[6], gap: space[4], backgroundColor: eos.shade },
  me: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56 },
  meText: { flex: 1, minWidth: 0, gap: space[0.5] },
  group: { borderRadius: radii.cardComponent, backgroundColor: eos.slate, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 52,
    paddingHorizontal: space[4],
    boxShadow: [{ offsetX: 0, offsetY: -1, blurRadius: 0, spreadDistance: 0, color: eos.ink, inset: true }],
  },
  rowLabel: { flex: 1, fontSize: fontSize.base[0], lineHeight: fontSize.base[1] },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radii.full,
    backgroundColor: eos.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, letterSpacing: 0 },
  langSeg: { width: 152 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingHorizontal: space[1] },
});
