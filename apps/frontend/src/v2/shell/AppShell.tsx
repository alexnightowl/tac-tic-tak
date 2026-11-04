'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { AccountMenu, type AccountMenuMode } from './AccountMenu';
import { OfflineBanner } from './OfflineBanner';
import { Rail } from './Rail';
import { shellFrame } from './routes';
import { ShellHeader } from './ShellHeader';
import { TabBar } from './TabBar';
import { activeTab } from './tabs';
import './shell.css';

/**
 * The signed-in shell (app (tabs)/_layout.tsx + shell/*). Below 1024 px:
 * the app's header and bottom tab bar around the page. From 1024 px: the
 * left rail, and the page in a centred column (560 px for v2 screens; the
 * pre-v2 pages keep their old width, see routes.ts). Board runners get no
 * shell. Both layouts are in the markup and CSS picks one, so the server
 * render already has the right frame.
 *
 * `wrap` lets the layout put the page inside something (pull to refresh)
 * without that wrapper also holding the fixed tab bar: a transformed
 * ancestor would trap a position:fixed child.
 */
export function AppShell({ children, wrap }: { children: ReactNode; wrap?: (page: ReactNode) => ReactNode }) {
  const pathname = usePathname();
  const frame = shellFrame(pathname);
  const [menu, setMenu] = useState<AccountMenuMode | null>(null);

  if (frame === 'none') {
    return (
      <div className="v2-shell-bare">
        <OfflineBanner />
        {children}
      </div>
    );
  }

  const tab = activeTab(pathname);
  const page = (
    <main className="v2-shell-main" data-frame={frame}>
      {children}
    </main>
  );
  return (
    <div className="v2-shell">
      <OfflineBanner />
      <Rail active={tab} onMenu={() => setMenu('popover')} />
      <div className="v2-shell-body">
        <ShellHeader onMenu={() => setMenu('sheet')} />
        {wrap ? wrap(page) : page}
      </div>
      <TabBar active={tab} />
      <AccountMenu mode={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
