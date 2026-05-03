/**
 * Single source of truth for the achievement catalogue. Adding a
 * new achievement is one entry here plus two i18n strings on the
 * frontend (the slug-keyed name + description). Slugs are stable
 * forever — never reuse one for a different criterion.
 *
 * Each evaluator runs against an in-memory snapshot of the user's
 * state assembled by AchievementsService; criteria are pure
 * functions, easy to test, and never hit the DB themselves.
 */

export type AchievementCategory = 'customize' | 'play' | 'skill' | 'streak' | 'social';

export type AchievementState = {
  /** Customizable settings the user has touched. */
  settings: {
    accentColor: string;
    boardTheme: string;
    pieceSet: string;
    language: string;
  } | null;
  /** Profile fields. */
  profile: {
    avatarUrl: string | null;
    bio: string | null;
    country: string | null;
    starredRepo: boolean;
  };
  /** Lifetime aggregates. */
  totalSessions: number;
  totalSolved: number;
  /** Distinct training styles the user has finished a session in. */
  styleSet: Set<string>;
  /** Best peak rating across all styles' finished sessions. */
  bestPeakRating: number;
  /** Per-style progressions — used to detect "calibration finished". */
  progressions: Array<{
    style: string;
    calibrationSessionsLeft: number;
    unlockedStartRating: number;
    startPuzzleRating: number;
  }>;
  /** Current daily-streak length. */
  streakDays: number;
  /** Accepted friendship count. */
  friendsCount: number;
};

export type AchievementDef = {
  slug: string;
  category: AchievementCategory;
  /** lucide-react icon name; the frontend has the literal mapping. */
  icon: string;
  evaluator: (s: AchievementState) => boolean;
};

// Schema defaults — used to detect "user changed this from the
// brand-new-account default". Mirror of UserSetting defaults in
// schema.prisma; if you change a default there, change here too.
const DEFAULT_ACCENT = '#22c55e';
const DEFAULT_BOARD_THEME = 'green';
const DEFAULT_LANGUAGE = 'en';

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ───── Customize ─────────────────────────────────────────────
  {
    slug: 'set-accent',
    category: 'customize',
    icon: 'Palette',
    evaluator: (s) => !!s.settings && s.settings.accentColor !== DEFAULT_ACCENT,
  },
  {
    slug: 'set-board',
    category: 'customize',
    icon: 'LayoutGrid',
    evaluator: (s) => !!s.settings && s.settings.boardTheme !== DEFAULT_BOARD_THEME,
  },
  {
    slug: 'set-language',
    category: 'customize',
    icon: 'Languages',
    evaluator: (s) => !!s.settings && s.settings.language !== DEFAULT_LANGUAGE,
  },
  {
    slug: 'set-avatar',
    category: 'customize',
    icon: 'Camera',
    evaluator: (s) => !!s.profile.avatarUrl,
  },
  {
    slug: 'set-bio',
    category: 'customize',
    icon: 'FileText',
    evaluator: (s) => !!s.profile.bio && s.profile.bio.trim().length > 0,
  },
  {
    slug: 'set-country',
    category: 'customize',
    icon: 'MapPin',
    evaluator: (s) => !!s.profile.country,
  },

  // ───── Play (volume) ─────────────────────────────────────────
  {
    slug: 'first-session',
    category: 'play',
    icon: 'Play',
    evaluator: (s) => s.totalSessions >= 1,
  },
  {
    slug: 'ten-sessions',
    category: 'play',
    icon: 'Repeat',
    evaluator: (s) => s.totalSessions >= 10,
  },
  {
    slug: 'hundred-sessions',
    category: 'play',
    icon: 'Award',
    evaluator: (s) => s.totalSessions >= 100,
  },
  {
    slug: 'solve-100',
    category: 'play',
    icon: 'Target',
    evaluator: (s) => s.totalSolved >= 100,
  },
  {
    slug: 'solve-1000',
    category: 'play',
    icon: 'Trophy',
    evaluator: (s) => s.totalSolved >= 1000,
  },

  // ───── Skill ─────────────────────────────────────────────────
  {
    slug: 'triple-style',
    category: 'skill',
    icon: 'Layers',
    // All three training styles played at least once.
    evaluator: (s) => ['bullet', 'blitz', 'rapid'].every((st) => s.styleSet.has(st)),
  },
  {
    slug: 'calibration-done',
    category: 'skill',
    icon: 'Compass',
    // At least one style has finished its calibration window.
    evaluator: (s) =>
      s.progressions.some((p) => p.calibrationSessionsLeft === 0 && p.unlockedStartRating > 0),
  },
  {
    slug: 'peak-1500',
    category: 'skill',
    icon: 'TrendingUp',
    evaluator: (s) => s.bestPeakRating >= 1500,
  },
  {
    slug: 'peak-1800',
    category: 'skill',
    icon: 'Star',
    evaluator: (s) => s.bestPeakRating >= 1800,
  },
  {
    slug: 'peak-2000',
    category: 'skill',
    icon: 'Medal',
    evaluator: (s) => s.bestPeakRating >= 2000,
  },

  // ───── Streak ────────────────────────────────────────────────
  {
    slug: 'streak-3',
    category: 'streak',
    icon: 'Flame',
    evaluator: (s) => s.streakDays >= 3,
  },
  {
    slug: 'streak-7',
    category: 'streak',
    icon: 'CalendarHeart',
    evaluator: (s) => s.streakDays >= 7,
  },
  {
    slug: 'streak-30',
    category: 'streak',
    icon: 'CalendarCheck',
    evaluator: (s) => s.streakDays >= 30,
  },
  {
    slug: 'streak-100',
    category: 'streak',
    icon: 'Sparkle',
    evaluator: (s) => s.streakDays >= 100,
  },

  // ───── Social / Meta ─────────────────────────────────────────
  {
    slug: 'first-friend',
    category: 'social',
    icon: 'UserPlus',
    evaluator: (s) => s.friendsCount >= 1,
  },
  {
    slug: 'five-friends',
    category: 'social',
    icon: 'Users',
    evaluator: (s) => s.friendsCount >= 5,
  },
  {
    slug: 'star-repo',
    category: 'social',
    icon: 'Github',
    evaluator: (s) => s.profile.starredRepo,
  },
];

export const ACHIEVEMENT_SLUGS = new Set(ACHIEVEMENT_DEFS.map((a) => a.slug));
