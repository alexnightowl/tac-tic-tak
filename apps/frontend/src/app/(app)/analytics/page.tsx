'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { RadarChart } from '@/components/charts/RadarChart';
import { themeLabel, isMetaTheme } from '@/lib/theme-labels';

type Overview = {
  recentSessions: Array<{ id: string; startedAt: string; solved: number; failed: number; accuracy: number; avgResponseMs: number; peakRating: number }>;
  allTimePeak: number;
  lastSessionBuckets: Record<string, { attempts: number; accuracy: number; avgResponseMs: number }>;
};
type ThemeRow = { slug: string; attempts: number; failures: number; avgResponseMs: number; failureRate: number; weakness: number; rating: number };
type Recommendation = { theme: string | null; reason: string };

export default function AnalyticsPage() {
  const t = useT();
  const language = useAppStore((s) => s.settings.language);
  const overview = useQuery({ queryKey: ['analytics'], queryFn: () => http.get<Overview>('/analytics') });
  const themes = useQuery({ queryKey: ['analytics-themes'], queryFn: () => http.get<ThemeRow[]>('/analytics/themes') });
  const rec = useQuery({ queryKey: ['analytics-rec'], queryFn: () => http.get<Recommendation>('/analytics/recommendations') });

  // Top 8 most-attempted *tactical* themes — strip out the Lichess meta
  // tags (middlegame / endgame / short / long / ...) that would otherwise
  // dominate the radar without actually representing a tactical skill.
  const radarData = useMemo(() => {
    if (!themes.data) return [];
    return themes.data
      .filter((t) => t.rating > 0 && !isMetaTheme(t.slug))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8)
      .sort((a, b) => a.slug.localeCompare(b.slug)) // stable visual order
      .map((t) => ({ label: themeLabel(t.slug, language), value: t.rating }));
  }, [themes.data, language]);

  const radarBounds = useMemo(() => {
    if (radarData.length === 0) return { min: 1200, max: 2000 };
    const values = radarData.map((d) => d.value);
    const lo = Math.floor(Math.min(...values) / 100) * 100;
    const hi = Math.ceil(Math.max(...values) / 100) * 100;
    return { min: Math.max(600, lo - 100), max: hi + 100 };
  }, [radarData]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('stats.title')}</h1>

      {rec.data?.theme && (
        <Card>
          <CardTitle>{t('stats.recommend')}</CardTitle>
          <CardValue>{themeLabel(rec.data.theme, language)}</CardValue>
          <div className="text-xs text-zinc-500 mt-1">{rec.data.reason}</div>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-medium mb-2">{t('stats.by_time')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {['0-3', '3-6', '6-10'].map((k) => {
            const b = overview.data?.lastSessionBuckets?.[k];
            return (
              <Card key={k}>
                <CardTitle>{k} min</CardTitle>
                <CardValue>{b ? `${Math.round(b.accuracy * 100)}%` : '—'}</CardValue>
                <div className="text-xs text-zinc-500 mt-1">{b ? `${b.attempts} · ${b.avgResponseMs}ms` : ''}</div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardTitle>{t('stats.by_theme')}</CardTitle>
        {radarData.length >= 3 ? (
          <div className="flex justify-center mt-2">
            <RadarChart data={radarData} min={radarBounds.min} max={radarBounds.max} size={340} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500 py-6 text-center">{t('stats.no_data')}</p>
        )}
      </Card>

      <div>
        <h2 className="text-lg font-medium mb-2">{t('stats.theme_list')}</h2>
        <div className="grid gap-2">
          {(themes.data ?? [])
            .filter((th) => !isMetaTheme(th.slug))
            .sort((a, b) => b.weakness - a.weakness)
            .slice(0, 20)
            .map((th) => (
              <Card key={th.slug} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{themeLabel(th.slug, language)}</div>
                  <div className="text-xs text-zinc-500">
                    {th.attempts} · {Math.round(th.failureRate * 100)}% fail · {th.avgResponseMs}ms
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {th.rating > 0 && <span className="text-sm tabular-nums text-zinc-400">{th.rating}</span>}
                  <div className="w-20 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500/80" style={{ width: `${Math.round(th.weakness * 100)}%` }} />
                  </div>
                </div>
              </Card>
            ))}
          {themes.data?.length === 0 && <p className="text-sm text-zinc-500">{t('stats.no_data')}</p>}
        </div>
      </div>
    </div>
  );
}
