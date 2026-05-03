'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { RadarChart } from '@/components/charts/RadarChart';
import { RatingHistoryChart } from '@/components/charts/RatingHistoryChart';
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import { themeLabel, isMetaTheme } from '@/lib/theme-labels';
import {
  TrainingStyle,
  TRAINING_STYLES,
  isTrainingStyle,
} from '@/lib/levels';
import { formatLocalDate } from '@/lib/utils';

type Overview = {
  recentSessions: Array<{ id: string; startedAt: string; solved: number; failed: number; accuracy: number; avgResponseMs: number; peakRating: number }>;
  allTimePeak: number;
  lastSessionBuckets: Record<string, { attempts: number; accuracy: number; avgResponseMs: number }>;
  lifetime: {
    solved: number;
    attempts: number;
    accuracy: number;
    peakRating: number;
    sessions: number;
  };
};
type ThemeRow = { slug: string; attempts: number; failures: number; avgResponseMs: number; failureRate: number; weakness: number; rating: number };
type Recommendation = { theme: string | null; reason: string };
type TimelinePoint = {
  id: string;
  endedAt: string;
  style: string;
  startRating: number;
  peakRating: number;
  solved: number;
  durationSec: number;
};

type StyleFilter = 'all' | TrainingStyle;

export default function AnalyticsPage() {
  const t = useT();
  const language = useAppStore((s) => s.settings.language) as 'en' | 'uk';
  const [filter, setFilter] = useState<StyleFilter>('all');
  const styleParam = filter === 'all' ? '' : `?style=${filter}`;

  const overview = useQuery({
    queryKey: ['analytics', filter],
    queryFn: () => http.get<Overview>(`/analytics${styleParam}`),
  });
  const themes = useQuery({
    queryKey: ['analytics-themes', filter],
    queryFn: () => http.get<ThemeRow[]>(`/analytics/themes${styleParam}`),
  });
  const rec = useQuery({
    queryKey: ['analytics-rec', filter],
    queryFn: () => http.get<Recommendation>(`/analytics/recommendations${styleParam}`),
  });
  // Timeline always pulls all styles — the line chart wants every
  // style on the same axis so the user can compare their bullet vs
  // rapid trajectory at a glance, even when the rest of the page
  // is filtered. Heatmap also benefits from all-styles activity.
  const timeline = useQuery({
    queryKey: ['analytics-timeline'],
    queryFn: () => http.get<TimelinePoint[]>('/analytics/timeline?days=365'),
  });

  const ratingPoints = useMemo(() => {
    if (!timeline.data) return [];
    return timeline.data
      .filter((p) => isTrainingStyle(p.style))
      .map((p) => ({
        endedAt: p.endedAt,
        style: p.style as TrainingStyle,
        rating: p.peakRating,
      }));
  }, [timeline.data]);

  // Bucket sessions by the user's local calendar day. The backend
  // returns ISO timestamps; we convert each to the local 'YYYY-MM-DD'
  // so the heatmap reflects "did I play on Monday in MY timezone",
  // not in UTC.
  const heatmapData = useMemo(() => {
    if (!timeline.data) return [];
    const counts = new Map<string, number>();
    for (const p of timeline.data) {
      const key = formatLocalDate(new Date(p.endedAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }, [timeline.data]);

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
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{t('stats.title')}</h1>
      </div>

      <Segmented
        value={filter}
        onChange={(v) => setFilter(v as StyleFilter)}
        size="sm"
        options={[
          { value: 'all', label: t('stats.filter_all') },
          ...TRAINING_STYLES.map((s) => ({
            value: s,
            label: t(`style.${s}.name`),
          })),
        ]}
      />

      <Card>
        <CardTitle>{t('stats.activity')}</CardTitle>
        <p className="text-xs text-zinc-500 -mt-1 mb-3">{t('stats.activity_hint')}</p>
        <ActivityHeatmap data={heatmapData} weeks={52} language={language} />
      </Card>

      <Card>
        <CardTitle>{t('stats.rating_history')}</CardTitle>
        <p className="text-xs text-zinc-500 -mt-1 mb-2">{t('stats.rating_history_hint')}</p>
        <RatingHistoryChart
          data={ratingPoints}
          highlightStyle={filter === 'all' ? null : filter}
          language={language}
        />
      </Card>

      {overview.data?.lifetime && (
        <div>
          <h2 className="text-lg font-medium mb-2">{t('stats.lifetime')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardTitle>{t('stats.lifetime.solved')}</CardTitle>
              <CardValue>{overview.data.lifetime.solved.toLocaleString()}</CardValue>
              <div className="text-xs text-zinc-500 mt-1">
                {overview.data.lifetime.attempts > 0
                  ? `${overview.data.lifetime.attempts.toLocaleString()} ${t('stats.lifetime.attempts')}`
                  : ''}
              </div>
            </Card>
            <Card>
              <CardTitle>{t('stats.lifetime.accuracy')}</CardTitle>
              <CardValue>
                {overview.data.lifetime.attempts > 0
                  ? `${Math.round(overview.data.lifetime.accuracy * 100)}%`
                  : '—'}
              </CardValue>
            </Card>
            <Card>
              <CardTitle>{t('stats.lifetime.sessions')}</CardTitle>
              <CardValue>{overview.data.lifetime.sessions.toLocaleString()}</CardValue>
            </Card>
            <Card>
              <CardTitle>{t('stats.lifetime.peak')}</CardTitle>
              <CardValue>
                {overview.data.lifetime.peakRating > 0
                  ? overview.data.lifetime.peakRating
                  : '—'}
              </CardValue>
            </Card>
          </div>
        </div>
      )}

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
