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
import { AchievementsGrid } from '@/components/achievements/AchievementsGrid';
import { themeLabel, isMetaTheme } from '@/lib/theme-labels';
import { themeIcon } from '@/lib/theme-icons';
import {
  TrainingStyle,
  TRAINING_STYLES,
  isTrainingStyle,
} from '@/lib/levels';
import { formatLocalDate, cn } from '@/lib/utils';

type Overview = {
  recentSessions: Array<{ id: string; startedAt: string; solved: number; failed: number; accuracy: number; avgResponseMs: number; peakRating: number }>;
  allTimePeak: number;
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
type Tab = 'stats' | 'achievements';

export default function AnalyticsPage() {
  const t = useT();
  const language = useAppStore((s) => s.settings.language) as 'en' | 'uk';
  const [tab, setTab] = useState<Tab>('stats');
  const [filter, setFilter] = useState<StyleFilter>('all');

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{t('stats.title')}</h1>
      </div>

      <div className="flex gap-1 bg-black/30 rounded-xl p-1 w-fit">
        {([
          { k: 'stats',        label: t('stats.tab_stats') },
          { k: 'achievements', label: t('stats.tab_achievements') },
        ] as const).map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'h-9 px-3 rounded-lg text-sm transition-colors',
              tab === k ? 'bg-[var(--bg-softer)] text-white' : 'text-zinc-400 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'achievements' ? (
        <AchievementsGrid />
      ) : (
        <StatsTab
          filter={filter}
          onFilterChange={setFilter}
          language={language}
          t={t}
        />
      )}
    </div>
  );
}

function StatsTab({ filter, onFilterChange, language, t }: {
  filter: StyleFilter;
  onFilterChange: (v: StyleFilter) => void;
  language: 'en' | 'uk';
  t: (k: string) => string;
}) {
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

  const heatmapData = useMemo(() => {
    if (!timeline.data) return [];
    const counts = new Map<string, number>();
    for (const p of timeline.data) {
      const key = formatLocalDate(new Date(p.endedAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }, [timeline.data]);

  const radarData = useMemo(() => {
    if (!themes.data) return [];
    return themes.data
      .filter((t) => t.rating > 0 && !isMetaTheme(t.slug))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8)
      .sort((a, b) => a.slug.localeCompare(b.slug))
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
    <>
      <Segmented
        value={filter}
        onChange={(v) => onFilterChange(v as StyleFilter)}
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

      <ThemesList themes={themes.data ?? []} language={language} t={t} />
    </>
  );
}

type ThemesTab = 'weakest' | 'strongest' | 'all';

function ThemesList({
  themes,
  language,
  t,
}: {
  themes: ThemeRow[];
  language: 'en' | 'uk';
  t: (k: string) => string;
}) {
  const [tab, setTab] = useState<ThemesTab>('weakest');

  const tactical = useMemo(
    () => themes.filter((th) => !isMetaTheme(th.slug)),
    [themes],
  );

  const visible = useMemo(() => {
    if (tab === 'strongest') {
      return [...tactical]
        .filter((th) => th.attempts > 0)
        .sort((a, b) => a.weakness - b.weakness)
        .slice(0, 20);
    }
    if (tab === 'all') {
      return [...tactical].sort((a, b) => b.weakness - a.weakness);
    }
    return [...tactical].sort((a, b) => b.weakness - a.weakness).slice(0, 20);
  }, [tactical, tab]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-medium">{t('stats.theme_list')}</h2>
        <div className="flex gap-1 bg-black/30 rounded-xl p-1">
          {([
            { k: 'weakest',   label: t('stats.themes_tab_weakest') },
            { k: 'strongest', label: t('stats.themes_tab_strongest') },
            { k: 'all',       label: t('stats.themes_tab_all') },
          ] as const).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                'h-8 px-3 rounded-lg text-xs transition-colors',
                tab === k ? 'bg-[var(--bg-softer)] text-white' : 'text-zinc-400 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {visible.map((th) => (
          <ThemeRowCard key={th.slug} row={th} language={language} />
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-zinc-500">{t('stats.no_data')}</p>
        )}
      </div>
    </div>
  );
}

function ThemeRowCard({ row, language }: { row: ThemeRow; language: 'en' | 'uk' }) {
  const Icon = themeIcon(row.slug);
  const w = Math.max(0, Math.min(1, row.weakness));
  // Rose for weak, amber for mid, emerald for strong — colour communicates
  // direction at a glance; the bar width still encodes magnitude.
  const barColor = w >= 0.66 ? 'bg-rose-500/80' : w >= 0.33 ? 'bg-amber-500/80' : 'bg-emerald-500/80';
  const iconTint = w >= 0.66 ? 'text-rose-300' : w >= 0.33 ? 'text-amber-300' : 'text-emerald-300';
  return (
    <Card className="flex items-center gap-3">
      <div className={cn('h-10 w-10 rounded-xl bg-[var(--bg-softer)] flex items-center justify-center shrink-0', iconTint)}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{themeLabel(row.slug, language)}</div>
        <div className="text-xs text-zinc-500">
          {row.attempts} · {Math.round(row.failureRate * 100)}% fail · {row.avgResponseMs}ms
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {row.rating > 0 && <span className="text-sm tabular-nums text-zinc-400">{row.rating}</span>}
        <div className="w-20 h-2 bg-white/5 rounded-full overflow-hidden">
          <div className={cn('h-full', barColor)} style={{ width: `${Math.round(w * 100)}%` }} />
        </div>
      </div>
    </Card>
  );
}
