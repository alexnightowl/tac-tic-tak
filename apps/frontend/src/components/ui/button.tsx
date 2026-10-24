'use client';
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'glass';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

/**
 * Ember on stone buttons.
 *  - primary   → red clay plate (`.btn-ember`)
 *  - secondary / outline / glass → slate plate (`.btn-slate`)
 *  - ghost     → bare text button
 *  - danger    → rose outline
 * Plates are 9-slice border-images, so the border width has to track
 * the button height or the bevel stretches (see PLATE_BORDER).
 */
const PLATE_BORDER: Record<Size, string> = {
  sm: '10px 11px',
  md: '12px 13px',
  lg: '14px 15px',
};

const heights: Record<Size, string> = {
  sm: 'h-9 text-[13px]',
  md: 'h-11 text-sm',
  lg: 'h-[52px] text-[15px]',
};

const plate = (v: Variant) =>
  v === 'primary' ? 'btn-ember' : v === 'secondary' || v === 'outline' || v === 'glass' ? 'btn-slate' : null;

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className, style, ...rest }, ref,
) {
  const plateClass = plate(variant);
  const plateStyle: CSSProperties | undefined = plateClass ? { borderWidth: PLATE_BORDER[size], ...style } : style;
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none',
        plateClass && 'box-border px-1.5 font-serif font-bold uppercase tracking-[0.1em]',
        !plateClass && 'rounded-control px-4 font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'ghost' && 'bg-transparent text-eos-bone hover:bg-white/5',
        variant === 'danger' && 'border border-[rgba(176,58,58,0.7)] text-[#d8706a] hover:bg-[rgba(176,58,58,0.1)]',
        plateClass,
        heights[size],
        className,
      )}
      style={plateStyle}
      {...rest}
    />
  );
});
