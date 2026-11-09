// Hand-written response shapes for the routes the Phase 2 slice calls
// (today's /api/*; docs/mobile/inventory/backend.md, sessions.service.ts,
// users.service.ts). Dates arrive as ISO strings over JSON.
import type { Language } from '../i18n';
import type { ServerPuzzle } from '../puzzle';
import type { LevelCheck, TrainingStyle, UnlockCheck, XpStanding } from '../rules';

export type ColorMode = 'auto' | 'white' | 'black';
export type AnimationSpeedSetting = 'instant' | 'fast' | 'normal' | 'slow';
export type KnightArrowSetting = 'bent' | 'straight';
export type SessionMode = 'mixed' | 'theme' | 'casual';

// ---- auth ----

export type AuthUser = { id: string; nickname: string };

/** POST /auth/login and /auth/register (legacy 7-day token, no refresh). */
export type AuthResponse = { token: string; user: AuthUser };

export type LoginBody = { nickname: string; password: string };
export type RegisterBody = {
  nickname: string;
  password: string;
  repeatPassword: string;
  language?: Language;
};

// ---- users ----

/** The UserSetting row as GET /users/me returns it. */
export type UserSettings = {
  userId?: string;
  focusMode: boolean;
  accentColor: string;
  boardTheme: string;
  pieceSet: string;
  soundEnabled: boolean;
  soundPack: string;
  language: Language;
  fixedColor: ColorMode;
  animationSpeed: AnimationSpeedSetting;
  knightArrow: KnightArrowSetting;
  showStreak: boolean;
  reviewAutoAdvance: boolean;
  mirrorView: boolean;
  onboardingCompleted: boolean;
};

export type Progression = {
  startPuzzleRating: number;
  currentPuzzleRating: number;
  unlockedStartRating: number;
  /** Rated sessions left in the provisional period. */
  calibrationSessionsLeft: number;
  /** Weak at-peak sessions in a row; the next one drops the norm. */
  weakSessionStreak: number;
  /** Play v2 level (rules/progress.ts). Absent before the server shipped it. */
  level?: number;
  /** v2 rated sessions in a row under level - 50; two drop the level. */
  levelGuard?: number;
};
export type Progressions = Record<TrainingStyle, Progression>;

export type Streak = {
  days: number;
  freezes: number;
  /** Last counted play day, local 'YYYY-MM-DD'. */
  lastDay: string | null;
  freezeRegenAt: string | null;
};

/** GET /users/me. `settings` is null for a user without a UserSetting row. */
export type MeResponse = {
  id: string;
  nickname: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  createdAt: string;
  verified: boolean;
  isAdmin: boolean;
  settings: UserSettings | null;
  /** Legacy single-style row; unused by the app. */
  progression: unknown;
  progressions: Progressions;
  streak: Streak;
};

// ---- sessions ----

export type CreateSessionBody = {
  startRating: number;
  durationSec: number;
  mode: SessionMode;
  style: TrainingStyle;
  theme?: string;
  /** Play v2: rated sessions start at the server's rating, levels instead of the norm. */
  ruleset?: 'v2';
  /** D40 trainers: 'blind' (casual / theme only) or 'plan' (the daily plan). */
  variant?: 'blind' | 'plan';
  /** D40: 1–3 theme slugs (mode 'theme'); puzzles come from any of them. */
  themes?: string[];
};

/** POST /sessions/:id/next, and `firstPuzzle` of POST /sessions. */
export type NextResponse = {
  puzzle: ServerPuzzle;
  currentRating: number;
  session: {
    id: string;
    startedAt: string;
    durationSec: number;
    style: TrainingStyle;
    mode: SessionMode;
  };
};

export type CreateSessionResponse = {
  sessionId: string;
  startedAt: string;
  durationSec: number;
  style: TrainingStyle;
  /** Null when the preload failed: fall back to /next. */
  firstPuzzle: NextResponse | null;
};

export type AttemptBody = {
  puzzleId: string;
  correct: boolean;
  responseMs: number;
  /** Haste (D40): on a wrong attempt, the thinking time on the move that went wrong. */
  mistakeMs?: number;
};
export type AttemptResponse = { newRating: number; step: number; streak: number };

export type FinishQuery = {
  /** false = discard (web sends save=false only then). */
  save?: boolean;
  /** Player's local 'YYYY-MM-DD' (formatLocalDate) for the streak tick. */
  localDate: string;
};

export type SessionSummary = {
  sessionId: string;
  solved: number;
  failed: number;
  accuracy: number;
  avgResponseMs: number;
  peakRating: number;
  durationSec: number;
  style: string;
};

export type StreakOutcome = Streak & {
  outcome: 'same-day' | 'continued' | 'frozen' | 'reset' | 'started' | 'skipped';
};

/** The server's demote payload (not the rules' DemoteCheck: adds threshold/ceiling). */
export type DemoteResponse = {
  atPeak: boolean;
  weak: boolean;
  criteriaMet: number;
  streakAfter: number;
  threshold: number;
  penalty: number;
  unlockedStartRating: number;
};

export type CalibrationResponse = {
  active: boolean;
  sessionsLeftBefore: number;
  sessionsLeftAfter: number;
  ceilingBefore: number;
  ceilingAfter: number;
  delta: number;
};

/**
 * POST /sessions/:id/finish with save. Theme and early-exit sessions carry
 * only `unlocked: false` (+ `early`); an already-ended session returns the
 * bare summary, so every extra is optional.
 */
export type FinishSaved = SessionSummary & {
  unlocked?: boolean;
  early?: boolean;
  unlockCheck?: UnlockCheck;
  demoted?: boolean;
  demoteCheck?: DemoteResponse | null;
  calibration?: CalibrationResponse | null;
  streak?: StreakOutcome | null;
  achievementsUnlocked?: string[];
  /** Experience earned by this session (every saved session). */
  xp?: XpAward;
  /** Play v2 rated sessions. */
  rating?: { before: number; after: number };
  level?: LevelCheck;
  settling?: { sessionsLeft: number };
};

export type XpAward = { gained: number; before: XpStanding; after: XpStanding };

/** GET /users/me/experience */
export type ExperienceResponse = XpStanding & {
  trainingSec: number;
  reviewsResolved: number;
  weekXp: number;
  weekReviews: number;
};
export type FinishDiscarded = { discarded: true };
export type FinishResponse = FinishSaved | FinishDiscarded;

export function isDiscarded(r: FinishResponse): r is FinishDiscarded {
  return (r as FinishDiscarded).discarded === true;
}

/** GET /sessions/:id */
export type SessionDetail = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  mode: SessionMode;
  theme: string | null;
  /** 'blind' | 'plan' (D40); null for a plain session. */
  variant?: string | null;
  durationSec: number;
  startRating: number;
  endRating: number;
  peakRating: number;
  solved: number;
  failed: number;
  accuracy: number;
  avgResponseMs: number;
  attempts: Array<{
    id: string;
    puzzleId: string;
    puzzleRating: number;
    correct: boolean;
    responseMs: number;
    createdAt: string;
  }>;
};

// ---- woodpecker (D40, mobile): personal puzzle sets solved in cycles ----

export type WoodpeckerDifficulty = 'easy' | 'medium' | 'hard';
export type WoodpeckerSize = 50 | 100 | 150;

/** GET /woodpecker/sets (active sets, newest first). */
export type WoodpeckerSetSummary = {
  /** 'wp_' + cuid; also the Library bookId of its results. */
  id: string;
  size: number;
  difficulty: WoodpeckerDifficulty;
  /** Whose level set the difficulty. */
  style: TrainingStyle;
  /** Centre of the puzzles' rating window. */
  rating: number;
  ratingMin: number;
  ratingMax: number;
  createdAt: string;
};

export type WoodpeckerPuzzle = {
  id: string;
  fen: string;
  /** UCI, space-separated; the first is the opponent's setup move. */
  moves: string;
  rating: number;
  themes: string[];
};

/** GET /woodpecker/sets/:id and POST /woodpecker/sets: puzzles in solving order (easiest first). */
export type WoodpeckerSet = WoodpeckerSetSummary & { puzzles: WoodpeckerPuzzle[] };

export type CreateWoodpeckerSetBody = { size: WoodpeckerSize; difficulty: WoodpeckerDifficulty; style: TrainingStyle };

// ---- haste (D40): GET /analytics/haste ----

export type HasteCounts = {
  mistakes: number;
  hasty: number;
  /** 0..1; 0 when there were no mistakes. */
  share: number;
};

export type HasteResponse = {
  /** Per style: a mistake faster than this is hasty (bullet 1500, blitz 3600, rapid 9000). */
  thresholdsMs: Record<TrainingStyle, number>;
  days: number;
  /** The last `days`. */
  total: HasteCounts;
  /** The `days` before that (the trend). */
  previous: HasteCounts;
  /** Only styles with mistakes. */
  byStyle: Array<{ style: TrainingStyle } & HasteCounts>;
  /** The last 8 weeks, oldest first, zeros included (weekStart: Monday, 'YYYY-MM-DD', UTC). */
  weeks: Array<{ weekStart: string } & HasteCounts>;
};

// ---- daily plan (D40): GET /plan/today ----

export type PlanTheme = {
  slug: string;
  attempts: number;
  /** 0..1; null when never played. */
  accuracy: number | null;
  reason: 'weak' | 'new';
};

export type PlanToday = {
  style: TrainingStyle;
  /** 3 (the weakest motif themes; 'new' ones fill a thin history). Fixed for the day once started. */
  themes: PlanTheme[];
  durationSec: number;
  /** The style's level − 50: what the session starts at. */
  startRating: number;
  /** A finished plan session started since `since`. */
  done: boolean;
  /** Today's latest plan session. */
  session: { id: string; solved: number; failed: number; accuracy: number } | null;
};
