// The five tabs of PLAN §2.3 / §8 #3 (PROVISIONAL Q3). `name` is the route
// file in src/app/(app)/(tabs); `labelKey` reuses the web nav keys.
export const SHELL_TABS = [
  { name: 'index', id: 'home', labelKey: 'home' },
  { name: 'play', id: 'play', labelKey: 'play' },
  { name: 'review', id: 'review', labelKey: 'review' },
  { name: 'stats', id: 'stats', labelKey: 'stats' },
  { name: 'social', id: 'social', labelKey: 'nav.social' },
] as const;

export type ShellTabName = (typeof SHELL_TABS)[number]['name'];
export type ShellTabId = (typeof SHELL_TABS)[number]['id'];
