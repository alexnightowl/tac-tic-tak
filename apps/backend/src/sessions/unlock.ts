// Training-style catalog + per-style unlock criteria.
// Must stay in sync with apps/frontend/src/lib/levels.ts.

export type TrainingStyle = 'bullet' | 'blitz' | 'rapid';
export const TRAINING_STYLES: TrainingStyle[] = ['bullet', 'blitz', 'rapid'];
export const DEFAULT_STYLE: TrainingStyle = 'blitz';

export const UNLOCK_REWARD = 50;

// Demotion: asymmetric to unlock so progress is easier than regress.
// A session counts as "weak" only when started within DEMOTE_PEAK_BAND of
// the current unlock ceiling AND ≤ DEMOTE_MAX_CRITERIA of the 3 unlock
// criteria are met. After WEAK_STREAK_THRESHOLD weak sessions in a row
// the ceiling drops by DEMOTE_PENALTY (clamped at startPuzzleRating).
// Sessions in the comfort zone (below the band) don't touch the streak.
export const DEMOTE_PENALTY = 25;
export const DEMOTE_PEAK_BAND = 50;
export const DEMOTE_MAX_CRITERIA = 1;
export const WEAK_STREAK_THRESHOLD = 2;

// Provisional / calibration window: number of rated sessions a brand-
// new style progression (or a recalibrating one) uses to place its
// ceiling before the usual +50 / -25 rules engage. The placement
// itself lives in calibration.ts.
export const CALIBRATION_SESSIONS = 5;

export type StyleFormula = {
  solvedPerMin: number;
  solvedFloor: number;
  accuracy: number;   // 0..1
  peakDelta: number;
  durationPresetsSec: number[];
  minDurationSec: number;
  maxDurationSec: number;
};

// solvedPerMin used to be paired with a separate avgMs speed gate.
// Speed was always the binding constraint, making solved redundant
// — see the May 2026 redesign. Per-min now bakes in pace = (60s /
// avgMs) × accuracy, so passing solved+accuracy implicitly proves
// the throughput we used to require explicitly.
export const STYLE_FORMULAS: Record<TrainingStyle, StyleFormula> = {
  bullet: {
    solvedPerMin: 6.5,
    solvedFloor: 3,
    accuracy: 0.65,
    peakDelta: 75,
    durationPresetsSec: [60, 120, 180],
    minDurationSec: 60,
    maxDurationSec: 600,
  },
  blitz: {
    solvedPerMin: 4.2,
    solvedFloor: 5,
    accuracy: 0.70,
    peakDelta: 100,
    durationPresetsSec: [300, 600, 900],
    minDurationSec: 60,
    maxDurationSec: 1800,
  },
  rapid: {
    solvedPerMin: 1.9,
    solvedFloor: 5,
    accuracy: 0.80,
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
    id: 'solved' | 'accuracy' | 'peak';
    met: boolean;
    current: number;
    target: number;
  }>;
};

export function evaluateUnlock(
  style: TrainingStyle,
  stats: { solved: number; accuracy: number; peakRating: number },
  durationSec: number,
  startRating: number,
): UnlockCheck {
  const f = STYLE_FORMULAS[style];
  const target = solvedTarget(style, durationSec);
  const peakDelta = Math.max(0, stats.peakRating - startRating);

  const criteria: UnlockCheck['criteria'] = [
    { id: 'solved',   met: stats.solved >= target,       current: stats.solved,    target },
    { id: 'accuracy', met: stats.accuracy >= f.accuracy, current: stats.accuracy,  target: f.accuracy },
    { id: 'peak',     met: peakDelta >= f.peakDelta,     current: peakDelta,       target: f.peakDelta },
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

export type CalibrationCheck = {
  // Was this session run under provisional rules.
  active: boolean;
  sessionsLeftBefore: number;
  sessionsLeftAfter: number;
  ceilingBefore: number;
  ceilingAfter: number;
  // How many of the three unlock criteria the player met this session.
  criteriaMet: number;
  // Signed change of the ceiling.
  delta: number;
  // Fitted puzzle rating over the whole window so far.
  performance: number;
};

/**
 * Applies a calibration session: the ceiling moves to `target` (from
 * calibrationNorm over the whole window), never below `normFloor`. A
 * null target (no attempts yet) keeps the ceiling.
 */
export function evaluateCalibration(
  unlockedStartRating: number,
  normFloor: number,
  target: number | null,
  performance: number,
  unlockCheck: UnlockCheck,
  calibrationSessionsLeft: number,
): CalibrationCheck {
  const criteriaMet = unlockCheck.criteria.filter((c) => c.met).length;
  const after = target === null ? unlockedStartRating : Math.max(normFloor, target);
  return {
    active: true,
    sessionsLeftBefore: calibrationSessionsLeft,
    sessionsLeftAfter: Math.max(0, calibrationSessionsLeft - 1),
    ceilingBefore: unlockedStartRating,
    ceilingAfter: after,
    criteriaMet,
    delta: after - unlockedStartRating,
    performance,
  };
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
