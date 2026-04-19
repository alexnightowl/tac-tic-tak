'use client';

import { cn } from '@/lib/utils';

type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

/**
 * Brand mark: tic-tac-toe grid with a chess knight silhouette at the centre.
 * The accent colour comes from the CSS var `--accent`.
 */
export function Logo({ size = 36, withWordmark = false, className }: Props) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="tac-tic-tak">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {/* tic-tac-toe grid lines */}
        <g stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.9">
          <line x1="16" y1="4" x2="16" y2="44" />
          <line x1="32" y1="4" x2="32" y2="44" />
          <line x1="4" y1="16" x2="44" y2="16" />
          <line x1="4" y1="32" x2="44" y2="32" />
        </g>
        {/* knight silhouette, centred in the middle cell */}
        <path
          d="M24 13.5c-2.3 0-4.3 1.1-5.4 2.6-.5.7-1 1.5-1.5 2.3-.4.7-.9 1.3-1.6 1.6-.6.3-.9.9-.7 1.6.1.5.5.9 1 1l1.3.2-.2 1.2c-.1.6.1 1.2.6 1.5l2.2 1.4V32c0 .6.4 1 1 1h8c.6 0 1-.4 1-1v-7.6c0-.7-.2-1.4-.5-2-1.1-2-2.3-5.7-2.3-7.4 0-.8-.7-1.5-1.9-1.5z"
          fill="url(#logoGrad)"
        />
        <circle cx="21" cy="18" r="0.9" fill="#0b0d10" />
      </svg>
      {withWordmark && (
        <span className="text-[15px] font-semibold tracking-tight">
          tac<span className="text-[var(--accent)]">·</span>tic<span className="text-[var(--accent)]">·</span>tak
        </span>
      )}
    </div>
  );
}
