// Training-style catalog + per-style unlock criteria.
// Must stay in sync with apps/frontend/src/lib/levels.ts.

export type TrainingStyle = 'bullet' | 'blitz' | 'rapid';
export const TRAINING_STYLES: TrainingStyle[] = ['bullet', 'blitz', 'rapid'];
export const DEFAULT_STYLE: TrainingStyle = 'blitz';

export const UNLOCK_REWARD = 50;

// Demotion: asymmetric to unlock so progress is easier than regress.
// A session counts as "weak" only when started within DEMOTE_PEAK_BAND of
// the current unlock ceiling AND ≤ DEMOTE_MAX_CRITERIA of the 4 unlock
// criteria are met. After WEAK_STREAK_THRESHOLD weak sessions in a row
// the ceiling drops by DEMOTE_PENALTY (clamped at startPuzzleRating).
// Sessions in the comfort zone (below the band) don't touch the streak.
export const DEMOTE_PENALTY = 25;
export const DEMOTE_PEAK_BAND = 50;
export const DEMOTE_MAX_CRITERIA = 1;
export const WEAK_STREAK_THRESHOLD = 2;

export type StyleFormula = {
  solvedPerMin: number;
  solvedFloor: number;
  accuracy: number;   // 0..1
  avgMs: number;
  peakDelta: number;
  durationPresetsSec: number[];
  minDurationSec: number;
  maxDurationSec: number;
};

export const STYLE_FORMULAS: Record<TrainingStyle, StyleFormula> = {
  bullet: {
    solvedPerMin: 3.5,
    solvedFloor: 3,
    accuracy: 0.65,
    avgMs: 6000,
    peakDelta: 75,
    durationPresetsSec: [60, 120, 180],
    minDurationSec: 60,
    maxDurationSec: 600,
  },
  blitz: {
    solvedPerMin: 2.5,
    solvedFloor: 5,
    accuracy: 0.70,
    avgMs: 10000,
    peakDelta: 100,
    durationPresetsSec: [300, 600, 900],
    minDurationSec: 60,
    maxDurationSec: 1800,
  },
  rapid: {
    solvedPerMin: 1.2,
    solvedFloor: 5,
    accuracy: 0.80,
    avgMs: 25000,
    peakDelta: 120,
    durationPresetsSec: [600, 1200, 1800],
    minDurationSec: 300,
    maxDurationSec: 3600,
  },
};

export function solvedTarget(style: TrainingStyle, durationSec: number): number {
  const f = STYLE_FORMULAS[style];
  const min = durationSec / 60;
  return Math.max(f.solvedFloor, Math.round(min * f.solvedPerMin));
}

export type UnlockCheck = {
  met: boolean;
  style: TrainingStyle;
  solvedTarget: number;
  criteria: Array<{
    id: 'solved' | 'accuracy' | 'speed' | 'peak';
    met: boolean;
    current: number;
    target: number;
  }>;
};

export function evaluateUnlock(
  style: TrainingStyle,
  stats: { solved: number; accuracy: number; avgResponseMs: number; peakRating: number },
  durationSec: number,
  startRating: number,
): UnlockCheck {
  const f = STYLE_FORMULAS[style];
  const target = solvedTarget(style, durationSec);
  const peakDelta = Math.max(0, stats.peakRating - startRating);

  const criteria: UnlockCheck['criteria'] = [
    { id: 'solved',   met: stats.solved >= target,               current: stats.solved,        target },
    { id: 'accuracy', met: stats.accuracy >= f.accuracy,         current: stats.accuracy,      target: f.accuracy },
    { id: 'speed',    met: stats.avgResponseMs > 0 && stats.avgResponseMs <= f.avgMs, current: stats.avgResponseMs, target: f.avgMs },
    { id: 'peak',     met: peakDelta >= f.peakDelta,             current: peakDelta,           target: f.peakDelta },
  ];

  return {
    met: criteria.every((c) => c.met),
    style,
    solvedTarget: target,
    criteria,
  };
}

export function isTrainingStyle(v: unknown): v is TrainingStyle {
  return typeof v === 'string' && TRAINING_STYLES.includes(v as TrainingStyle);
}

export type DemoteCheck = {
  // True iff the session was started in the peak band — only these
  // sessions touch the streak (in either direction).
  atPeak: boolean;
  // True iff the session was at peak AND failed enough criteria to be
  // counted as weak.
  weak: boolean;
  criteriaMet: number;
  // Streak after applying this session's outcome.
  streakAfter: number;
  // True iff the streak crossed the threshold and the ceiling was
  // dropped this session.
  demoted: boolean;
  penalty: number;
};

export function evaluateDemote(
  unlockMet: boolean,
  unlockCheck: UnlockCheck,
  startRating: number,
  unlockedStartRating: number,
  streakBefore: number,
): DemoteCheck {
  const criteriaMet = unlockCheck.criteria.filter((c) => c.met).length;
  const atPeak = startRating >= unlockedStartRating - DEMOTE_PEAK_BAND;
  const weak = atPeak && criteriaMet <= DEMOTE_MAX_CRITERIA;

  // Streak transitions:
  // - unlock met → reset (a clean pass clears any prior weakness)
  // - not at peak → leave as-is (training in comfort doesn't punish)
  // - at peak + weak → +1
  // - at peak + non-weak → reset (the player recovered)
  let streakAfter = streakBefore;
  if (unlockMet) streakAfter = 0;
  else if (!atPeak) streakAfter = streakBefore;
  else if (weak) streakAfter = streakBefore + 1;
  else streakAfter = 0;

  const demoted = streakAfter >= WEAK_STREAK_THRESHOLD;

  return {
    atPeak,
    weak,
    criteriaMet,
    // After demotion the streak resets so the player isn't on the brink
    // immediately again.
    streakAfter: demoted ? 0 : streakAfter,
    demoted,
    penalty: DEMOTE_PENALTY,
  };
}
