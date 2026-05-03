'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  days: number;
  /** When provided, the snowflake hint shows that the user has a
   *  freeze in pocket (1 free missed day). Pass `undefined` to
   *  hide the hint — useful on dense rows like the leaderboard. */
  freezeAvailable?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Compact daily-streak indicator. Shared across the dashboard,
 * leaderboard rows, and public profile so the visual stays
 * consistent everywhere the player sees the streak. Pure
 * presentational — caller decides whether to show it (i.e.
 * checks settings.showStreak first).
 */
export function StreakBadge({ days, freezeAvailable, size = 'md', className }: Props) {
  if (days <= 0) return null;
  const small = size === 'sm';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 tabular-nums font-semibold',
        small ? 'text-xs' : 'text-sm',
        // Amber-orange for the flame, fades a touch when there's
        // a freeze available so the snowflake reads as "safe".
        'text-amber-300',
        className,
      )}
      aria-label={`${days}-day streak`}
    >
      <Flame size={small ? 12 : 14} className="shrink-0" />
      {days}
      {freezeAvailable && (
        <span
          className={cn('text-cyan-300/80 leading-none', small ? 'text-[10px]' : 'text-[11px]')}
          aria-hidden
          title="Freeze available — one missed day won't break the streak"
        >
          ❄
        </span>
      )}
    </div>
  );
}
