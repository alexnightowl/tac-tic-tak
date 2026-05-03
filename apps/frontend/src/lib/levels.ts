// Shared level/difficulty + unlock-criteria helpers.
// Must stay in sync with apps/backend/src/sessions/unlock.ts.

// ---- Difficulty bands (colouring the rating slider) ---------------------

export type Band = {
  min: number;
  max: number;
  key: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  color: string;      // hex used on the slider gradient
  glow: string;       // softer variant for badges
};

export const DIFFICULTY_BANDS: Band[] = [
  { min: 400,  max: 1000, key: 'novice',       color: '#22c55e', glow: 'rgba(34,197,94,0.18)' },
  { min: 1000, max: 1400, key: 'beginner',     color: '#84cc16', glow: 'rgba(132,204,22,0.18)' },
  { min: 1400, max: 1800, key: 'intermediate', color: '#eab308', glow: 'rgba(234,179,8,0.20)' },
  { min: 1800, max: 2200, key: 'advanced',     color: '#f97316', glow: 'rgba(249,115,22,0.22)' },
  { min: 2200, max: 3000, key: 'expert',       color: '#ef4444', glow: 'rgba(239,68,68,0.22)' },
];

export function bandFor(rating: number): Band {
  for (const b of DIFFICULTY_BANDS) {
    if (rating >= b.min && rating < b.max) return b;
  }
  return DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1];
}

// ---- Training styles ----------------------------------------------------

export type TrainingStyle = 'bullet' | 'blitz' | 'rapid';
export const TRAINING_STYLES: TrainingStyle[] = ['bullet', 'blitz', 'rapid'];
export const DEFAULT_STYLE: TrainingStyle = 'blitz';

export type StyleFormula = {
  solvedPerMin: number;
  solvedFloor: number;
  accuracy: number;
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

export const UNLOCK_REWARD = 50;

// Sessions per style required to leave the provisional period. Mirror
// of CALIBRATION_SESSIONS in apps/backend/src/sessions/unlock.ts —
// keep these two in sync.
export const CALIBRATION_SESSIONS = 5;

export function solvedTarget(style: TrainingStyle, durationSec: number): number {
  const f = STYLE_FORMULAS[style];
  const min = durationSec / 60;
  return Math.max(f.solvedFloor, Math.round(min * f.solvedPerMin));
}

// ---- Unlock progress ----------------------------------------------------

export type UnlockStats = {
  solved: number;
  accuracy: number;      // 0..1
  avgResponseMs: number;
  peakRating: number;
  startRating: number;
};

export type CriterionId = 'solved' | 'accuracy' | 'speed' | 'peak';

export type CriterionProgress = {
  id: CriterionId;
  ratio: number;
  met: boolean;
  current: number;
  target: number;
};

export function computeUnlockProgress(
  style: TrainingStyle,
  stats: UnlockStats,
  durationSec: number,
): { criteria: CriterionProgress[]; ratio: number; met: boolean } {
  const f = STYLE_FORMULAS[style];
  const target = solvedTarget(style, durationSec);

  const solvedRatio = clamp01(stats.solved / target);
  const accuracyRatio = clamp01(stats.accuracy / f.accuracy);
  const speedRatio = stats.avgResponseMs === 0
    ? 0
    : clamp01(f.avgMs / Math.max(stats.avgResponseMs, 1));
  const peakDelta = Math.max(0, stats.peakRating - stats.startRating);
  const peakRatio = clamp01(peakDelta / f.peakDelta);

  const criteria: CriterionProgress[] = [
    { id: 'solved',   ratio: solvedRatio,   met: stats.solved >= target,           current: stats.solved,         target },
    { id: 'accuracy', ratio: accuracyRatio, met: stats.accuracy >= f.accuracy,      current: stats.accuracy,       target: f.accuracy },
    { id: 'speed',    ratio: speedRatio,    met: stats.avgResponseMs > 0 && stats.avgResponseMs <= f.avgMs, current: stats.avgResponseMs, target: f.avgMs },
    { id: 'peak',     ratio: peakRatio,     met: peakDelta >= f.peakDelta,          current: peakDelta,            target: f.peakDelta },
  ];

  const overall = Math.min(...criteria.map((c) => c.ratio));
  const met = criteria.every((c) => c.met);
  return { criteria, ratio: overall, met };
}

export function isTrainingStyle(v: unknown): v is TrainingStyle {
  return typeof v === 'string' && TRAINING_STYLES.includes(v as TrainingStyle);
}

function clamp01(v: number) {
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
