'use client';

import { useMemo } from 'react';

type Datum = { label: string; value: number };

type Props = {
  data: Datum[];
  /** Fixed min/max for the scale (defaults derive from data). */
  min?: number;
  max?: number;
  size?: number;
  strokeColor?: string;
  fillColor?: string;
  rings?: number;
};

/**
 * If a label is too long for a single line near the polygon edge,
 * split it on the most-balanced word boundary so the two halves
 * are roughly equal width. Single-word giants stay as-is — the
 * outer padding gives them headroom.
 */
function wrapLabel(label: string): string[] {
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

export function RadarChart({ data, min, max, size = 320, strokeColor = 'var(--accent)', fillColor = 'var(--accent-soft)', rings = 5 }: Props) {
  const n = data.length;
  const computed = useMemo(() => {
    if (n === 0) return null;
    const values = data.map((d) => d.value);
    const scaleMin = min ?? Math.min(...values, 0);
    const scaleMax = max ?? Math.max(...values, scaleMin + 100);
    const cx = size / 2;
    const cy = size / 2;
    // Bigger inset (was 48) so wrapped two-line labels and long
    // single-word labels don't run off the SVG. Costs us ~14px of
    // polygon radius — the data still reads cleanly.
    const r = size / 2 - 62;
    const toXY = (idx: number, v: number) => {
      const t = (v - scaleMin) / Math.max(1, scaleMax - scaleMin);
      const angle = -Math.PI / 2 + (idx / n) * Math.PI * 2;
      return { x: cx + Math.cos(angle) * r * t, y: cy + Math.sin(angle) * r * t };
    };
    const spokePoint = (idx: number, f: number) => {
      const angle = -Math.PI / 2 + (idx / n) * Math.PI * 2;
      return { x: cx + Math.cos(angle) * r * f, y: cy + Math.sin(angle) * r * f };
    };
    const poly = data.map((d, i) => toXY(i, d.value));
    return { cx, cy, r, scaleMin, scaleMax, toXY, spokePoint, poly };
  }, [data, min, max, size, n]);

  if (!computed || n === 0) {
    return <div className="text-xs text-zinc-500 text-center py-10">—</div>;
  }
  const { cx, cy, r, scaleMin, scaleMax, spokePoint, poly } = computed;

  // Give the SVG horizontal slack so labels at left / right spokes
  // don't get clipped by the viewBox edge. The polygon stays
  // centred at cx,cy; we just paint over a wider canvas.
  const overflowX = 56;
  const viewW = size + overflowX * 2;
  const viewX = -overflowX;

  return (
    <svg
      width={viewW}
      height={size}
      viewBox={`${viewX} 0 ${viewW} ${size}`}
      className="select-none max-w-full"
      style={{ height: size }}
    >
      {/* rings */}
      {Array.from({ length: rings }).map((_, i) => {
        const f = (i + 1) / rings;
        const pts = data.map((_, idx) => spokePoint(idx, f));
        const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
        return (
          <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.08)" />
        );
      })}
      {/* spokes */}
      {data.map((_, idx) => {
        const outer = spokePoint(idx, 1);
        return <line key={idx} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.06)" />;
      })}
      {/* ring labels */}
      {Array.from({ length: rings }).map((_, i) => {
        const f = (i + 1) / rings;
        const v = Math.round(scaleMin + (scaleMax - scaleMin) * f);
        return (
          <text key={`rl-${i}`} x={cx + 4} y={cy - r * f + 4} className="fill-zinc-500" style={{ fontSize: 10 }}>
            {v}
          </text>
        );
      })}
      {/* polygon */}
      <path
        d={poly.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {poly.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.2} fill={strokeColor} />)}
      {/* axis labels — wrapped onto 2 lines for long names so they
          fit the available radial slot without clipping. */}
      {data.map((d, idx) => {
        const labelP = spokePoint(idx, 1.14);
        const anchor = labelP.x < cx - 3 ? 'end' : labelP.x > cx + 3 ? 'start' : 'middle';
        const lines = wrapLabel(d.label);
        const lineH = 12;
        // Shift the first line up so the visual centre of a 2-line
        // label still sits on labelP.y.
        const firstY = labelP.y - ((lines.length - 1) * lineH) / 2;
        return (
          <text
            key={`al-${idx}`}
            textAnchor={anchor}
            className="fill-zinc-300"
            style={{ fontSize: 11, dominantBaseline: 'middle' }}
          >
            {lines.map((line, li) => (
              <tspan key={li} x={labelP.x} y={firstY + li * lineH}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}
