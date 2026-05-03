'use client';

import { Lock } from 'lucide-react';
import { ACHIEVEMENT_ICON_MAP } from './icons';
import { cn } from '@/lib/utils';

export type Achievement = {
  slug: string;
  category: 'customize' | 'play' | 'skill' | 'streak' | 'social';
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

type Props = {
  achievement: Achievement;
  name: string;
  description: string;
  language?: 'en' | 'uk';
};

/**
 * Tile rendered on the achievements grid. Two visual states:
 *
 *   - Unlocked: amber gradient icon-chip, full title + description,
 *     unlock date in the footer.
 *   - Locked: greyed-out chip with a Lock icon, title shown but
 *     dimmed, description shown in muted text so the player knows
 *     what to chase.
 */
export function AchievementCard({ achievement, name, description, language = 'en' }: Props) {
  const Icon = ACHIEVEMENT_ICON_MAP[achievement.slug];
  const unlocked = achievement.unlocked;
  return (
    <div
      className={cn(
        'rounded-2xl p-3 border flex items-start gap-3 transition-colors',
        unlocked
          ? 'border-amber-300/30 bg-gradient-to-br from-amber-300/[0.06] to-transparent'
          : 'border-[var(--border-soft)] bg-black/20',
      )}
    >
      <div
        className={cn(
          'h-12 w-12 rounded-xl shrink-0 flex items-center justify-center border',
          unlocked
            ? 'border-amber-300/40'
            : 'border-white/5 bg-white/[0.02]',
        )}
        style={
          unlocked
            ? { background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 60%, #d97706 100%)' }
            : undefined
        }
      >
        {unlocked && Icon ? (
          <Icon size={22} className="text-amber-950" />
        ) : (
          <Lock size={18} className="text-zinc-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm font-semibold truncate',
            unlocked ? 'text-white' : 'text-zinc-400',
          )}
        >
          {name}
        </div>
        <div className={cn('text-xs mt-0.5 leading-snug', unlocked ? 'text-zinc-300' : 'text-zinc-500')}>
          {description}
        </div>
        {unlocked && achievement.unlockedAt && (
          <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mt-1.5">
            {formatDate(achievement.unlockedAt, language)}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string, language: 'en' | 'uk'): string {
  try {
    return new Date(iso).toLocaleDateString(
      language === 'uk' ? 'uk-UA' : 'en-US',
      { day: 'numeric', month: 'short', year: 'numeric' },
    );
  } catch {
    return iso;
  }
}
