'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardValue } from '@/components/ui/card';

type Overview = {
  recentSessions: Array<{ id: string; startedAt: string; solved: number; failed: number; accuracy: number; avgResponseMs: number; peakRating: number }>;
  allTimePeak: number;
};

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);
  const progression = useAppStore((s) => s.progression);
  const t = useT();
  const { data } = useQuery({
    queryKey: ['overview'],
    queryFn: () => http.get<Overview>('/analytics'),
    enabled: !!user,
  });

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
        <div className="grid gap-2">
          {(data?.recentSessions ?? []).map((s) => (
            <Card key={s.id} className="flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">{new Date(s.startedAt).toLocaleString()}</div>
                <div className="text-zinc-400 mt-0.5">
                  {s.solved}✓ · {s.failed}✗ · {(s.accuracy * 100).toFixed(0)}% · peak {s.peakRating}
                </div>
              </div>
              <div className="text-zinc-500 text-xs tabular-nums">{Math.round(s.avgResponseMs)}ms</div>
            </Card>
          ))}
          {data?.recentSessions.length === 0 && (
            <p className="text-sm text-zinc-500">{t('dashboard.empty')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
