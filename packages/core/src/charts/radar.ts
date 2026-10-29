// Pure parts of apps/frontend/src/components/charts/RadarChart.tsx and
// the analytics page's radar derivations.
import { isMetaTheme, themeLabel } from '../themes';

export type RadarDatum = { label: string; value: number };
export type Point = { x: number; y: number };

/**
 * If a label is too long for a single line near the polygon edge, split
 * it on the most-balanced word boundary so the two halves are roughly
 * equal width. Single-word giants stay as-is — the outer padding gives
 * them headroom.
 */
export function wrapLabel(label: string): string[] {
  if (label.length <= 12) return [label];
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [label];
  let bestSplit = 1;
  let bestImbalance = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const imbalance = Math.abs(a - b);
    if (imbalance < bestImbalance) {
      bestImbalance = imbalance;
      bestSplit = i;
    }
  }
  return [
    words.slice(0, bestSplit).join(' '),
    words.slice(bestSplit).join(' '),
  ];
}

export type RadarGeometry = {
  cx: number;
  cy: number;
  r: number;
  scaleMin: number;
  scaleMax: number;
  /** viewBox x origin and width: 40px of horizontal overflow each side
   *  so side labels aren't clipped. Height is `size`. */
  viewX: number;
  viewW: number;
  /** Closed polygon paths, innermost first. */
  ringPaths: string[];
  ringLabels: Array<{ x: number; y: number; value: number }>;
  spokes: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  poly: Point[];
  polyPath: string;
  axisLabels: Array<{
    x: number;
    /** y of the first line; later lines step down by lineHeight. */
    firstY: number;
    anchor: 'start' | 'middle' | 'end';
    lines: string[];
  }>;
  lineHeight: number;
};

const closedPath = (pts: Point[]) =>
  pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';

/** Radar layout for `data` (spokes start at 12 o'clock, clockwise).
 *  Returns null for no data (the web renders '—'). */
export function radarGeometry(
  data: RadarDatum[],
  opts: { min?: number; max?: number; size?: number; rings?: number } = {},
): RadarGeometry | null {
  const n = data.length;
  if (n === 0) return null;
  const { size = 320, rings = 4 } = opts;
  const values = data.map((d) => d.value);
  const scaleMin = opts.min ?? Math.min(...values, 0);
  const scaleMax = opts.max ?? Math.max(...values, scaleMin + 100);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 44;
  const toXY = (idx: number, v: number): Point => {
    const t = (v - scaleMin) / Math.max(1, scaleMax - scaleMin);
    const angle = -Math.PI / 2 + (idx / n) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * r * t, y: cy + Math.sin(angle) * r * t };
  };
  const spokePoint = (idx: number, f: number): Point => {
    const angle = -Math.PI / 2 + (idx / n) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * r * f, y: cy + Math.sin(angle) * r * f };
  };

  const ringPaths: string[] = [];
  const ringLabels: RadarGeometry['ringLabels'] = [];
  for (let i = 0; i < rings; i++) {
    const f = (i + 1) / rings;
    ringPaths.push(closedPath(data.map((_, idx) => spokePoint(idx, f))));
    // Inside the ring, just under its top vertex (design v2).
    ringLabels.push({
      x: cx + 4,
      y: cy - r * f + 11,
      value: Math.round(scaleMin + (scaleMax - scaleMin) * f),
    });
  }

  const spokes = data.map((_, idx) => {
    const outer = spokePoint(idx, 1);
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y };
  });

  const poly = data.map((d, i) => toXY(i, d.value));
  const lineHeight = 12;
  const axisLabels = data.map((d, idx) => {
    const p = spokePoint(idx, 1.14);
    const anchor: 'start' | 'middle' | 'end' = p.x < cx - 3 ? 'end' : p.x > cx + 3 ? 'start' : 'middle';
    const lines = wrapLabel(d.label);
    // Shift the first line up so a 2-line label stays centred on p.y.
    return { x: p.x, firstY: p.y - ((lines.length - 1) * lineHeight) / 2, anchor, lines };
  });

  const overflowX = 40;
  return {
    cx, cy, r, scaleMin, scaleMax,
    viewX: -overflowX,
    viewW: size + overflowX * 2,
    ringPaths, ringLabels, spokes,
    poly, polyPath: closedPath(poly),
    axisLabels, lineHeight,
  };
}

/** Analytics radar input: rated tactical themes, the 8 most-attempted,
 *  shown alphabetically by slug. The web hides the chart below 3. */
export function selectRadarThemes(
  themes: Array<{ slug: string; rating: number; attempts: number }>,
  lang: 'en' | 'uk' = 'en',
): RadarDatum[] {
  return themes
    .filter((t) => t.rating > 0 && !isMetaTheme(t.slug))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 8)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((t) => ({ label: themeLabel(t.slug, lang), value: t.rating }));
}

export const RADAR_MIN_THEMES = 3;

/** Scale bounds: data range rounded out to 100s plus a 100 margin,
 *  floored at 600. */
export function radarBounds(data: RadarDatum[]): { min: number; max: number } {
  if (data.length === 0) return { min: 1200, max: 2000 };
  const values = data.map((d) => d.value);
  const lo = Math.floor(Math.min(...values) / 100) * 100;
  const hi = Math.ceil(Math.max(...values) / 100) * 100;
  return { min: Math.max(600, lo - 100), max: hi + 100 };
}
