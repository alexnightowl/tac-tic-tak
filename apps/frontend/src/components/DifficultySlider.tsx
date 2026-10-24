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
  /**
   * Start of the level-up zone (norm − 50). Below it is the comfort zone:
   * the session can't move the norm. When set, the track is split by
   * colour and the thumb snaps to the zone checkpoints.
   */
  levelUpFrom?: number;
  /** The player's norm (unlocked ceiling) — a checkpoint inside the zone. */
  norm?: number;
};

/** Pointer within this many px of a checkpoint snaps onto it. */
const SNAP_PX = 14;

export function DifficultySlider({
  value, onChange, min = 400, max = 3000, cap, step = 25,
  labels, currentRating, thumbLabel, currentLabel, ariaLabel,
  levelUpFrom, norm,
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
  const zones = levelUpFrom != null && levelUpFrom < cap;
  const zonePct = zones ? clampPct(pct(Math.max(min, levelUpFrom!))) : null;
  const inLevelUp = zones ? value >= levelUpFrom! : true;
  const checkpoints = useMemo(
    () => (zones
      ? Array.from(new Set([Math.max(min, levelUpFrom!), norm, cap].filter((v): v is number => v != null && v >= min && v <= cap)))
      : []),
    [zones, min, levelUpFrom, norm, cap],
  );

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    // Magnet: close enough to a zone checkpoint → land exactly on it.
    for (const c of checkpoints) {
      const cx = (valueToPct(c, edges) / 100) * rect.width;
      if (Math.abs(cx - ratio * rect.width) <= SNAP_PX) { if (c !== value) onChange(c); return; }
    }
    const raw = pctToValue(ratio * 100, edges);
    const snapped = Math.round(raw / step) * step;
    const capped = Math.min(cap, Math.max(min, snapped));
    if (capped !== value) onChange(capped);
  }, [cap, step, min, onChange, edges, checkpoints, value]);

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
    if (e.key === 'PageUp')   { const n = checkpoints.find((c) => c > value); if (n != null) onChange(n); e.preventDefault(); }
    if (e.key === 'PageDown') { const n = [...checkpoints].reverse().find((c) => c < value); if (n != null) onChange(n); e.preventDefault(); }
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
          style={{ boxShadow: 'inset 0 1px 2px rgba(17,15,17,0.7)' }}
        />
        {/* Level-up zone: gold band from norm−50 to the cap */}
        {zonePct != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
            style={{
              left: `${zonePct}%`,
              width: `${Math.max(0, capPct - zonePct)}%`,
              background: 'rgba(215,183,119,0.28)',
              boxShadow: '0 0 0 1px rgba(215,183,119,0.35)',
            }}
          />
        )}
        {/* Fill: muted in the comfort zone, ember once it reaches the level-up zone */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{
            width: `${valuePct}%`,
            background: inLevelUp ? 'linear-gradient(90deg, #753132, #a64241)' : 'linear-gradient(90deg, #4a4549, #6f6a6e)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,254,0.15)',
          }}
        />
        {/* Checkpoint ticks (the magnets) */}
        {checkpoints.filter((c) => c !== cap && c !== norm).map((c) => (
          <div
            key={c}
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-[3px] rounded-full"
            style={{ left: `calc(${clampPct(pct(c))}% - 1.5px)`, background: '#d7b777', boxShadow: '0 0 0 1px rgba(17,15,17,0.6)' }}
            aria-hidden
          />
        ))}

        {/* Locked region overlay (beyond cap) */}
        {capPct < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-2 rounded-r-full"
            style={{
              left: `${capPct}%`,
              right: 0,
              background: 'repeating-linear-gradient(45deg, rgba(17,15,17,0.55) 0 4px, rgba(17,15,17,0.25) 4px 8px)',
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
            background: 'radial-gradient(circle at 40% 32%, #f5eee5, #cbc5bf 60%, #938e90)',
            boxShadow: inLevelUp
              ? '0 0 0 4px rgba(166,66,65,0.3), 0 2px 6px rgba(17,15,17,0.6)'
              : '0 0 0 4px rgba(161,157,163,0.2), 0 2px 6px rgba(17,15,17,0.6)',
            transition: 'left 90ms ease-out',
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

      {/* Numeric anchors: min, start of the level-up zone (gold), cap */}
      <div className="relative h-4 mt-1">
        {anchorLabels(min, cap, zones ? levelUpFrom! : null, pct).map(({ v, gold }, i) => (
          <div
            key={`${v}-${i}`}
            className={cn('absolute text-[10px] font-bold tabular-nums', gold ? 'text-[#d7b777]' : 'text-eos-dust')}
            style={{ left: `${clampPct(pct(v))}%`, transform: `translateX(-${clampPct(pct(v))}%)` }}
          >
            {v}
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

/** min · zone start · cap, dropping the zone label when it would collide. */
function anchorLabels(min: number, cap: number, zoneFrom: number | null, pct: (v: number) => number) {
  const out: { v: number; gold: boolean }[] = [{ v: min, gold: false }];
  if (zoneFrom != null && zoneFrom > min) {
    const zp = pct(zoneFrom);
    if (zp - pct(min) > 9 && pct(cap) - zp > 9) out.push({ v: zoneFrom, gold: true });
  }
  out.push({ v: cap, gold: false });
  return out;
}
