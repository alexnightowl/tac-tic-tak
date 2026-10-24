'use client';
import { cn } from '@/lib/utils';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function Toggle({ checked, onChange, disabled, className, ...rest }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 rounded-full transition-colors duration-200 ease-out flex-shrink-0',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]',
        checked ? 'bg-eos-ember shadow-[inset_0_1px_0_rgba(255,255,254,0.18)]' : 'eos-well',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-eos-bone shadow-[0_1px_2px_rgba(17,15,17,0.6)] transition-transform duration-200 ease-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
