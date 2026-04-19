'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const PRESETS = [
  '#22c55e', '#10b981', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6',
  '#a78bfa', '#ec4899', '#f43f5e',
  '#ef4444', '#f59e0b', '#eab308',
  '#84cc16', '#06b6d4', '#f97316',
];

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

export function ColorPicker({ value, onChange }: Props) {
  const [custom, setCustom] = useState(!PRESETS.includes(value));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((c) => (
          <button
            key={c}
            aria-label={`Pick ${c}`}
            onClick={() => { onChange(c); setCustom(false); }}
            className={cn(
              'h-8 w-8 rounded-full transition-transform duration-150',
              value === c && !custom
                ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-base)] scale-105'
                : 'hover:scale-105',
            )}
            style={{ background: c, boxShadow: `0 4px 12px -4px ${c}` }}
          />
        ))}
        <label
          className={cn(
            'h-8 w-8 rounded-full cursor-pointer relative flex items-center justify-center overflow-hidden',
            custom ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-base)]' : '',
          )}
          style={{
            background: 'conic-gradient(from 180deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a78bfa, #ec4899, #ef4444)',
          }}
          aria-label="Pick custom colour"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => { onChange(e.target.value); setCustom(true); }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
          <span className="text-[10px] font-semibold text-white drop-shadow">+</span>
        </label>
      </div>
      {custom && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="h-4 w-4 rounded-full" style={{ background: value }} />
          <span className="tabular-nums">{value.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}
