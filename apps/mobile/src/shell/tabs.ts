// The five tabs (canvas Learn page, LearnStates "Tab bar"; was six, DECISIONS
// D22): Review moved to a button on Play and Settings into the avatar menu.
// `name` is the route file in src/app/(app)/(tabs); `labelKey` reuses the web
// nav keys where they exist.
export const SHELL_TABS = [
  { name: 'index', id: 'home', labelKey: 'home' },
  { name: 'play', id: 'play', labelKey: 'play' },
  { name: 'learn', id: 'learn', labelKey: 'learn.tab' },
  { name: 'rivals', id: 'rivals', labelKey: 'nav.league' },
  { name: 'stats', id: 'stats', labelKey: 'stats' },
] as const;

export type ShellTabName = (typeof SHELL_TABS)[number]['name'];
export type ShellTabId = (typeof SHELL_TABS)[number]['id'];
