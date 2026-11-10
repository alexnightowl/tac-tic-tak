'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, LogOut, Settings, Shield, User, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { http, setToken } from '@/lib/api';
import { tFor, useT } from '@/lib/i18n';
import { useAppStore, type Language } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { AppText, Avatar, GroupedList, Press, Row, Segmented, SectionLabel, Sheet } from '@/v2/ui';
import { useIncomingRequestCount } from './useShellData';

/** How the menu opens: a bottom sheet (dialog from 768 px) under the phone header, a popover beside the desktop rail. */
export type AccountMenuMode = 'sheet' | 'popover';

/**
 * The account menu behind the avatar (app shell/AccountMenu.tsx): the
 * player, then profile, friends (with the incoming-request count),
 * review and settings, the language switch, and admin / log out. Rows
 * are links to the existing web pages and close the menu as they go.
 */
export function AccountMenu({ mode, onClose }: { mode: AccountMenuMode | null; onClose: () => void }) {
  const t = useT();
  if (mode === 'popover') {
    return (
      <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="v2-pop-backdrop" />
          <Dialog.Content className="v2-pop" aria-describedby={undefined} data-testid="account-menu">
            <Dialog.Title className="v2-sr">{t('shell.menu.title')}</Dialog.Title>
            <MenuBody onClose={onClose} />
            <Dialog.Close className="v2-sr">{t('shell.menu.close')}</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
  return (
    <Sheet
      visible={mode === 'sheet'}
      onClose={onClose}
      title={t('shell.menu.title')}
      closeLabel={t('shell.menu.close')}
      testID="account-menu"
    >
      <MenuBody onClose={onClose} />
    </Sheet>
  );
}

function MenuBody({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const lang = useAppStore((s) => s.settings.language);
  const setSettings = useAppStore((s) => s.setSettings);
  const pushToast = useToastStore((s) => s.push);
  const incoming = useIncomingRequestCount();
  const nickname = user?.nickname ?? '';
  const name = user?.displayName || nickname;
  const profile = `/profile/${encodeURIComponent(nickname)}`;

  // The settings page's patch(): store first, then the server; the
  // response may unlock an achievement.
  const setLanguage = async (language: Language) => {
    setSettings({ language });
    try {
      const r = await http.patch<{ achievementsUnlocked?: string[] }>('/users/me/settings', { language });
      // In the language just picked, not the one this closure rendered in.
      const tl = tFor(language);
      for (const slug of r.achievementsUnlocked ?? []) {
        pushToast({
          tone: 'achievement',
          title: tl(`achv.${slug}.name`),
          description: tl(`achv.${slug}.desc`),
          achievementSlug: slug,
        });
      }
    } catch {
      // The local choice stands; the next settings save carries it.
    }
  };

  // The old nav's logout, plus dropping the query cache so the next
  // account on this tab never sees this one's data.
  const logout = () => {
    onClose();
    setToken(null);
    setUser(null);
    qc.clear();
    router.replace('/login');
  };

  return (
    <div className="v2-menu">
      <Press href={profile} onPress={onClose} className="v2-menu-me" testID="menu-me" aria-label={t('shell.menu.profile')}>
        <Avatar nickname={nickname} avatarUrl={user?.avatarUrl} size={48} />
        <span className="v2-menu-me-text">
          <AppText variant="title" numberOfLines={1} lang={/[Ѐ-ӿ]/.test(name) ? 'uk' : 'en'} testID="menu-name">
            {name}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {`@${nickname}`}
          </AppText>
        </span>
      </Press>

      <GroupedList>
        <Row icon={User} label={t('shell.menu.profile')} href={profile} onPress={onClose} testID="menu-profile" />
        <Row
          icon={Users}
          label={t('nav.friends')}
          href="/friends"
          onPress={onClose}
          testID="menu-friends"
          accessibilityLabel={incoming ? `${t('nav.friends')}, ${incoming}` : undefined}
          trailing={
            incoming ? (
              <span className="v2-menu-count" data-testid="menu-friends-count">
                <AppText variant="label" color="var(--control-segmented-active-text)">
                  {String(incoming)}
                </AppText>
              </span>
            ) : null
          }
        />
        <Row icon={BookOpen} label={t('review')} href="/review" onPress={onClose} testID="menu-review" />
        <Row icon={Settings} label={t('settings.title')} href="/settings" onPress={onClose} testID="menu-settings" />
      </GroupedList>

      <div className="v2-menu-lang">
        <SectionLabel as="span">{t('settings.language')}</SectionLabel>
        <Segmented
          options={[
            { value: 'en', label: t('shell.lang.en') },
            { value: 'uk', label: t('shell.lang.uk') },
          ]}
          value={lang}
          onChange={(v: Language) => void setLanguage(v)}
          size="sm"
          testID="menu-lang"
          accessibilityLabel={t('settings.language')}
          style={{ width: 152 }}
        />
      </div>

      <GroupedList>
        {user?.isAdmin ? <Row icon={Shield} label={t('shell.menu.admin')} href="/admin" onPress={onClose} testID="menu-admin" /> : null}
        <Row icon={LogOut} label={t('logout')} danger onPress={logout} testID="menu-logout" />
      </GroupedList>
    </div>
  );
}
