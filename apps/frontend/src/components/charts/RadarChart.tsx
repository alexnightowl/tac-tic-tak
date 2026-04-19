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

export function RadarChart({ data, min, max, size = 320, strokeColor = 'var(--accent)', fillColor = 'var(--accent-soft)', rings = 5 }: Props) {
  const n = data.length;
  const computed = useMemo(() => {
    if (n === 0) return null;
    const values = data.map((d) => d.value);
    const scaleMin = min ?? Math.min(...values, 0);
    const scaleMax = max ?? Math.max(...values, scaleMin + 100);
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 48;
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

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none">
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
      {/* axis labels */}
      {data.map((d, idx) => {
        const labelP = spokePoint(idx, 1.12);
        const anchor = labelP.x < cx - 3 ? 'end' : labelP.x > cx + 3 ? 'start' : 'middle';
        return (
          <text key={`al-${idx}`} x={labelP.x} y={labelP.y} textAnchor={anchor} className="fill-zinc-300"
                style={{ fontSize: 11, dominantBaseline: 'middle' }}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
