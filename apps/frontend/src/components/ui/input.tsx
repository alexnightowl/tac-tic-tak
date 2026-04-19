'use client';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl bg-white/5 border border-[var(--border)] px-3.5 text-sm text-white placeholder:text-zinc-500',
          'focus:outline-none focus:border-[var(--accent)] focus:bg-white/[0.07]',
          'transition-colors',
          className,
        )}
        {...rest}
      />
    );
  },
);
