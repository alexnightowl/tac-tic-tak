// Level-up unlock criteria.
// Keep these constants in sync with apps/frontend/src/lib/levels.ts.

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

export type UnlockCheck = {
  met: boolean;
  solvedTarget: number;
  criteria: Array<{
    id: 'solved' | 'accuracy' | 'speed' | 'peak';
    met: boolean;
    current: number;
    target: number;
  }>;
};

export function evaluateUnlock(
  stats: { solved: number; accuracy: number; avgResponseMs: number; peakRating: number },
  durationSec: number,
  startRating: number,
): UnlockCheck {
  const target = solvedTarget(durationSec);
  const peakDelta = Math.max(0, stats.peakRating - startRating);

  const criteria: UnlockCheck['criteria'] = [
    { id: 'solved',   met: stats.solved >= target,             current: stats.solved,        target },
    { id: 'accuracy', met: stats.accuracy >= UNLOCK_ACCURACY,   current: stats.accuracy,     target: UNLOCK_ACCURACY },
    { id: 'speed',    met: stats.avgResponseMs > 0 && stats.avgResponseMs <= UNLOCK_AVG_MS, current: stats.avgResponseMs, target: UNLOCK_AVG_MS },
    { id: 'peak',     met: peakDelta >= UNLOCK_DELTA,           current: peakDelta,          target: UNLOCK_DELTA },
  ];

  return {
    met: criteria.every((c) => c.met),
    solvedTarget: target,
    criteria,
  };
}
