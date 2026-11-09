import type { Language } from '@tac/core/i18n';
import { queryKeys } from '@tac/core/api';
import { streakState } from '@tac/core/format';
import { levelFor } from '@tac/core/runner';
import { alpha, eos } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname, type Href } from 'expo-router';
import { House, Keyboard, LogOut, Settings, User, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { resetAll } from '@/features/auth/session';
import { FlameGlyph } from '@/features/play/ui';
import { readLastStyle } from '@/features/play/setupPrefs';
import { Avatar } from '@/features/profile/Avatar';
import { useIncomingRequestCount } from '@/features/social/badge';
import { feel } from '@/feel';
import { api } from '@/platform/api';
import { patchSettings } from '@/shell/settings';
import { TabGlyph } from '@/shell/TabGlyph';
import { SHELL_TABS, type ShellTabId } from '@/shell/tabs';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { CountBadge } from '@/ui/Buttons';
import { BrandLogo, type LogoGlow } from '@/ui/BrandLogo';
import { useT, useTn } from '@/ui/lang';
import { HotkeysDialog } from './HotkeysDialog';
import { useHotkeys } from './hotkeys';
import { DText, Hover, Kbd, Label, Seg } from './kit';
import { dx, dxSize } from './tokens';

/** A tighter ember halo than the phone header's: the sidebar corner would clip that one. */
const SIDE_LOGO_GLOW: LogoGlow = { box: 64, blur: 4 };

const HREF: Record<ShellTabId, string> = { home: '/', play: '/play', learn: '/learn', rivals: '/rivals', stats: '/stats' };

/**
 * The tab a path belongs to: the tab roots, and the pages the artboards
 * file under a tab (storm, challenge, review → Play; course, library →
 * Learn; achievements → Stats). Profile, friends and settings sit under
 * Home in the artboards.
 */
function activeTab(path: string): ShellTabId {
  if (/^\/(play|storm|challenge|review|sessions|puzzles)(\/|$)/.test(path)) return 'play';
  if (/^\/(learn|course|library|offline)(\/|$)/.test(path)) return 'learn';
  if (/^\/rivals(\/|$)/.test(path)) return 'rivals';
  if (/^\/(stats|achievement)(\/|$)/.test(path)) return 'stats';
  return 'home';
}

const go = (id: ShellTabId, on: boolean) => {
  if (on) return;
  feel.emit('tabChange');
  router.navigate(HREF[id] as Href);
};

/**
 * Desktop sidebar (DX* artboards, 248 px): brand, the five sections as
 * 44 px rows (selected: #2b292f with a 3 px ember edge, rose glyph), the
 * streak card, and the player card at the foot, which opens the account
 * popover (DXAccountMenu). `compact` is the 64 px icon rail of the board
 * screens (DXSession).
 */
export function Sidebar({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const path = usePathname();
  const active = activeTab(path);
  const [menu, setMenu] = useState(false);
  const [keys, setKeys] = useState(false);
  const nickname = useAuthStore((s) => s.user?.nickname ?? '');

  useHotkeys({
    p: () => router.push(`/profile/${encodeURIComponent(nickname)}` as Href),
    ',': () => router.push('/settings' as Href),
    '?': () => setKeys(true),
    'mod+k': () => router.push('/friends/search' as Href),
  });

  return (
    <View style={[styles.side, compact && styles.sideCompact]} testID="dx-sidebar">
      <View style={[styles.brand, compact && styles.brandCompact]} accessible accessibilityRole="header" accessibilityLabel={t('brand.name')}>
        <BrandLogo size={compact ? 26 : 30} glow={SIDE_LOGO_GLOW} />
        {compact ? null : (
          <DText serif weight={700} size={19} ls={0.5} lang="en" numberOfLines={1}>
            {t('brand.name')}
          </DText>
        )}
      </View>

      <View style={styles.nav} accessibilityRole="tablist" accessibilityLabel={t('shell.tabs')}>
        {SHELL_TABS.map((tab) => {
          const on = tab.id === active;
          const label = t(tab.id === 'stats' ? 'stats.title' : tab.labelKey);
          return (
            <Hover
              key={tab.id}
              testID={`dx-nav-${tab.id}`}
              accessibilityRole="tab"
              accessibilityLabel={label}
              selected={on}
              onPress={() => go(tab.id, on)}
              style={[styles.item, compact && styles.itemCompact, on && styles.itemOn]}
              hoverStyle={on ? undefined : styles.itemHover}
            >
              <View style={styles.icon}>
                {tab.id === 'home' ? (
                  // The phone's Home icon is painted art; the sidebar draws every section as a line glyph.
                  <House size={20} color={on ? dx.rose : dx.navIcon} strokeWidth={on ? 2 : 1.8} />
                ) : (
                  <TabGlyph id={tab.id} color={on ? dx.rose : dx.navIcon} strong={on} />
                )}
              </View>
              {compact ? null : (
                <DText size={14.5} weight={700} color={on ? dx.navOnText : dx.ash} numberOfLines={1}>
                  {label}
                </DText>
              )}
            </Hover>
          );
        })}
      </View>

      {compact ? null : <StreakCard />}

      <View style={styles.spacer} />
      <PlayerCard compact={compact} onOpen={() => setMenu(true)} />

      {menu ? <AccountPopover compact={compact} onClose={() => setMenu(false)} onKeys={() => setKeys(true)} /> : null}
      {keys ? <HotkeysDialog onClose={() => setKeys(false)} /> : null}
    </View>
  );
}

/** Mon = 0 … Sun = 6. */
const weekday = (d: Date) => (d.getDay() + 6) % 7;

function StreakCard() {
  const t = useT();
  const tn = useTn();
  const streak = useAppStore((s) => s.streak);
  const show = useAppStore((s) => s.settings.showStreak);
  const st = streakState(streak.days, streak.lastDay);
  const today = weekday(new Date());
  // The week's cells: the streak's days that fall in this week, ending today
  // (secured) or yesterday (at risk).
  const end = st === 'secured' ? today : st === 'at_risk' ? today - 1 : -1;
  const lit = end < 0 ? 0 : Math.min(streak.days, end + 1);
  const live = st === 'secured' || st === 'at_risk';
  const caption = st === 'secured' ? t('dx.shell.streak_done') : t('dx.shell.streak_today');
  const days = live ? streak.days : 0;
  // As the phone's Home streak: hidden when the player turned it off or has none.
  if (!show || days <= 0) return null;
  return (
    <Hover
      testID="dx-streak"
      accessibilityLabel={`${t('dx.shell.streak')}: ${days}`}
      onPress={() => router.push('/streak' as Href)}
      style={styles.streak}
      hoverStyle={styles.cardHover}
    >
      <View style={styles.rowBetween}>
        <Label size={10}>{t('dx.shell.streak')}</Label>
        <View style={styles.row4}>
          <FlameGlyph size={12} color={live ? dx.gold : dx.dust} />
          <DText size={13} weight={800} color={live ? dx.gold : dx.dust}>
            {tn('dx.shell.streak_days', days).replace('{n}', String(days))}
          </DText>
        </View>
      </View>
      <View style={styles.week}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={[styles.cell, i <= end && i > end - lit && styles.cellOn]} />
        ))}
      </View>
      <DText size={11.5} color={dx.dust} style={styles.mt8}>
        {caption}
      </DText>
    </Hover>
  );
}

/** "Бліц 1600 · Пішак 4": the last style's level (D39) and the XP rank. */
function usePlayerLine(): string {
  const t = useT();
  const style = readLastStyle();
  const prog = useAppStore((s) => s.progressions[style]);
  const xp = useQuery({ queryKey: queryKeys.experience(), queryFn: () => api.users.experience(), staleTime: 60_000 });
  const parts = [prog ? `${t(`style.${style}.name`)} ${levelFor(prog)}` : null];
  if (xp.data) parts.push(`${t(`xp.rank.${xp.data.rank}`)} ${xp.data.level}`);
  return parts.filter(Boolean).join(' · ');
}

function PlayerCard({ compact, onOpen }: { compact: boolean; onOpen: () => void }) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const incoming = useIncomingRequestCount();
  const line = usePlayerLine();
  const avatar = (
    <View>
      <Avatar nickname={user?.nickname ?? ''} avatarUrl={user?.avatarUrl} size={compact ? 34 : 38} />
      <CountBadge count={incoming} style={styles.badge} />
    </View>
  );
  const label = incoming ? `${t('shell.menu.open')}, ${incoming}` : t('shell.menu.open');
  if (compact) {
    return (
      <Hover testID="dx-account" accessibilityLabel={label} onPress={onOpen} style={styles.meCompact} hoverStyle={styles.itemHover}>
        {avatar}
      </Hover>
    );
  }
  return (
    <View style={styles.me}>
      <Hover testID="dx-account" accessibilityLabel={label} onPress={onOpen} style={styles.meMain} hoverStyle={styles.none}>
        {avatar}
        <View style={styles.meText}>
          <DText size={14} weight={700} numberOfLines={1}>
            {user?.displayName || user?.nickname || ''}
          </DText>
          <DText size={12} color={dx.dust} numberOfLines={1}>
            {line || (user ? `@${user.nickname}` : '')}
          </DText>
        </View>
      </Hover>
      <Hover
        testID="dx-settings"
        accessibilityLabel={t('dx.shell.open_settings')}
        onPress={() => router.push('/settings' as Href)}
        style={styles.gear}
        hoverStyle={styles.itemHover}
      >
        <Settings size={16} color={dx.dust} strokeWidth={1.8} />
      </Hover>
    </View>
  );
}

/** DXAccountMenu: the popover over the player card. */
function AccountPopover({ compact, onClose, onKeys }: { compact: boolean; onClose: () => void; onKeys: () => void }) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const lang = useAppStore((s) => s.settings.language);
  const incoming = useIncomingRequestCount();
  const nickname = user?.nickname ?? '';
  useHotkeys({ Escape: onClose });
  const open = (href: string) => {
    onClose();
    router.push(href as Href);
  };
  return (
    <>
      <Pressable style={styles.veil} onPress={onClose} accessibilityLabel={t('shell.menu.close')} testID="dx-account-veil" />
      <View style={[styles.pop, compact && styles.popCompact]} testID="dx-account-menu" accessibilityRole="menu">
        <View style={styles.popHead}>
          <Avatar nickname={nickname} avatarUrl={user?.avatarUrl} size={30} />
          <View style={styles.meText}>
            <DText size={14} weight={700} numberOfLines={1}>
              {user?.displayName || nickname}
            </DText>
            <DText size={11.5} color={dx.dust} numberOfLines={1}>{`@${nickname}`}</DText>
          </View>
        </View>
        <MenuRow icon={User} label={t('shell.menu.profile')} kbd="P" testID="dx-menu-profile" onPress={() => open(`/profile/${encodeURIComponent(nickname)}`)} />
        <MenuRow icon={Users} label={t('nav.friends')} count={incoming} testID="dx-menu-friends" onPress={() => open('/friends')} />
        <MenuRow icon={Settings} label={t('settings.title')} kbd="," testID="dx-menu-settings" onPress={() => open('/settings')} />
        <MenuRow
          icon={Keyboard}
          label={t('dx.shell.hotkeys')}
          kbd="?"
          testID="dx-menu-keys"
          onPress={() => {
            onClose();
            onKeys();
          }}
        />
        <View style={styles.popRule} />
        <View style={styles.popLang}>
          <DText size={13} color={dx.ash}>
            {t('dx.shell.language')}
          </DText>
          <Seg<Language>
            small
            options={[
              { value: 'en', label: t('dx.shell.lang_en') },
              { value: 'uk', label: t('dx.shell.lang_uk') },
            ]}
            value={lang}
            onChange={(v) => void patchSettings({ language: v })}
            testID="dx-menu-lang"
            accessibilityLabel={t('dx.shell.language')}
            style={styles.langSeg}
          />
        </View>
        <View style={styles.popRule} />
        <MenuRow icon={LogOut} label={t('logout')} danger testID="dx-menu-logout" onPress={() => void resetAll()} />
      </View>
    </>
  );
}

function MenuRow({
  icon: Icon,
  label,
  kbd,
  count,
  danger,
  testID,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  kbd?: string;
  count?: number;
  danger?: boolean;
  testID: string;
  onPress: () => void;
}) {
  const color = danger ? dx.rose : dx.bone;
  return (
    <Hover testID={testID} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label} onPress={onPress} style={styles.menuRow} hoverStyle={styles.menuHover}>
      <Icon size={15} color={danger ? dx.rose : dx.ash} strokeWidth={1.8} />
      <DText size={13.5} weight={danger ? 700 : 600} color={color} style={styles.flex} numberOfLines={1}>
        {label}
      </DText>
      {count ? <CountBadge count={count} /> : null}
      {kbd ? <Kbd>{kbd}</Kbd> : null}
    </Hover>
  );
}

const fixed = { position: 'fixed' } as unknown as ViewStyle;
const edge = (c: string) => [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: c, inset: true }];

const styles = StyleSheet.create({
  flex: { flex: 1 },
  none: {},
  spacer: { flex: 1 },
  mt8: { marginTop: 8 },
  row4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: {
    width: dxSize.sidebar,
    height: '100%',
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 16,
    backgroundColor: dx.side,
    borderRightWidth: 1,
    borderRightColor: dx.sideBorder,
  },
  sideCompact: { width: dxSize.sidebarCompact, paddingHorizontal: 10, alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingBottom: 26 },
  brandCompact: { paddingHorizontal: 0, paddingBottom: 30 },
  nav: { gap: 4 },
  item: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 11 },
  itemCompact: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  itemOn: {
    backgroundColor: dx.navOn,
    boxShadow: [{ offsetX: 3, offsetY: 0, blurRadius: 0, spreadDistance: 0, color: dx.ember, inset: true }],
  },
  itemHover: { backgroundColor: alpha(eos.bone, 0.035) },
  icon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  streak: {
    marginTop: 22,
    marginHorizontal: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: dx.sideCard,
    boxShadow: edge(dx.sideCardEdge),
  },
  cardHover: { backgroundColor: dx.sideCardHover },
  week: { flexDirection: 'row', gap: 4, marginTop: 10 },
  cell: { flex: 1, height: 6, borderRadius: 3, backgroundColor: dx.barOff },
  cellOn: { backgroundColor: dx.barTo },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: dx.sideCard,
    boxShadow: edge(dx.sideCardEdge),
  },
  meMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  meCompact: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  meText: { flex: 1, minWidth: 0 },
  gear: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -6 },
  veil: { ...fixed, top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 } as ViewStyle,
  pop: {
    ...fixed,
    left: 14,
    bottom: 76,
    width: 214,
    zIndex: 21,
    padding: 6,
    borderRadius: 12,
    backgroundColor: dx.sideCard,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.sideCardEdge, inset: true },
      { offsetX: 0, offsetY: 18, blurRadius: 40, spreadDistance: 0, color: dx.popShadow },
    ],
  } as ViewStyle,
  popCompact: { left: 70, bottom: 16 },
  popHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingBottom: 10 },
  popRule: { height: 1, marginVertical: 4, backgroundColor: dx.rowRule },
  popLang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 },
  langSeg: { width: 104 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 36, paddingHorizontal: 8, borderRadius: 8 },
  menuHover: { backgroundColor: dx.card2 },
});
