// Pure parts of apps/frontend/src/components/charts/RatingHistoryChart.tsx.
// The web draws into a 1000-wide viewBox stretched with
// preserveAspectRatio="none"; here the caller passes real pixel sizes.
import type { TrainingStyle } from '../rules';

export type RatingPoint = { endedAt: string; style: TrainingStyle; rating: number };
export type XY = { x: number; y: number };

// Ember on stone chart palette.
export const RATING_STYLE_HEX: Record<TrainingStyle, string> = {
  bullet: '#928e94', // graphite
  blitz: '#a64241',  // ember
  rapid: '#afc0a9',  // sage
};

export const RATING_STYLE_ORDER: TrainingStyle[] = ['rapid', 'blitz', 'bullet'];

export const NICE_STEPS = [25, 50, 100, 200, 250, 500, 1000];

export function niceStep(rough: number): number {
  for (const c of NICE_STEPS) if (rough <= c) return c;
  return 1000;
}

/**
 * Cardinal spline → cubic Beziers. Tension 0.5 with /6 splits gives a
 * gentle smooth that doesn't overshoot rating spikes the way a
 * Catmull-Rom (tension 1) would.
 */
export function smoothPath(pts: XY[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const tension = 0.5;
  const segs: string[] = [`M${pts[0].x},${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i === 0 ? pts[0] : pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i === pts.length - 2 ? pts[i + 1] : pts[i + 2];
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6;
    segs.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return segs.join(' ');
}

/** Y range padded half a step past the data, with ~4 grid lines on
 *  nice round values. */
export function ratingScale(ratings: number[]): { yMin: number; yMax: number; gridStops: number[] } {
  if (ratings.length === 0) {
    return { yMin: 1100, yMax: 1500, gridStops: [1100, 1200, 1300, 1400, 1500] };
  }
  const lo = Math.min(...ratings);
  const hi = Math.max(...ratings);
  const step = niceStep(Math.max(1, hi - lo) / 4);
  const yMin = Math.floor(lo / step) * step - step / 2;
  const yMax = Math.ceil(hi / step) * step + step / 2;
  const gridStops: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
    gridStops.push(v);
  }
  return { yMin, yMax, gridStops };
}

export type RatingSeries = {
  style: TrainingStyle;
  points: Array<XY & { rating: number; endedAt: string }>;
  linePath: string;
  areaPath: string;
  /** Latest rating in the series (legend value). */
  last: number;
  /** The web stops drawing vertex dots past 60 points. */
  showDots: boolean;
};

export type RatingChartLayout = {
  yMin: number;
  yMax: number;
  grid: Array<{ value: number; y: number }>;
  baseY: number;
  /** In RATING_STYLE_ORDER; styles with no points are omitted. */
  series: RatingSeries[];
};

/**
 * Lays the chart out in a width × height box. The time axis is ordinal
 * across all sessions (a 2-week break opens no gap; cadence belongs to
 * the heatmap). Returns null for empty data (the web shows its "not
 * enough sessions" text).
 */
export function ratingChartLayout(
  data: RatingPoint[],
  box: { width: number; height: number; padL?: number; padR?: number; padT?: number; padB?: number },
): RatingChartLayout | null {
  if (data.length === 0) return null;
  const { width: W, height: H, padL = 0, padR = 12, padT = 10, padB = 14 } = box;
  const { yMin, yMax, gridStops } = ratingScale(data.map((p) => p.rating));

  const ordered = [...data].sort((a, b) => +new Date(a.endedAt) - +new Date(b.endedAt));
  // web bug: the web keys x positions by `${style}-${endedAt}-${rating}`,
  // so identical points collapse onto the last index and leave a gap
  // (inventory stats-settings-shell.md). Key by identity instead.
  const xIndex = new Map<RatingPoint, number>();
  ordered.forEach((p, i) => xIndex.set(p, i));

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xMax = Math.max(1, ordered.length - 1);
  const xFor = (i: number) => padL + (i / xMax) * innerW;
  const yFor = (rating: number) =>
    padT + innerH - ((rating - yMin) / Math.max(1, yMax - yMin)) * innerH;
  const baseY = padT + innerH;

  const byStyle: Record<TrainingStyle, RatingPoint[]> = { bullet: [], blitz: [], rapid: [] };
  for (const p of data) {
    if (byStyle[p.style]) byStyle[p.style].push(p);
  }

  const series: RatingSeries[] = [];
  for (const style of RATING_STYLE_ORDER) {
    const pts = byStyle[style];
    if (pts.length === 0) continue;
    const points = pts.map((p) => ({
      x: xFor(xIndex.get(p)!),
      y: yFor(p.rating),
      rating: p.rating,
      endedAt: p.endedAt,
    }));
    const linePath = smoothPath(points);
    const first = points[0];
    const last = points[points.length - 1];
    series.push({
      style,
      points,
      linePath,
      areaPath: `${linePath} L${last.x},${baseY} L${first.x},${baseY} Z`,
      last: pts[pts.length - 1].rating,
      showDots: pts.length <= 60,
    });
  }

  return {
    yMin,
    yMax,
    grid: gridStops.map((value) => ({ value, y: yFor(value) })),
    baseY,
    series,
  };
}
