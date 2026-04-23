'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { BoardThumbnail } from '@/components/board/BoardThumbnail';
import { themeLabel, isMetaTheme } from '@/lib/theme-labels';
import { BoardTheme } from '@/lib/themes';

type ReviewItem = {
  puzzleId: string;
  createdAt: string;
  rating: number;
  fen: string;
  setupMove: string | null;
  themes: string[];
};

export default function ReviewList() {
  const settings = useAppStore((s) => s.settings);
  const settingsReady = useAppStore((s) => s.settingsReady);
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['review'],
    queryFn: () => http.get<ReviewItem[]>('/review'),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('review.title')}</h1>
        <p className="text-zinc-400 text-sm mt-1">{t('review.subtitle')}</p>
      </div>
      {isLoading && <p className="text-zinc-500">…</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {(data ?? []).map((i) => (
          <Link key={i.puzzleId} href={`/review/${i.puzzleId}`}>
            <Card className="flex items-center gap-3 hover:border-[var(--accent)] cursor-pointer transition-colors">
              {settingsReady ? (
                <BoardThumbnail
                  fen={i.fen}
                  setupMove={i.setupMove}
                  size={96}
                  theme={settings.boardTheme as BoardTheme}
                  pieceSet={settings.pieceSet}
                />
              ) : (
                <div className="shrink-0 rounded-lg bg-white/5" style={{ width: 96, height: 96 }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white">{i.rating}</span>
                  <span className="text-xs text-zinc-500">{new Date(i.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-zinc-400 mt-1 line-clamp-2">
                  {i.themes.filter((s) => !isMetaTheme(s)).slice(0, 3).map((s) => themeLabel(s, settings.language as 'en' | 'uk')).join(' · ')}
                </div>
              </div>
              <ChevronRight size={16} className="text-zinc-500" />
            </Card>
          </Link>
        ))}
        {data?.length === 0 && <p className="text-sm text-zinc-500 col-span-full">{t('review.empty')}</p>}
      </div>
    </div>
  );
}
