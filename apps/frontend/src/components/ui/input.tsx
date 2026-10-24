'use client';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Carved input: dark well, inset shadow, ember focus ring. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'eos-well h-12 w-full rounded-control border border-[#2c2a31] px-3.5 text-[15px] font-medium text-eos-bone placeholder:text-eos-dust',
          'focus:outline-none focus:border-eos-ember/70',
          'transition-colors',
          className,
        )}
        {...rest}
      />
    );
  },
);
