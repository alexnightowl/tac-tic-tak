'use client';

import { useCallback, useMemo, useRef } from 'react';
import { Lock } from 'lucide-react';
import { Band, BAND_ICON, DIFFICULTY_BANDS } from '@/lib/levels';
import { cn } from '@/lib/utils';

type Props = {
  value: number;
  onChange: (v: number) => void;
  /** Visual floor of the track (default 400). */
  min?: number;
  /** Visual ceiling of the track (default 3000 — top of the last band). */
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
  value, onChange, min = 400, max = 3000, cap, step = 25,
  labels, currentRating, thumbLabel, currentLabel, ariaLabel,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Piecewise scale: every band gets an equal slice of the track, so the
  // thumb always sits above its eye in the 5-column row below.
  const edges = useMemo(() => bandEdges(min, max), [min, max]);
  const pct = (v: number) => valueToPct(v, edges);
  const valuePct = clampPct(pct(value));
  const capPct = clampPct(pct(cap));
  const currentPct = currentRating != null ? clampPct(pct(currentRating)) : null;

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = pctToValue(ratio * 100, edges);
    const snapped = Math.round(raw / step) * step;
    const capped = Math.min(cap, Math.max(min, snapped));
    onChange(capped);
  }, [cap, step, min, onChange, edges]);

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
        {/* Carved track */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-eos-well"
          style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.7)' }}
        />
        {/* Ember fill */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{ width: `${valuePct}%`, background: 'linear-gradient(90deg, #7a2a2c, #b03a3a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }}
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
            className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-eos-well border border-eos-seam flex items-center justify-center"
            style={{ left: `calc(${capPct}% - 10px)` }}
            aria-hidden
          >
            <Lock size={10} className="text-zinc-400" />
          </div>
        )}

        {/* "You are here" marker */}
        {currentPct != null && Math.abs(currentPct - valuePct) > 1 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-eos-bone/80 shadow"
            style={{ left: `calc(${currentPct}% - 1.5px)` }}
            aria-hidden
            title={currentLabel}
          />
        )}

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full"
          style={{
            left: `calc(${valuePct}% - 12px)`,
            background: 'radial-gradient(circle at 40% 32%, #f3ece4, #c8c2bd 60%, #8f8a8e)',
            boxShadow: '0 0 0 4px rgba(176,58,58,0.25), 0 2px 6px rgba(0,0,0,0.6)',
          }}
        />
      </div>

      {/* Band eyes — five equal columns under the track */}
      <div className="grid grid-cols-5 mt-2">
        {DIFFICULTY_BANDS.map((b) => {
          const active = value >= b.min && value < b.max;
          const locked = b.min > cap;
          return (
            <button
              type="button"
              key={b.key}
              disabled={locked}
              className="justify-self-center grid place-items-center h-8 w-8 rounded-full transition-[opacity,transform] duration-150 disabled:cursor-not-allowed"
              style={{ opacity: active ? 1 : locked ? 0.25 : 0.5, transform: active ? 'scale(1.15)' : undefined }}
              title={labels[b.key]}
              aria-label={labels[b.key]}
              aria-pressed={active}
              onClick={() => onChange(Math.min(cap, Math.max(min, Math.round(((Math.max(b.min, min) + Math.min(b.max, max)) / 2) / step) * step)))}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BAND_ICON[b.key]} alt="" width={24} height={24} className="block h-6 w-6" draggable={false} />
            </button>
          );
        })}
      </div>

      {/* Numeric anchors */}
      <div className="relative h-4 mt-1">
        {[min, cap].map((t, i) => (
          <div
            key={`${t}-${i}`}
            className="absolute text-[10px] font-bold text-eos-dust tabular-nums"
            style={{ left: `${clampPct(pct(t))}%`, transform: `translateX(-${clampPct(pct(t))}%)` }}
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

function bandEdges(min: number, max: number): number[] {
  const inner = DIFFICULTY_BANDS.map((b) => b.min).filter((v) => v > min && v < max);
  return [min, ...inner, max];
}

function valueToPct(v: number, e: number[]): number {
  const n = e.length - 1;
  if (v <= e[0]) return 0;
  if (v >= e[n]) return 100;
  for (let i = 0; i < n; i++) {
    if (v < e[i + 1]) return ((i + (v - e[i]) / (e[i + 1] - e[i])) / n) * 100;
  }
  return 100;
}

function pctToValue(p: number, e: number[]): number {
  const n = e.length - 1;
  const x = (Math.min(100, Math.max(0, p)) / 100) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return e[i] + (x - i) * (e[i + 1] - e[i]);
}
