'use client';
import { pieceUrl, normalizePieceSet } from '@/lib/pieces';
import { useAppStore } from '@/lib/store';

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
  /** Replaces the turn-derived text (puzzle viewer: solution mode / solved). */
  override?: { title: string; subtitle?: string | null };
};

/**
 * Whose-turn-is-it pill. Shared between the play runner and the
 * review runners so the player always knows which side they're
 * solving for. The review pages don't show streaks, so streak /
 * streakBroken are optional.
 */
export function TurnCard({
  orientation, isPlayerTurn, loading = false, opponentBusy = false,
  streak, streakBroken = null, override,
}: Props) {
  const pieceSet = normalizePieceSet(useAppStore((st) => st.settings.pieceSet));
  const t = useT();
  const isWhite = orientation === 'white';
  const showStreak = streak != null && streak >= 2;
  const showBroken = streakBroken !== null;

  let title: string;
  let subtitle: string | null;
  if (override) {
    title = override.title;
    subtitle = override.subtitle ?? null;
  } else if (loading) {
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
          'h-11 w-11 rounded-full flex items-center justify-center shrink-0',
          isWhite ? 'sq-marble' : 'sq-slate',
        )}
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,254,0.18), inset 0 -2px 4px rgba(17,15,17,0.45), 0 0 0 1px rgba(17,15,17,0.6)' }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pieceUrl(pieceSet, isWhite ? 'w' : 'b', 'k')} alt="" className="h-9 w-9" draggable={false} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-serif text-[15px] font-bold tracking-[0.03em] leading-tight truncate">{title}</div>
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
              ? 'bg-[rgba(166,66,65,0.15)] text-eos-rose line-through opacity-100'
              : 'bg-[rgba(166,66,65,0.16)] text-[#d8847c] opacity-100',
          )}
          aria-hidden
        >
          🔥 {showBroken ? streakBroken : streak}
        </div>
      )}
    </div>
  );
}
