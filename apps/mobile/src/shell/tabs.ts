// The six tabs of the design canvas and the web nav (DECISIONS D22). `name`
// is the route file in src/app/(app)/(tabs); `labelKey` reuses the web nav keys.
export const SHELL_TABS = [
  { name: 'index', id: 'home', labelKey: 'home' },
  { name: 'play', id: 'play', labelKey: 'play' },
  { name: 'review', id: 'review', labelKey: 'review' },
  { name: 'rivals', id: 'rivals', labelKey: 'nav.rivals' },
  { name: 'stats', id: 'stats', labelKey: 'stats' },
  { name: 'settings', id: 'settings', labelKey: 'settings' },
] as const;

export type ShellTabName = (typeof SHELL_TABS)[number]['name'];
export type ShellTabId = (typeof SHELL_TABS)[number]['id'];
