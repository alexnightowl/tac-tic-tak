'use client';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
};

export function Select({ value, onChange, options, placeholder, className }: Props) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-11 w-full appearance-none rounded-xl bg-white/5 border border-[var(--border)] pl-3 pr-9 text-sm text-white',
          'focus:outline-none focus:border-[var(--accent)]',
        )}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--bg-card-solid)] text-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
    </div>
  );
}
