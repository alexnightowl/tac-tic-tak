'use client';

import { useCallback, useMemo, useRef } from 'react';
import { Lock, Sprout, Flame, Swords, Shield, Crown } from 'lucide-react';
import { Band, DIFFICULTY_BANDS } from '@/lib/levels';
import { cn } from '@/lib/utils';

const BAND_ICONS: Record<Band['key'], typeof Sprout> = {
  novice: Sprout,
  beginner: Flame,
  intermediate: Swords,
  advanced: Shield,
  expert: Crown,
};

type Props = {
  value: number;
  onChange: (v: number) => void;
  /** Visual floor of the track (default 400). */
  min?: number;
  /** Visual ceiling of the track (default 2600). */
  max?: number;
  /** Thumb can't go past this value. The region beyond is rendered locked. */
  cap: number;
  step?: number;
  labels: Record<Band['key'], string>;
  currentRating?: number | null;
  /** Labels that appear under the thumb and the "current" marker. */
  thumbLabel?: string;
  currentLabel?: string;
  ariaLabel?: string;
};

export function DifficultySlider({
  value, onChange, min = 400, max = 2600, cap, step = 25,
  labels, currentRating, thumbLabel, currentLabel, ariaLabel,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const gradient = useMemo(() => buildGradient(min, max), [min, max]);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const valuePct = clampPct(pct(value));
  const capPct = clampPct(pct(cap));
  const currentPct = currentRating != null ? clampPct(pct(currentRating)) : null;

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    const capped = Math.min(cap, Math.max(min, snapped));
    onChange(capped);
  }, [min, max, cap, step, onChange]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onChange(Math.max(min, value - step)); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onChange(Math.min(cap, value + step)); e.preventDefault(); }
    if (e.key === 'Home') { onChange(min); e.preventDefault(); }
    if (e.key === 'End')  { onChange(cap); e.preventDefault(); }
  };

  return (
    <div className="w-full select-none">
      {/* Interactive track */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={cap}
        aria-valuenow={value}
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative h-9 cursor-pointer touch-none outline-none"
        style={{ touchAction: 'none' }}
      >
        {/* Gradient track */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full"
          style={{ background: gradient }}
        />

        {/* Locked region overlay (beyond cap) */}
        {capPct < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-2 rounded-r-full"
            style={{
              left: `${capPct}%`,
              right: 0,
              background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.55) 0 4px, rgba(0,0,0,0.25) 4px 8px)',
            }}
          />
        )}

        {/* Lock marker at the cap */}
        {capPct < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-zinc-900 border border-zinc-600 flex items-center justify-center"
            style={{ left: `calc(${capPct}% - 10px)` }}
            aria-hidden
          >
            <Lock size={10} className="text-zinc-400" />
          </div>
        )}

        {/* "You are here" marker */}
        {currentPct != null && Math.abs(currentPct - valuePct) > 1 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-white/80 shadow"
            style={{ left: `calc(${currentPct}% - 1.5px)` }}
            aria-hidden
            title={currentLabel}
          />
        )}

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white border-2 flex items-center justify-center shadow-lg transition-[border-color,box-shadow] duration-150"
          style={{
            left: `calc(${valuePct}% - 12px)`,
            borderColor: bandColor(value),
            boxShadow: `0 0 0 6px ${bandGlow(value)}`,
          }}
        />
      </div>

      {/* Band icons under the track — full text label is shown above the thumb */}
      <div className="relative h-5 mt-1.5">
        {DIFFICULTY_BANDS.map((b) => {
          const start = clampPct(pct(Math.max(b.min, min)));
          const end = clampPct(pct(Math.min(b.max, max)));
          const mid = (start + end) / 2;
          if (end <= start + 1) return null;
          const Icon = BAND_ICONS[b.key];
          const active = value >= b.min && value < b.max;
          return (
            <div
              key={b.key}
              className="absolute -translate-x-1/2 transition-opacity"
              style={{ left: `${mid}%`, color: b.color, opacity: active ? 1 : 0.55 }}
              title={labels[b.key]}
              aria-label={labels[b.key]}
            >
              <Icon size={14} strokeWidth={active ? 2.4 : 1.8} />
            </div>
          );
        })}
      </div>

      {/* Numeric anchors */}
      <div className="relative h-4 mt-1">
        {[min, cap].map((t, i) => (
          <div
            key={`${t}-${i}`}
            className="absolute -translate-x-1/2 text-[10px] text-zinc-500 tabular-nums"
            style={{ left: `${clampPct(pct(t))}%` }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function clampPct(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

function bandColor(rating: number) {
  for (const b of DIFFICULTY_BANDS) if (rating >= b.min && rating < b.max) return b.color;
  return DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1].color;
}

function bandGlow(rating: number) {
  for (const b of DIFFICULTY_BANDS) if (rating >= b.min && rating < b.max) return b.glow;
  return DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1].glow;
}

function buildGradient(min: number, max: number): string {
  const stops: string[] = [];
  for (const b of DIFFICULTY_BANDS) {
    const s = Math.max(0, ((b.min - min) / (max - min)) * 100);
    const e = Math.min(100, ((b.max - min) / (max - min)) * 100);
    if (e <= 0 || s >= 100) continue;
    stops.push(`${b.color} ${s}%`, `${b.color} ${e}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
