'use client';

import { Flame } from 'lucide-react';
import { cn, StreakState } from '@/lib/utils';

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
  /**
   * Visual state. 'secured' = today is locked in, 'at_risk' = last
   * play was yesterday and the streak will break unless they play
   * before midnight, 'broken' = already broken (caller should
   * usually not render in this case but the badge still reads
   * correctly if shown).
   */
  state?: StreakState;
  size?: 'sm' | 'md';
  className?: string;
};

const STATE_TINT: Record<StreakState, string> = {
  secured: 'text-amber-300',
  at_risk: 'text-amber-300 streak-pulse',
  broken: 'text-zinc-500',
  none: 'text-amber-300',
};

/**
 * Compact daily-streak indicator. Shared across the dashboard,
 * leaderboard rows, and public profile so the visual stays
 * consistent everywhere the player sees the streak. Pure
 * presentational — caller decides whether to show it (i.e.
 * checks settings.showStreak first).
 */
export function StreakBadge({ days, state = 'secured', size = 'md', className }: Props) {
  if (days <= 0) return null;
  const small = size === 'sm';
  const ariaState =
    state === 'at_risk' ? ' (play today to keep it)' :
    state === 'broken'  ? ' (broken)' :
    '';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 tabular-nums font-semibold',
        STATE_TINT[state],
        small ? 'text-xs' : 'text-sm',
        className,
      )}
      aria-label={`${days}-day streak${ariaState}`}
    >
      <Flame size={small ? 12 : 14} className="shrink-0" />
      {days}
    </div>
  );
}
