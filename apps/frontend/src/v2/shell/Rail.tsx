'use client';

import clsx from 'clsx';
import Link from 'next/link';

import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { AppText, Avatar, CountBadge, Press } from '@/v2/ui';
import { Brand } from './ShellHeader';
import { TabIcon } from './TabIcon';
import { VISIBLE_TABS, type ShellTabId } from './tabs';
import { scrollTopIfActive, useIncomingRequestCount, useReducedMotion } from './useShellData';

/**
 * Desktop navigation from 1024 px (docs/web/PLAN.md §2): the tab bar
 * turned on its side. The brand on top, the same tabs as rows (the app's
 * glyphs and colours, the ember rule as a 2 px bar on the left edge over
 * the middle 44 % of the row), and the player at the bottom, which opens
 * the account menu as a popover beside the rail.
 */
export function Rail({ active, onMenu }: { active: ShellTabId | null; onMenu: () => void }) {
  const t = useT();
  const reduced = useReducedMotion();
  const user = useAppStore((s) => s.user);
  const incoming = useIncomingRequestCount();
  const nickname = user?.nickname ?? '';
  return (
    <aside className="v2-rail" data-testid="shell-rail">
      <Brand className="v2-rail-brand" />
      <nav aria-label={t('shell.tabs')} className="v2-rail-nav">
        {VISIBLE_TABS.map((tab) => {
          const on = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={on ? 'page' : undefined}
              data-testid={`rail-${tab.id}`}
              className={clsx('v2-rail-item v2-reset v2-focus v2-focus-in', on && 'is-active')}
              onClick={scrollTopIfActive(on, reduced)}
            >
              <TabIcon id={tab.id} active={on} />
              <span className="tv-body-strong v2-trunc">{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="v2-rail-foot">
        {user ? (
          <Press
            testID="rail-account"
            onPress={onMenu}
            aria-haspopup="dialog"
            aria-label={incoming ? `${t('shell.menu.open')}, ${incoming}` : t('shell.menu.open')}
            className="v2-rail-me v2-pressable v2-focus-in"
          >
            <span className="v2-press-overlay" />
            <span className="v2-avatar-btn">
              <Avatar nickname={nickname} avatarUrl={user.avatarUrl} size={36} />
              <CountBadge count={incoming} style={{ position: 'absolute', top: -4, right: -6 }} />
            </span>
            <span className="v2-rail-me-text">
              <AppText variant="bodyStrong" numberOfLines={1}>
                {user.displayName || nickname}
              </AppText>
              <AppText variant="caption" numberOfLines={1}>
                {`@${nickname}`}
              </AppText>
            </span>
          </Press>
        ) : (
          <span className="v2-rail-me" aria-hidden>
            <span className="v2-av-ghost" style={{ width: 36, height: 36 }} />
          </span>
        )}
      </div>
    </aside>
  );
}
