'use client';

import { useMemo } from 'react';
import type { TrainingStyle } from '@/lib/levels';
import { STYLE_COLORS } from '@/components/StyleIcon';
import { cn } from '@/lib/utils';

type Point = { endedAt: string; style: TrainingStyle; rating: number };

type Props = {
  data: Point[];
  /** When set to a single style, the other lines are dimmed but
   *  still drawn for context. */
  highlightStyle?: TrainingStyle | null;
  className?: string;
  height?: number;
  language?: 'en' | 'uk';
};

const STYLE_HEX: Record<TrainingStyle, string> = {
  bullet: '#fb923c', // orange-400
  blitz: '#facc15',  // yellow-400
  rapid: '#34d399',  // emerald-400
};

const STYLE_ORDER: TrainingStyle[] = ['bullet', 'blitz', 'rapid'];

const NICE_STEPS = [25, 50, 100, 200, 250, 500, 1000];
function niceStep(rough: number): number {
  for (const c of NICE_STEPS) if (rough <= c) return c;
  return 1000;
}

/**
 * Cardinal spline → cubic Beziers. Tension 0.5 with /6 splits gives
 * a gentle smooth that doesn't overshoot rating spikes the way a
 * Catmull-Rom (tension 1) would.
 */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
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

/**
 * Per-style rating-over-time line chart. Drawn as a single SVG
 * with three smooth curves (one per style) over a soft area fill,
 * matched stylistically to the radar chart sitting just below.
 * Time axis is ordinal across all sessions (a 2-week break doesn't
 * open a 2-week gap on the chart — cadence belongs to the heatmap).
 */
export function RatingHistoryChart({
  data,
  highlightStyle = null,
  className,
  height = 220,
  language = 'en',
}: Props) {
  // Hooks live above the empty-state guard. Calling any hook below
  // an early return causes React #310 once data first arrives.
  const series = useMemo(() => {
    const byStyle: Record<TrainingStyle, Point[]> = {
      bullet: [],
      blitz: [],
      rapid: [],
    };
    for (const p of data) {
      if (byStyle[p.style]) byStyle[p.style].push(p);
    }
    return byStyle;
  }, [data]);

  const { yMin, yMax, gridStops } = useMemo(() => {
    if (data.length === 0) {
      return { yMin: 1100, yMax: 1500, gridStops: [1100, 1200, 1300, 1400, 1500] };
    }
    const ratings = data.map((p) => p.rating);
    const lo = Math.min(...ratings);
    const hi = Math.max(...ratings);
    // Aim for ~4 grid lines. The step ladder picks the next nice
    // round number above (range / 4) so labels stay readable.
    const step = niceStep(Math.max(1, hi - lo) / 4);
    const yMinR = Math.floor(lo / step) * step - step / 2;
    const yMaxR = Math.ceil(hi / step) * step + step / 2;
    const stops: number[] = [];
    for (let v = Math.ceil(yMinR / step) * step; v <= yMaxR; v += step) {
      stops.push(v);
    }
    return { yMin: yMinR, yMax: yMaxR, gridStops: stops };
  }, [data]);

  const ordered = useMemo(
    () => [...data].sort((a, b) => +new Date(a.endedAt) - +new Date(b.endedAt)),
    [data],
  );
  const xByPoint = useMemo(() => {
    const m = new Map<string, number>();
    ordered.forEach((p, i) => {
      m.set(`${p.style}-${p.endedAt}-${p.rating}`, i);
    });
    return m;
  }, [ordered]);

  if (data.length === 0) {
    return (
      <p className={cn('text-sm text-zinc-500 py-6 text-center', className)}>
        {language === 'uk' ? 'Поки мало сесій для графіка' : 'Not enough sessions yet'}
      </p>
    );
  }

  // Virtual SVG canvas: 0..1000 wide, scaled by viewBox to fit
  // whatever width the container hands us.
  const W = 1000;
  const H = height;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 14;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xMax = Math.max(1, ordered.length - 1);

  const xFor = (i: number) => padL + (i / xMax) * innerW;
  const yFor = (rating: number) =>
    padT + innerH - ((rating - yMin) / Math.max(1, yMax - yMin)) * innerH;
  const baseY = padT + innerH;

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          {STYLE_ORDER.map((style) => (
            <linearGradient key={style} id={`rh-grad-${style}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STYLE_HEX[style]} stopOpacity="0.28" />
              <stop offset="100%" stopColor={STYLE_HEX[style]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* y-axis grid + labels */}
        {gridStops.map((v) => {
          const y = yFor(v);
          return (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
              <text
                x={padL - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-zinc-300 tabular-nums"
                style={{ fontSize: 12, fontWeight: 500 }}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* lines per style — area fill below, smooth stroke on top,
            larger circles at vertices to match the radar's nodes. */}
        {STYLE_ORDER.map((style) => {
          const pts = series[style];
          if (pts.length === 0) return null;
          const dimmed = highlightStyle != null && highlightStyle !== style;
          const xy = pts.map((p) => {
            const i = xByPoint.get(`${p.style}-${p.endedAt}-${p.rating}`)!;
            return { x: xFor(i), y: yFor(p.rating) };
          });
          const linePath = smoothPath(xy);
          const first = xy[0];
          const last = xy[xy.length - 1];
          const areaPath = `${linePath} L${last.x},${baseY} L${first.x},${baseY} Z`;
          return (
            <g key={style} opacity={dimmed ? 0.18 : 1}>
              <path d={areaPath} fill={`url(#rh-grad-${style})`} stroke="none" />
              <path
                d={linePath}
                fill="none"
                stroke={STYLE_HEX[style]}
                strokeWidth={2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.length <= 60 && xy.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={STYLE_HEX[style]}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={1}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap pl-11">
        {STYLE_ORDER.map((style) => {
          const pts = series[style];
          if (pts.length === 0) return null;
          const dimmed = highlightStyle != null && highlightStyle !== style;
          const colorClass = STYLE_COLORS[style];
          const last = pts[pts.length - 1];
          return (
            <div
              key={style}
              className={cn('flex items-center gap-1.5 transition-opacity', dimmed && 'opacity-50')}
            >
              <span
                className="inline-block h-[3px] w-4 rounded-full"
                style={{ background: STYLE_HEX[style] }}
              />
              <span className={cn('uppercase tracking-wider text-[10px]', colorClass)}>{style}</span>
              <span className="tabular-nums text-zinc-400">{last.rating}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
