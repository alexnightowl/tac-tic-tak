// Shared level/difficulty + unlock-criteria helpers.
// NOTE: unlock thresholds here must stay in sync with
// apps/backend/src/sessions/sessions.service.ts::finish.

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

// --- Unlock criteria -----------------------------------------------------

export const UNLOCK_ACCURACY = 0.70;
export const UNLOCK_AVG_MS = 10_000;
export const UNLOCK_DELTA = 100;
export const UNLOCK_REWARD = 50;
export const UNLOCK_SOLVED_PER_MIN = 1.2;
export const UNLOCK_SOLVED_FLOOR = 5;

export function solvedTarget(durationSec: number): number {
  const min = durationSec / 60;
  return Math.max(UNLOCK_SOLVED_FLOOR, Math.round(min * UNLOCK_SOLVED_PER_MIN));
}

export type UnlockStats = {
  solved: number;
  accuracy: number;   // 0..1
  avgResponseMs: number;
  peakRating: number;
  startRating: number;
};

export type CriterionId = 'solved' | 'accuracy' | 'speed' | 'peak';

export type CriterionProgress = {
  id: CriterionId;
  ratio: number;  // 0..1, capped
  met: boolean;
  current: number;
  target: number;
};

/**
 * Returns the per-criterion progress for level-up. All four must be met
 * (ratio >= 1) for the session to unlock the next tier.
 */
export function computeUnlockProgress(
  stats: UnlockStats,
  durationSec: number,
): { criteria: CriterionProgress[]; ratio: number; met: boolean } {
  const target = solvedTarget(durationSec);
  const solvedRatio = clamp01(stats.solved / target);

  const accuracyRatio = clamp01(stats.accuracy / UNLOCK_ACCURACY);
  // Faster is better — ratio 1 at target speed, 0 when avg is 2x the target.
  const speedRatio =
    stats.avgResponseMs === 0
      ? 0
      : clamp01(UNLOCK_AVG_MS / Math.max(stats.avgResponseMs, 1));

  const peakDelta = Math.max(0, stats.peakRating - stats.startRating);
  const peakRatio = clamp01(peakDelta / UNLOCK_DELTA);

  const criteria: CriterionProgress[] = [
    { id: 'solved',   ratio: solvedRatio,   met: stats.solved >= target,           current: stats.solved,            target },
    { id: 'accuracy', ratio: accuracyRatio, met: stats.accuracy >= UNLOCK_ACCURACY, current: stats.accuracy,         target: UNLOCK_ACCURACY },
    { id: 'speed',    ratio: speedRatio,    met: stats.avgResponseMs > 0 && stats.avgResponseMs <= UNLOCK_AVG_MS, current: stats.avgResponseMs, target: UNLOCK_AVG_MS },
    { id: 'peak',     ratio: peakRatio,     met: peakDelta >= UNLOCK_DELTA,         current: peakDelta,              target: UNLOCK_DELTA },
  ];

  const overall = Math.min(...criteria.map((c) => c.ratio));
  const met = criteria.every((c) => c.met);
  return { criteria, ratio: overall, met };
}

function clamp01(v: number) {
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
