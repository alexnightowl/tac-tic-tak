'use client';
import { cn } from '@/lib/utils';

type Option<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
  size?: 'sm' | 'md';
};

export function Segmented<T extends string | number>({ value, onChange, options, className, size = 'md' }: Props<T>) {
  return (
    <div className={cn('inline-flex w-full rounded-xl bg-white/5 p-1 border border-[var(--border-soft)]', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-lg transition-all duration-200',
              size === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm',
              active
                ? 'bg-[var(--accent)] text-black font-medium shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-white/5',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
