'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users2, Globe2, Trophy, Medal } from 'lucide-react';
import { http } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { StreakBadge } from '@/components/StreakBadge';
import { StyleIcon } from '@/components/StyleIcon';
import { UserBadges } from '@/components/UserBadges';
import { useAppStore } from '@/lib/store';
import { TRAINING_STYLES, TrainingStyle } from '@/lib/levels';
import { cn, streakState } from '@/lib/utils';

type Row = {
  rank: number;
  rating: number;
  unlocked: number;
  isSelf: boolean;
  streakDays: number;
  streakLastDay: string | null;
  user: { id: string; nickname: string; displayName: string | null; avatarUrl: string | null; country: string | null; verified?: boolean };
};

export default function LeaderboardPage() {
  const [style, setStyle] = useState<TrainingStyle>('blitz');
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const showStreak = useAppStore((s) => s.settings.showStreak);
  const t = useT();

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['leaderboard', style, scope],
    queryFn: () => http.get<Row[]>(`/leaderboard?style=${style}&scope=${scope}&limit=100`),
  });

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-[22px] text-eos-bone flex items-center gap-2">
        <Trophy size={20} className="text-eos-ember" />
        {t('leaderboard.title')}
      </h1>

      <Segmented
        value={style}
        onChange={(v) => setStyle(v as TrainingStyle)}
        options={TRAINING_STYLES.map((s) => ({ value: s, label: t(`style.${s}.name`), icon: <StyleIcon style={s} size={18} /> }))}
      />

      <div className="eos-well flex rounded-lg p-1 gap-1 w-fit">
        {([
          { k: 'global',  Icon: Globe2, label: t('leaderboard.scope_global') },
          { k: 'friends', Icon: Users2, label: t('leaderboard.scope_friends') },
        ] as const).map(({ k, Icon, label }) => (
          <button
            key={k}
            onClick={() => setScope(k)}
            className={cn(
              'h-8 px-3 rounded-control text-xs font-bold flex items-center gap-1.5 transition-colors',
              scope === k ? 'bg-eos-rise text-eos-bone shadow-[inset_0_1px_0_rgba(255,255,254,0.06)]' : 'text-eos-ash hover:text-eos-bone',
            )}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-sm text-zinc-500">Loading…</div>}

      {!isLoading && data && data.length === 0 && (
        <Card className="text-center text-sm text-zinc-500">
          {scope === 'friends' ? t('leaderboard.empty_friends') : t('leaderboard.empty')}
        </Card>
      )}

      {data && data.length > 0 && (
        <div className={cn('space-y-1.5 transition-opacity duration-150', isPlaceholderData && 'opacity-60')}>
          {data.map((r) => <Row key={r.user.id} row={r} style={style} showStreak={showStreak} />)}
        </div>
      )}
    </div>
  );
}

function Row({ row, style, showStreak }: { row: Row; style: TrainingStyle; showStreak: boolean }) {
  const medal = row.rank <= 3
    ? ['text-[#d7b777]', 'text-[#cbc5bf]', 'text-[#ad7f5c]'][row.rank - 1]
    : null;

  return (
    <Link
      href={`/profile/${row.user.nickname}`}
      className={cn(
        'glass rounded-[10px] p-3 flex items-center gap-3 hover:brightness-110 transition-[filter]',
        row.isSelf && 'shadow-[inset_0_0_0_1px_rgba(166,66,65,0.55)] !bg-[#2e262c]',
      )}
    >
      <div className="w-8 flex items-center justify-center">
        {medal ? (
          <Medal size={18} className={medal} />
        ) : (
          <span className="text-sm tabular-nums text-zinc-500">{row.rank}</span>
        )}
      </div>
      <Avatar nickname={row.user.nickname} avatarUrl={row.user.avatarUrl} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate flex items-center gap-1.5">
          <span className="truncate">
            {row.user.displayName || row.user.nickname}
            {row.user.displayName && <span className="text-zinc-500 ml-1.5">@{row.user.nickname}</span>}
          </span>
          <UserBadges verified={row.user.verified} size={13} />
        </div>
        {row.user.country && <div className="text-[10px] uppercase text-zinc-500">{row.user.country}</div>}
      </div>
      {showStreak && (() => {
        const st = streakState(row.streakDays, row.streakLastDay);
        return st === 'secured' || st === 'at_risk';
      })() && (
        <StreakBadge days={row.streakDays} size="sm" />
      )}
      <div className="flex items-center gap-1.5">
        <StyleIcon style={style} size={16} />
        <span className="text-base font-extrabold tabular-nums">{row.rating}</span>
      </div>
    </Link>
  );
}
