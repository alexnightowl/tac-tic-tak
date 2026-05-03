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

/**
 * Per-style rating-over-time line chart. Drawn as a single SVG
 * with three polylines (one per style); points are session
 * peakRatings keyed by endedAt. We pick peakRating over startRating
 * because it's the most representative single number per session
 * — the rest of the app already uses it as the headline value.
 *
 * Time axis is linear over the data range, not real-calendar; if
 * the player took a 2-week break it doesn't open a 2-week gap on
 * the chart. Trade-off accepted: easier to read trend, slightly
 * less honest about cadence. The heatmap below picks up cadence.
 */
export function RatingHistoryChart({
  data,
  highlightStyle = null,
  className,
  height = 200,
  language = 'en',
}: Props) {
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

  const { yMin, yMax } = useMemo(() => {
    if (data.length === 0) return { yMin: 1100, yMax: 1500 };
    const ratings = data.map((p) => p.rating);
    const lo = Math.min(...ratings);
    const hi = Math.max(...ratings);
    // Snap to multiples of 50 with a small headroom so the line
    // doesn't kiss the chart edge.
    const padded = (hi - lo) < 100 ? 50 : Math.round((hi - lo) * 0.1);
    return {
      yMin: Math.floor((lo - padded) / 50) * 50,
      yMax: Math.ceil((hi + padded) / 50) * 50,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className={cn('text-sm text-zinc-500 py-6 text-center', className)}>
        {language === 'uk' ? 'Поки мало сесій для графіка' : 'Not enough sessions yet'}
      </p>
    );
  }

  // Width is responsive via viewBox; we lay out points along a
  // virtual 0..1000 axis and let the SVG scale to its container.
  const W = 1000;
  const H = height;
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // X uses a simple ordinal index across all points — the actual
  // calendar gap doesn't matter for the line's shape (see comment
  // above). Build a global ordering by endedAt so styles share the
  // same x scale.
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
  const xMax = Math.max(1, ordered.length - 1);

  const xFor = (i: number) => padL + (i / xMax) * innerW;
  const yFor = (rating: number) =>
    padT + innerH - ((rating - yMin) / Math.max(1, yMax - yMin)) * innerH;

  // 4 horizontal grid lines at round-50 ratings.
  const gridStops = useMemo(() => {
    const span = yMax - yMin;
    const step = span > 400 ? 100 : 50;
    const stops: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
      stops.push(v);
    }
    return stops;
  }, [yMin, yMax]);

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {/* y-axis grid + labels */}
        {gridStops.map((v) => {
          const y = yFor(v);
          return (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
              <text
                x={padL - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-zinc-500"
                style={{ fontSize: 10 }}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* lines per style */}
        {STYLE_ORDER.map((style) => {
          const pts = series[style];
          if (pts.length === 0) return null;
          const dimmed = highlightStyle != null && highlightStyle !== style;
          const path = pts
            .map((p) => {
              const i = xByPoint.get(`${p.style}-${p.endedAt}-${p.rating}`)!;
              return `${xFor(i)},${yFor(p.rating)}`;
            })
            .map((coords, i) => `${i === 0 ? 'M' : 'L'}${coords}`)
            .join(' ');
          return (
            <g key={style} opacity={dimmed ? 0.18 : 1}>
              <path
                d={path}
                fill="none"
                stroke={STYLE_HEX[style]}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.length <= 60 && pts.map((p, i) => {
                const idx = xByPoint.get(`${p.style}-${p.endedAt}-${p.rating}`)!;
                return (
                  <circle
                    key={i}
                    cx={xFor(idx)}
                    cy={yFor(p.rating)}
                    r={2}
                    fill={STYLE_HEX[style]}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap pl-9">
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
