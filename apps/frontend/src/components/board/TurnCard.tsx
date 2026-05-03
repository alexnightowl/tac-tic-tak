'use client';

import { Crown } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
  orientation: 'white' | 'black';
  isPlayerTurn: boolean;
  loading?: boolean;
  opponentBusy?: boolean;
  /** Streak chip — only the play runner uses it; review pages omit. */
  streak?: number;
  streakBroken?: number | null;
};

/**
 * Whose-turn-is-it pill. Shared between the play runner and the
 * review runners so the player always knows which side they're
 * solving for. The review pages don't show streaks, so streak /
 * streakBroken are optional.
 */
export function TurnCard({
  orientation, isPlayerTurn, loading = false, opponentBusy = false,
  streak, streakBroken = null,
}: Props) {
  const t = useT();
  const isWhite = orientation === 'white';
  const showStreak = streak != null && streak >= 2;
  const showBroken = streakBroken !== null;

  let title: string;
  let subtitle: string | null;
  if (loading) {
    title = t('play.loading_puzzle');
    subtitle = null;
  } else if (opponentBusy || !isPlayerTurn) {
    title = t('play.opponent_moving');
    subtitle = null;
  } else {
    title = t('play.your_turn');
    subtitle = isWhite ? t('play.find_best_white') : t('play.find_best_black');
  }

  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
      <div
        className={cn(
          'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border',
          isWhite
            ? 'bg-white text-zinc-900 border-white/70'
            : 'bg-zinc-900 text-zinc-100 border-zinc-700',
        )}
        aria-hidden
      >
        <Crown size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-tight truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-zinc-400 mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
      {(showStreak || showBroken) && (
        <div
          key={showBroken ? `broken-${streakBroken}` : `alive-${streak}`}
          className={cn(
            'text-[12px] font-semibold px-2 py-1 rounded-full whitespace-nowrap shrink-0 tabular-nums transition-opacity duration-500',
            showBroken
              ? 'bg-rose-500/15 text-rose-300 line-through opacity-100'
              : 'bg-amber-500/15 text-amber-300 opacity-100',
          )}
          aria-hidden
        >
          🔥 {showBroken ? streakBroken : streak}
        </div>
      )}
    </div>
  );
}
