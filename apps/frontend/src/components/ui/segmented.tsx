'use client';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Option<T extends string | number> = { value: T; label: ReactNode; icon?: ReactNode };

type Props<T extends string | number> = {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
  size?: 'sm' | 'md';
};

/** Carved well with a raised ember tab for the active option. */
export function Segmented<T extends string | number>({ value, onChange, options, className, size = 'md' }: Props<T>) {
  return (
    <div role="tablist" className={cn('eos-well flex w-full rounded-lg p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              // No background transition: the active plate swaps in the same frame,
              // so fast switching never shows two half-lit tabs.
              'flex-1 inline-flex items-center justify-center gap-1.5 rounded-control font-bold',
              size === 'sm' ? 'h-8 text-xs' : 'h-[38px] text-sm',
              active
                ? 'bg-eos-ember text-[#f5eee5] shadow-[inset_0_1px_0_rgba(255,255,254,0.18),inset_0_-2px_0_rgba(17,15,17,0.25)]'
                : 'text-eos-ash hover:text-eos-bone',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
