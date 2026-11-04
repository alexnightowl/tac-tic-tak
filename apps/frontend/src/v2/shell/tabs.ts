// The five tabs of the app (apps/mobile/src/shell/tabs.ts; DECISIONS D22):
// Home, Play, Learn, Rivals, Stats. Review moved to the account menu on
// the web until W4 puts it on Play; Settings lives in the account menu.
//
// `href` is where the tab points today. The v2 screens arrive in later
// phases (docs/web/PLAN.md §3); until then the tabs open the existing web
// pages, and `match` lists the URL prefixes that light the tab up.

export type ShellTabId = 'home' | 'play' | 'learn' | 'rivals' | 'stats';

export type ShellTab = {
  id: ShellTabId;
  labelKey: string;
  href: string;
  /** Path prefixes (segment-aligned) that make this tab the active one. */
  match: readonly string[];
  /** Kept in the config but not rendered (Learn has no web page until W7). */
  hidden?: boolean;
};

export const SHELL_TABS: readonly ShellTab[] = [
  { id: 'home', labelKey: 'home', href: '/dashboard', match: ['/dashboard'] },
  { id: 'play', labelKey: 'play', href: '/play', match: ['/play', '/review'] },
  { id: 'learn', labelKey: 'learn.tab', href: '/learn', match: ['/learn'], hidden: true },
  { id: 'rivals', labelKey: 'nav.rivals', href: '/leaderboard', match: ['/leaderboard', '/friends', '/profile'] },
  { id: 'stats', labelKey: 'stats', href: '/analytics', match: ['/analytics', '/sessions'] },
];

/** The tabs the shell renders. */
export const VISIBLE_TABS = SHELL_TABS.filter((t) => !t.hidden);

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** The tab a path belongs to, or null (settings, admin). */
export function activeTab(pathname: string | null): ShellTabId | null {
  if (!pathname) return null;
  return VISIBLE_TABS.find((t) => t.match.some((p) => under(pathname, p)))?.id ?? null;
}
