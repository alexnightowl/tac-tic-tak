'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  days: number;
  /**
   * Kept on the type so existing call sites compile, but ignored
   * — the freeze indicator was visually noisy next to the flame
   * (read as "active or frozen?") so the badge now shows just
   * the count. Freeze state surfaces elsewhere (in-toast on
   * auto-apply, achievements page).
   */
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
export function StreakBadge({ days, size = 'md', className }: Props) {
  if (days <= 0) return null;
  const small = size === 'sm';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 tabular-nums font-semibold text-amber-300',
        small ? 'text-xs' : 'text-sm',
        className,
      )}
      aria-label={`${days}-day streak`}
    >
      <Flame size={small ? 12 : 14} className="shrink-0" />
      {days}
    </div>
  );
}
