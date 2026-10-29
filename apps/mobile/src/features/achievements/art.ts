import type { AchievementCategory } from '@tac/core/catalogs';
import { alpha, tone } from '@tac/core/tokens';

// Medal art of the design v2 MobAchievements board: one glyph per
// achievement (24-unit line glyph, the filled streak flame with its day
// count, or a rank eye image), the rarity tier that colours the unlocked
// ring and the sheet's tier chip, and the canvas order of sections and
// medals. Unknown slugs (a new server achievement) fall back to a plain
// medal glyph, common tier, at the end of their section.

export type Tier = 'common' | 'rare' | 'epic';

export type MedalArt =
  | { kind: 'line'; d: string }
  | { kind: 'flame'; count: number }
  | { kind: 'eye'; eye: 1 | 3 | 4 | 5 };

type Entry = { art: MedalArt; tier: Tier };

const line = (d: string, tier: Tier): Entry => ({ art: { kind: 'line', d }, tier });
const flame = (count: number, tier: Tier): Entry => ({ art: { kind: 'flame', count }, tier });
const eye = (n: 1 | 3 | 4 | 5, tier: Tier): Entry => ({ art: { kind: 'eye', eye: n }, tier });

/** Glyphs straight from the canvas (viewBox 0 0 24 24, stroke 1.7). Tiers
 *  the canvas shows unlocked are taken from it; the rest (locked there)
 *  follow the same ladder: first steps common, mid rungs rare, top epic. */
const ART: Record<string, Entry> = {
  // Training
  'first-session': line('M9.4 6.5a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0M9.6 9.6h4.8l-.9 5h-3zM8 18.5c0-2.2 1.7-3.8 4-3.8s4 1.6 4 3.8zM6.5 20.5h11', 'common'),
  'ten-sessions': line('M4.3 9a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0M10.1 7a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0M16.3 9a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0M4.3 15c0-1.8.8-3.6 1.7-3.6s1.7 1.8 1.7 3.6zM10.1 13.6c0-2 .9-4 1.9-4s1.9 2 1.9 4zM16.3 15c0-1.8.8-3.6 1.7-3.6s1.7 1.8 1.7 3.6zM3 18h18', 'common'),
  'hundred-sessions': line('M6.5 20.5h11M7.5 20.5l1-8.5h7l1 8.5M6.5 4v4.5h11V4h-2.4v2h-2V4h-2.2v2h-2V4zM8.5 12h7', 'rare'),
  'solve-100': line('M4 4h16v16H4zM12 7v3.5M12 13.5V17M7 12h3.5M13.5 12H17', 'common'),
  'solve-1000': line('M4.5 18.5h15M5.2 18.5L4 8l4.8 4L12 5.5 15.2 12 20 8l-1.2 10.5', 'epic'),
  // Rank
  'calibration-done': eye(1, 'common'),
  'triple-style': line('M13 2.5L6.5 13h4.5l-1 8.5 7.5-11H13z', 'common'),
  'peak-1500': eye(3, 'rare'),
  'peak-1800': eye(4, 'epic'),
  'peak-2000': eye(5, 'epic'),
  // Streak
  'streak-3': flame(3, 'common'),
  'streak-7': flame(7, 'common'),
  'streak-30': flame(30, 'rare'),
  'streak-100': flame(100, 'epic'),
  // Community
  'first-friend': line('M5 8a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M13 8a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M2.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13.5 15.6c.8-.4 1.6-.6 2.5-.6 3 0 5.5 2 5.5 5', 'common'),
  'five-friends': line('M9.4 6.5a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0M3.5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M16.5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M7 20c0-3 2.3-5.2 5-5.2s5 2.2 5 5.2M2 19c0-2.4 1.5-4 3.5-4M22 19c0-2.4-1.5-4-3.5-4', 'rare'),
  // Style
  'set-bio': line('M20 4c-7 0-12.5 5-13 12.5L5 20.5l4-2C16 18 20 11 20 4zM7.5 16.5L14 10', 'common'),
  'set-country': line('M5.5 21V3.5M5.5 4h12l-2.5 4 2.5 4h-12', 'common'),
  'set-avatar': line('M14.5 4.5h-5L7.5 7H4.5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 19.5 7h-3zM8.8 12.8a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0', 'common'),
  'set-language': line('M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M3 12h18M12 3c2.5 2.7 3.6 5.7 3.6 9S14.5 18.3 12 21M12 3C9.5 5.7 8.4 8.7 8.4 12s1.1 6.3 3.6 9', 'common'),
};

/** Lucide `medal` outline: the glyph of a slug the canvas doesn't know. */
const FALLBACK: Entry = line(
  'M7.21 15L2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15M11 12L5.12 2.2M13 12l5.88-9.8M8 7h8M7 17a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',
  'common',
);

export const medalArt = (slug: string): Entry => ART[slug] ?? FALLBACK;

/** Canvas section order: Training, Rank, Streak, Community, Style. */
export const SECTION_ORDER: AchievementCategory[] = ['play', 'skill', 'streak', 'social', 'customize'];

/** Canvas medal order inside each section (unknown slugs go last). */
const ORDER = Object.keys(ART);
export const medalRank = (slug: string): number => {
  const i = ORDER.indexOf(slug);
  return i < 0 ? ORDER.length : i;
};

/** Unlocked ring (2 pt) per tier: rose .55, sand, gold. */
export const TIER_RING: Record<Tier, string> = {
  common: alpha(tone.rose, 0.55),
  rare: tone.sand,
  epic: tone.gold,
};

/** Sheet tier chip: tinted fill + ink (epic gold .16, rare sand .12). */
export const TIER_CHIP: Record<Tier, { bg: string; fg: string }> = {
  common: { bg: alpha(tone.rose, 0.12), fg: tone.rose },
  rare: { bg: alpha(tone.sand, 0.12), fg: tone.sand },
  epic: { bg: alpha(tone.gold, 0.16), fg: tone.gold },
};
