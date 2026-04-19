'use client';
import { useMemo } from 'react';

type Props = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  ticks?: number[];
  formatTick?: (v: number) => string;
  'aria-label'?: string;
};

export function Slider({ min, max, step = 1, value, onChange, ticks, formatTick, ...rest }: Props) {
  const pct = useMemo(() => ((value - min) / (max - min)) * 100, [value, min, max]);
  return (
    <div className="relative w-full">
      <input
        type="range"
        className="ticks w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as any]: `${pct}%` }}
        aria-label={rest['aria-label']}
      />
      {ticks && ticks.length > 0 && (
        <div className="relative mt-2 h-5 px-[10px]">
          {ticks.map((t) => {
            const p = ((t - min) / (max - min)) * 100;
            return (
              <div key={t} className="absolute -translate-x-1/2 text-[10px] text-zinc-500 tabular-nums" style={{ left: `${p}%` }}>
                {formatTick ? formatTick(t) : t}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
