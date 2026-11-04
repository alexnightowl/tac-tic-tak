'use client';

import clsx from 'clsx';
import Link from 'next/link';

import { useT } from '@/lib/i18n';
import { TabIcon } from './TabIcon';
import { VISIBLE_TABS, type ShellTabId } from './tabs';
import { scrollTopIfActive, useReducedMotion } from './useShellData';

/**
 * The app's tab bar (shell/TabBar.tsx), below 1024 px: shade ground, 1 px
 * seam top rule, one 64 px tab per section with a 28 × 24 icon and a
 * 10/14 bold label (gap 4), bone active / dust idle, and a 2 px ember rule
 * over the middle 44 % of the active tab that slides between tabs (instant
 * under reduced motion). Links with aria-current, not a tablist: each tab
 * is a page.
 */
export function TabBar({ active }: { active: ShellTabId | null }) {
  const t = useT();
  const reduced = useReducedMotion();
  const index = VISIBLE_TABS.findIndex((x) => x.id === active);
  const n = VISIBLE_TABS.length;
  return (
    <nav className="v2-tabbar" aria-label={t('shell.tabs')} data-testid="tab-bar">
      <span
        className="v2-tabbar-rule"
        aria-hidden
        style={{ width: `${100 / n}%`, transform: `translateX(${Math.max(0, index) * 100}%)`, opacity: index < 0 ? 0 : 1 }}
      >
        <span />
      </span>
      {VISIBLE_TABS.map((tab) => {
        const on = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            data-testid={`tab-${tab.id}`}
            className={clsx('v2-tab v2-reset v2-focus v2-focus-in', on && 'is-active')}
            onClick={scrollTopIfActive(on, reduced)}
          >
            <TabIcon id={tab.id} active={on} />
            <span className="v2-tab-label tv-tab-label v2-trunc">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
