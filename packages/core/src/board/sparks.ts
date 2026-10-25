// Correct-answer ember sparks (Chessboard.tsx SPARKS + globals.css
// .ember-spark). Offsets are the web's px at its ~50px reference square;
// scale them by sq / SPARK_REF_SQ (PLAN §2.6). One progress clock drives all
// 14: each spark reads its own state from the elapsed time.

export type Spark = {
  dx: number;
  dy: number;
  size: number;
  color: string;
  ms: number;
};

export const SPARK_COUNT = 14;
export const SPARK_REF_SQ = 50;
/** Longest spark (520 + 3 * 60): run the shared clock this long. */
export const SPARK_TOTAL_MS = 700;
export const SPARK_EASING = [0.15, 0.7, 0.3, 1] as const;
/** Glow: box-shadow 0 0 6px rgba(242,127,75,0.9). */
export const SPARK_GLOW = { radius: 6, color: 'rgba(242,127,75,0.9)' } as const;
export const SPARK_END_SCALE = 0.3;

/** Deterministic: identical output to the web constant. */
export function makeSparks(count = SPARK_COUNT): Spark[] {
  'worklet';
  const out: Spark[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
    const d = 34 + ((i * 7) % 22);
    out.push({
      dx: Math.round(Math.cos(a) * d),
      dy: Math.round(Math.sin(a) * d) - 10,
      size: 3 + (i % 3),
      color: i % 3 === 0 ? '#f9b786' : i % 3 === 1 ? '#d35e4a' : '#fddcb1',
      ms: 520 + (i % 4) * 60,
    });
  }
  return out;
}

export const SPARKS: readonly Spark[] = makeSparks();

/**
 * CSS cubic-bezier(x1, y1, x2, y2) evaluated at time fraction t.
 * Newton steps with a bisection fallback, as browsers do.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  'worklet';
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t;
    if (Math.abs(x) < 1e-6) return ((ay * u + by) * u + cy) * u;
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
  }
  let lo = 0;
  let hi = 1;
  u = t;
  for (let i = 0; i < 30; i++) {
    const x = ((ax * u + bx) * u + cx) * u;
    if (Math.abs(x - t) < 1e-6) break;
    if (x < t) lo = u;
    else hi = u;
    u = (lo + hi) / 2;
  }
  return ((ay * u + by) * u + cy) * u;
}

export type SparkState = { x: number; y: number; scale: number; opacity: number };

/**
 * Spark at `elapsedMs` after the burst: translate to (dx, dy) * scale while
 * scaling 1 → 0.3 and fading 1 → 0 (keyframe ember-spark). Offsets are from
 * the square centre.
 */
export function sparkState(spark: Spark, elapsedMs: number, scale = 1): SparkState {
  'worklet';
  const k = Math.min(1, Math.max(0, elapsedMs / spark.ms));
  const e = cubicBezier(0.15, 0.7, 0.3, 1, k);
  return {
    x: spark.dx * scale * e,
    y: spark.dy * scale * e,
    scale: 1 + (0.3 - 1) * e,
    opacity: 1 - e,
  };
}
