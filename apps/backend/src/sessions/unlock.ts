// Training-style catalog + per-style unlock criteria.
// Must stay in sync with apps/frontend/src/lib/levels.ts.

export type TrainingStyle = 'bullet' | 'blitz' | 'rapid';
export const TRAINING_STYLES: TrainingStyle[] = ['bullet', 'blitz', 'rapid'];
export const DEFAULT_STYLE: TrainingStyle = 'blitz';

export const UNLOCK_REWARD = 50;

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
