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
import { useAppStore } from '@/lib/store';
import { TRAINING_STYLES, TrainingStyle } from '@/lib/levels';
import { cn } from '@/lib/utils';

type Row = {
  rank: number;
  rating: number;
  unlocked: number;
  isSelf: boolean;
  streakDays: number;
  user: { id: string; nickname: string; displayName: string | null; avatarUrl: string | null; country: string | null };
};

export default function LeaderboardPage() {
  const [style, setStyle] = useState<TrainingStyle>('blitz');
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const showStreak = useAppStore((s) => s.settings.showStreak);
  const t = useT();

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', style, scope],
    queryFn: () => http.get<Row[]>(`/leaderboard?style=${style}&scope=${scope}&limit=100`),
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
        <Trophy size={22} className="text-[var(--accent)]" />
        {t('leaderboard.title')}
      </h1>

      <Segmented
        value={style}
        onChange={(v) => setStyle(v as TrainingStyle)}
        options={TRAINING_STYLES.map((s) => ({ value: s, label: t(`style.${s}.name`) }))}
      />

      <div className="flex bg-black/30 rounded-xl p-1 gap-1 w-fit">
        {([
          { k: 'global',  Icon: Globe2, label: t('leaderboard.scope_global') },
          { k: 'friends', Icon: Users2, label: t('leaderboard.scope_friends') },
        ] as const).map(({ k, Icon, label }) => (
          <button
            key={k}
            onClick={() => setScope(k)}
            className={cn(
              'h-9 px-3 rounded-lg text-xs flex items-center gap-1.5 transition-colors',
              scope === k ? 'bg-[var(--bg-softer)] text-white' : 'text-zinc-400 hover:text-white',
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
        <div className="space-y-1.5">
          {data.map((r) => <Row key={r.user.id} row={r} style={style} showStreak={showStreak} />)}
        </div>
      )}
    </div>
  );
}

function Row({ row, style, showStreak }: { row: Row; style: TrainingStyle; showStreak: boolean }) {
  const medal = row.rank <= 3
    ? ['text-yellow-400', 'text-zinc-300', 'text-amber-600'][row.rank - 1]
    : null;

  return (
    <Link
      href={`/profile/${row.user.nickname}`}
      className={cn(
        'glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/[0.06] transition-colors',
        row.isSelf && 'ring-1 ring-[var(--accent)]/50 bg-[var(--accent)]/[0.08]',
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
        <div className="text-sm truncate">
          {row.user.displayName || row.user.nickname}
          {row.user.displayName && <span className="text-zinc-500 ml-1.5">@{row.user.nickname}</span>}
        </div>
        {row.user.country && <div className="text-[10px] uppercase text-zinc-500">{row.user.country}</div>}
      </div>
      {showStreak && row.streakDays > 0 && (
        <StreakBadge days={row.streakDays} size="sm" />
      )}
      <div className="flex items-center gap-1.5">
        <StyleIcon style={style} size={12} />
        <span className="text-base font-semibold tabular-nums">{row.rating}</span>
      </div>
    </Link>
  );
}
