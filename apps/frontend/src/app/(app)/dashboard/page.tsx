'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { SessionList, SessionRow } from '@/components/SessionList';
import { StreakBadge } from '@/components/StreakBadge';
import { StyleIcon } from '@/components/StyleIcon';
import { UserBadges } from '@/components/UserBadges';
import { TrainingStyle, TRAINING_STYLES } from '@/lib/levels';
import { streakState } from '@/lib/utils';

type Overview = {
  recentSessions: SessionRow[];
  allTimePeak: number;
};

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
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-eos-ash">{t('dashboard.welcome')}</div>
            <h1 className="mt-1.5 text-[26px] leading-8 md:text-3xl text-eos-bone">
              {user?.nickname}
              {user?.verified && (
                <UserBadges
                  verified
                  size={20}
                  className="inline-block ml-1.5 align-middle relative -top-[2px]"
                />
              )}
            </h1>

          </div>
          {showStreak && streak.days > 0 && (() => {
            const st = streakState(streak.days, streak.lastDay);
            // 'broken' = already lost (we still show the count for
            // honesty rather than silently disappearing the badge).
            return (
              <div className="flex flex-col items-end gap-0.5 mt-1.5 shrink-0">
                <StreakBadge
                  days={streak.days}
                  state={st}
                  freezeAvailable={streak.freezes > 0}
                />
                {st === 'at_risk' && (
                  <span className="text-[10px] text-[#d7b777]/80">{t('streak.at_risk')}</span>
                )}
                {st === 'secured' && (
                  <span className="text-[10px] text-zinc-500">{t('streak.secured')}</span>
                )}
              </div>
            );
          })()}
        </div>
        <Card hero>
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-eos-ash">{t('dashboard.ready')}</div>
          <Link href="/play" className="mt-4 block">
            <Button size="lg" className="w-full md:w-auto md:min-w-[260px]">
              <Play size={18} /> {t('dashboard.start')}
            </Button>
          </Link>
        </Card>
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
        <h2 className="text-base mb-2.5 text-eos-bone">{t('dashboard.recent')}</h2>
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
  return (
    <Card className="!p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <StyleIcon style={style} size={15} />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-eos-ash truncate">
          {t(`style.${style}.name`)}
        </span>
      </div>
      <div className="text-2xl font-extrabold tabular-nums leading-none">
        {prog.currentPuzzleRating}
      </div>
      <div className="text-[11px] font-bold text-eos-dust mt-1.5 tabular-nums">
        {t('play.unlocked')} {prog.unlockedStartRating}
      </div>
    </Card>
  );
}
