'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Repeat, Search, Target, XCircle } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { themeIcon } from '@/lib/theme-icons';
import { themeLabel, KNOWN_THEME_SLUGS, isMetaTheme } from '@/lib/theme-labels';
import { cn } from '@/lib/utils';

type Tab = 'weakest' | 'popular' | 'all';

type ThemeRow = {
  slug: string;
  attempts: number;
  failureRate: number;
  weakness: number;
  rating: number;
};

type Props = {
  value: string;
  onChange: (slug: string) => void;
};

/**
 * Theme grid for the play setup screen. Replaces the old searchable
 * <Select> dropdown with a visual tile grid that surfaces weakness +
 * volume hints, so the player picks based on what they actually need
 * to drill instead of scrolling an alphabetical list.
 *
 * Three tabs:
 *   - Weakest:  user's themes sorted by weakness score (desc). Only
 *               shows themes with at least one attempt. Empty for
 *               brand-new accounts — the empty state nudges them to
 *               play a few sessions first.
 *   - Popular:  user's themes sorted by attempt count (desc). Same
 *               data, different lens.
 *   - All:      every known tactical theme, alphabetical. The
 *               fallback for new accounts and anyone wanting a
 *               specific theme that hasn't shown up in their data yet.
 *
 * Search filters whichever tab is active.
 */
export function ThemePicker({ value, onChange }: Props) {
  const t = useT();
  const language = useAppStore((s) => s.settings.language) as 'en' | 'uk';
  const [tab, setTab] = useState<Tab>('weakest');
  const [query, setQuery] = useState('');

  // Personal themes-with-stats — drives the Weakest/Popular tabs.
  // The All tab uses the static KNOWN_THEME_SLUGS list and doesn't
  // depend on this fetch.
  const stats = useQuery({
    queryKey: ['analytics-themes', 'all'],
    queryFn: () => http.get<ThemeRow[]>('/analytics/themes'),
  });

  const tactical = useMemo(
    () => (stats.data ?? []).filter((r) => !isMetaTheme(r.slug)),
    [stats.data],
  );

  // Pre-compute a quick lookup so the All tab can show the same
  // small stat chip when the player has data for a theme.
  const byslug = useMemo(() => {
    const m = new Map<string, ThemeRow>();
    for (const r of tactical) m.set(r.slug, r);
    return m;
  }, [tactical]);

  const items = useMemo(() => {
    let list: Array<{ slug: string; row?: ThemeRow }>;
    if (tab === 'weakest') {
      list = [...tactical]
        .sort((a, b) => b.weakness - a.weakness)
        .map((r) => ({ slug: r.slug, row: r }));
    } else if (tab === 'popular') {
      list = [...tactical]
        .sort((a, b) => b.attempts - a.attempts)
        .map((r) => ({ slug: r.slug, row: r }));
    } else {
      list = KNOWN_THEME_SLUGS
        .map((slug) => ({ slug, row: byslug.get(slug) }))
        .sort((a, b) =>
          themeLabel(a.slug, language).localeCompare(themeLabel(b.slug, language)),
        );
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((it) =>
        themeLabel(it.slug, language).toLowerCase().includes(q),
      );
    }
    return list;
  }, [tab, tactical, byslug, query, language]);

  const tabs: Array<{ k: Tab; label: string }> = [
    { k: 'weakest', label: t('play.themes_tab_weakest') },
    { k: 'popular', label: t('play.themes_tab_popular') },
    { k: 'all',     label: t('play.themes_tab_all') },
  ];

  const emptyStats = (tab === 'weakest' || tab === 'popular') && tactical.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-black/30 rounded-xl p-1">
        {tabs.map(({ k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'flex-1 h-8 px-2 rounded-lg text-xs transition-colors',
              tab === k ? 'bg-[var(--bg-softer)] text-white' : 'text-zinc-400 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('play.search_themes')}
          className="w-full h-9 rounded-lg bg-white/5 border border-[var(--border-soft)] pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {emptyStats ? (
        <p className="text-xs text-zinc-500 py-6 text-center">
          {t('play.themes_no_stats')}
        </p>
      ) : items.length === 0 ? (
        <p className="text-xs text-zinc-500 py-6 text-center">{t('play.no_themes_match')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
          {items.map(({ slug, row }) => (
            <ThemeTile
              key={slug}
              slug={slug}
              row={row}
              language={language}
              active={value === slug}
              onPick={() => onChange(slug)}
              metric={tab}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeTile({
  slug, row, language, active, onPick, metric,
}: {
  slug: string;
  row: ThemeRow | undefined;
  language: 'en' | 'uk';
  active: boolean;
  onPick: () => void;
  metric: Tab;
}) {
  const Icon = themeIcon(slug);
  const label = themeLabel(slug, language);

  // Stat shown in the bottom strip varies by tab so each lens has its
  // own actionable number rather than a single noisy metric. A small
  // glyph prefixes the number so the unit reads at a glance:
  //   weakest → ✕ + fail rate (% in red/amber/green)
  //   popular → ↻ + attempt count
  //   all     → ⌖ + acquired rating (only if the player has data)
  let stat: { text: string; tint: string; Icon: typeof XCircle } | null = null;
  if (row) {
    if (metric === 'weakest') {
      const pct = Math.round(row.failureRate * 100);
      const tint = pct >= 50 ? 'text-rose-300' : pct >= 25 ? 'text-amber-300' : 'text-emerald-300';
      stat = { text: `${pct}%`, tint, Icon: XCircle };
    } else if (metric === 'popular') {
      stat = { text: `${row.attempts}`, tint: 'text-zinc-400', Icon: Repeat };
    } else if (row.rating > 0) {
      stat = { text: `${row.rating}`, tint: 'text-zinc-400', Icon: Target };
    }
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/10'
          : 'border-[var(--border)] bg-white/[0.03] hover:bg-white/[0.06]',
      )}
      aria-pressed={active}
    >
      <div className={cn(
        'h-9 w-9 rounded-lg flex items-center justify-center',
        active ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--bg-softer)] text-zinc-300',
      )}>
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 w-full">
        <div className={cn(
          'text-xs font-medium leading-tight line-clamp-2 break-words',
          active ? 'text-white' : 'text-zinc-200',
        )}>
          {label}
        </div>
        {stat && (
          <div className={cn('flex items-center gap-1 text-[10px] mt-1 tabular-nums', stat.tint)}>
            <stat.Icon size={10} strokeWidth={2.2} />
            {stat.text}
          </div>
        )}
      </div>
    </button>
  );
}
