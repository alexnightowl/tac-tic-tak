'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { SessionList, SessionRow } from '@/components/SessionList';

type Overview = {
  recentSessions: SessionRow[];
  allTimePeak: number;
};

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);
  const progression = useAppStore((s) => s.progression);
  const language = useAppStore((s) => s.settings.language);
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
        <div>
          <h1 className="text-[26px] md:text-3xl font-semibold tracking-tight">
            {t('dashboard.welcome')}, {user?.nickname}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{t('dashboard.ready')}</p>
        </div>
        <Link href="/play" className="block">
          <Button size="lg" className="w-full md:w-auto md:min-w-[220px]">
            <Swords size={18} /> {t('dashboard.start')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardTitle>{t('dashboard.current_rating')}</CardTitle>
          <CardValue>{progression?.currentPuzzleRating ?? '—'}</CardValue>
        </Card>
        <Card>
          <CardTitle>{t('dashboard.unlocked_start')}</CardTitle>
          <CardValue>{progression?.unlockedStartRating ?? '—'}</CardValue>
        </Card>
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
