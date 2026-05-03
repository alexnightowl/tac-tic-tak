'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Swords, Zap, Timer, Hourglass } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { SessionList, SessionRow } from '@/components/SessionList';
import { StreakBadge } from '@/components/StreakBadge';
import { TrainingStyle, TRAINING_STYLES } from '@/lib/levels';

type Overview = {
  recentSessions: SessionRow[];
  allTimePeak: number;
};

const STYLE_ICONS = {
  bullet: Zap,
  blitz: Timer,
  rapid: Hourglass,
} as const;

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);
  const progressions = useAppStore((s) => s.progressions);
  const language = useAppStore((s) => s.settings.language);
  const showStreak = useAppStore((s) => s.settings.showStreak);
  const streak = useAppStore((s) => s.streak);
  const t = useT();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['overview'],
    queryFn: () => http.get<Overview>('/analytics'),
    enabled: !!user,
  });

  async function onDelete(id: string) {
    await http.del(`/sessions/${id}`).catch(() => {});
    qc.invalidateQueries({ queryKey: ['overview'] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
    qc.invalidateQueries({ queryKey: ['analytics-themes'] });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] md:text-3xl font-semibold tracking-tight">
              {t('dashboard.welcome')}, {user?.nickname}
            </h1>
            <p className="text-zinc-400 text-sm mt-1">{t('dashboard.ready')}</p>
          </div>
          {showStreak && streak.days > 0 && (
            <StreakBadge
              days={streak.days}
              freezeAvailable={streak.freezes > 0}
              className="mt-1.5 shrink-0"
            />
          )}
        </div>
        <Link href="/play" className="block">
          <Button size="lg" className="w-full md:w-auto md:min-w-[220px]">
            <Swords size={18} /> {t('dashboard.start')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-3 gap-3">
        {TRAINING_STYLES.map((s) => (
          <StyleRatingCard key={s} style={s} t={t} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>{t('dashboard.peak')}</CardTitle>
          <CardValue>{data?.allTimePeak ?? '—'}</CardValue>
        </Card>
        <Card>
          <CardTitle>{t('dashboard.sessions')}</CardTitle>
          <CardValue>{data?.recentSessions.length ?? 0}</CardValue>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-2">{t('dashboard.recent')}</h2>
        <SessionList
          sessions={data?.recentSessions ?? []}
          onDelete={onDelete}
          language={language}
          emptyLabel={t('dashboard.empty')}
        />
      </div>
    </div>
  );
}

function StyleRatingCard({ style, t }: { style: TrainingStyle; t: (k: string) => string }) {
  const prog = useAppStore((s) => s.progressions[style]);
  const Icon = STYLE_ICONS[style];
  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400">
          {t(`style.${style}.name`)}
        </span>
        <Icon size={14} className="text-[var(--accent)]" />
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-none">
        {prog.currentPuzzleRating}
      </div>
      <div className="text-[10px] text-zinc-500 mt-1 tabular-nums">
        {t('play.unlocked')} {prog.unlockedStartRating}
      </div>
    </Card>
  );
}
