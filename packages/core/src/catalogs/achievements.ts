// Client-side achievement metadata. The catalogue itself (and the
// unlock criteria) live in apps/backend/src/achievements/registry.ts;
// this mirrors the fields the app renders before /achievements loads.
// test/catalogs.test.ts fails if the two drift.

export type AchievementCategory = 'customize' | 'play' | 'skill' | 'streak' | 'social';

export type AchievementMeta = {
  slug: string;
  category: AchievementCategory;
  /** lucide icon name, as in the registry and the web's ACHIEVEMENT_ICON_MAP. */
  icon: string;
  /** Position in the registry, which is the order /achievements returns. */
  sort: number;
};

/** Shape of one GET /achievements row. */
export type Achievement = {
  slug: string;
  category: AchievementCategory;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

const DEFS: Array<[slug: string, category: AchievementCategory, icon: string]> = [
  // Customize
  ['set-accent', 'customize', 'Palette'],
  ['set-board', 'customize', 'LayoutGrid'],
  ['set-language', 'customize', 'Languages'],
  ['set-avatar', 'customize', 'Camera'],
  ['set-bio', 'customize', 'FileText'],
  ['set-country', 'customize', 'MapPin'],
  // Play (volume)
  ['first-session', 'play', 'Play'],
  ['ten-sessions', 'play', 'Repeat'],
  ['hundred-sessions', 'play', 'Award'],
  ['solve-100', 'play', 'Target'],
  ['solve-1000', 'play', 'Trophy'],
  // Skill
  ['triple-style', 'skill', 'Layers'],
  ['calibration-done', 'skill', 'Compass'],
  ['peak-1500', 'skill', 'TrendingUp'],
  ['peak-1800', 'skill', 'Star'],
  ['peak-2000', 'skill', 'Medal'],
  // Streak
  ['streak-3', 'streak', 'Flame'],
  ['streak-7', 'streak', 'CalendarHeart'],
  ['streak-30', 'streak', 'CalendarCheck'],
  ['streak-100', 'streak', 'Sparkle'],
  // Social / Meta
  ['first-friend', 'social', 'UserPlus'],
  ['five-friends', 'social', 'Users'],
  ['star-repo', 'social', 'Github'],
];

export const ACHIEVEMENT_CATALOG: AchievementMeta[] = DEFS.map(([slug, category, icon], sort) => ({
  slug, category, icon, sort,
}));

const BY_SLUG = new Map(ACHIEVEMENT_CATALOG.map((a) => [a.slug, a]));

export function achievementMeta(slug: string): AchievementMeta | undefined {
  return BY_SLUG.get(slug);
}

/** Icon for a slug, or null when the client doesn't know it. The web
 *  card then shows its Lock glyph even when unlocked (the icons.tsx
 *  comment promises a Trophy fallback, the card never uses one). */
export function achievementIconKey(slug: string): string | null {
  return BY_SLUG.get(slug)?.icon ?? null;
}

/** Section order on the achievements tab. */
export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = ['play', 'skill', 'streak', 'customize', 'social'];

/** Grid sections in ACHIEVEMENT_CATEGORY_ORDER, rows in server order,
 *  empty categories dropped. */
export function groupAchievements<T extends { category: AchievementCategory }>(
  list: T[],
): Array<{ category: AchievementCategory; items: T[] }> {
  const map = new Map<AchievementCategory, T[]>();
  for (const a of list) {
    if (!map.has(a.category)) map.set(a.category, []);
    map.get(a.category)!.push(a);
  }
  return ACHIEVEMENT_CATEGORY_ORDER
    .map((category) => ({ category, items: map.get(category) ?? [] }))
    .filter((g) => g.items.length > 0);
}

/** i18n keys the web builds inline (`achv.${slug}.name` etc.). */
export const achievementNameKey = (slug: string) => `achv.${slug}.name`;
export const achievementDescKey = (slug: string) => `achv.${slug}.desc`;
export const achievementCategoryKey = (c: AchievementCategory) => `achv.cat.${c}`;

/** Repo the star-repo achievement points at. */
export const REPO_URL = 'https://github.com/alexnightowl/tac-tic-tak';
