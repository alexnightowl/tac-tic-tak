'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'glass';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-black hover:brightness-110 font-semibold shadow-[0_8px_30px_-10px_var(--accent-soft)]',
  ghost: 'bg-transparent text-zinc-200 hover:bg-white/5',
  outline: 'border border-[var(--border-strong)] text-zinc-100 hover:bg-white/5',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
  glass: 'glass text-white hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-lg',
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-13 px-6 text-base rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
        variants[variant],
        sizes[size],
        size === 'lg' && 'h-14',
        className,
      )}
      {...rest}
    />
  );
});
