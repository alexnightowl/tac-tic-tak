// Hand-written response shapes for the routes the Phase 2 slice calls
// (today's /api/*; docs/mobile/inventory/backend.md, sessions.service.ts,
// users.service.ts). Dates arrive as ISO strings over JSON.
import type { Language } from '../i18n';
import type { ServerPuzzle } from '../puzzle';
import type { TrainingStyle, UnlockCheck } from '../rules';

export type ColorMode = 'auto' | 'white' | 'black';
export type AnimationSpeedSetting = 'instant' | 'fast' | 'normal' | 'slow';
export type KnightArrowSetting = 'bent' | 'straight';
export type SessionMode = 'mixed' | 'theme';

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

export type AttemptBody = { puzzleId: string; correct: boolean; responseMs: number };
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
