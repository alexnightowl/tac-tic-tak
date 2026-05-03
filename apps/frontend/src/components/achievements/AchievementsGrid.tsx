'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Github } from 'lucide-react';
import { http } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { AchievementCard, type Achievement } from './AchievementCard';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Category = Achievement['category'];

const CATEGORY_ORDER: Category[] = ['play', 'skill', 'streak', 'customize', 'social'];

const REPO_URL = 'https://github.com/alexnightowl/tac-tic-tak';

/**
 * Achievements grid that lives on the second tab of the stats page.
 * Mounts → fetches the catalogue, also fires /achievements/evaluate
 * as a catch-all so any unlock the inline write paths missed gets
 * picked up the next time the user opens this page (and surfaced
 * as a toast).
 */
export function AchievementsGrid() {
  const t = useT();
  const language = useAppStore((s) => s.settings.language) as 'en' | 'uk';
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const [starring, setStarring] = useState(false);

  const list = useQuery({
    queryKey: ['achievements'],
    queryFn: () => http.get<Achievement[]>('/achievements'),
  });

  // Catch-all evaluation on first mount. If any newly-unlocked
  // achievements come back, toast them and refetch the list.
  useEffect(() => {
    let cancelled = false;
    http.post<{ newly: string[] }>('/achievements/evaluate', {})
      .then((r) => {
        if (cancelled) return;
        if (r.newly.length > 0) {
          for (const slug of r.newly) {
            pushToast({
              tone: 'achievement',
              title: t(`achv.${slug}.name`),
              description: t(`achv.${slug}.desc`),
              achievementSlug: slug,
            });
          }
          qc.invalidateQueries({ queryKey: ['achievements'] });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    if (!list.data) return null;
    const map = new Map<Category, Achievement[]>();
    for (const a of list.data) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    return map;
  }, [list.data]);

  const totalUnlocked = list.data?.filter((a) => a.unlocked).length ?? 0;
  const total = list.data?.length ?? 0;
  const starRepoEntry = list.data?.find((a) => a.slug === 'star-repo');
  const starredAlready = !!starRepoEntry?.unlocked;

  const onStar = async () => {
    if (starredAlready || starring) return;
    setStarring(true);
    try {
      // Open the GitHub page in a new tab so the user can actually star it.
      window.open(REPO_URL, '_blank', 'noopener,noreferrer');
      // Trust-based confirm — server flips the flag and re-evaluates.
      const r = await http.post<{ newly: string[] }>('/achievements/star-confirm', {});
      for (const slug of r.newly) {
        pushToast({
          tone: 'achievement',
          title: t(`achv.${slug}.name`),
          description: t(`achv.${slug}.desc`),
          achievementSlug: slug,
        });
      }
      qc.invalidateQueries({ queryKey: ['achievements'] });
    } finally {
      setStarring(false);
    }
  };

  if (list.isLoading || !grouped) {
    return <div className="text-sm text-zinc-500">{t('achv.loading')}</div>;
  }

  return (
    <div className="space-y-5">
      <Card className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>{t('achv.progress_title')}</CardTitle>
          <div className="text-xs text-zinc-500 mt-1">
            {t('achv.progress_value')
              .replace('{done}', String(totalUnlocked))
              .replace('{total}', String(total))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
          <span className="text-amber-300">{totalUnlocked}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{total}</span>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Github size={20} className="text-zinc-300 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{t('achv.star_repo_title')}</div>
            <div className="text-xs text-zinc-500 line-clamp-2">{t('achv.star_repo_hint')}</div>
          </div>
        </div>
        <button
          onClick={onStar}
          disabled={starredAlready || starring}
          className={cn(
            'shrink-0 h-9 px-3 rounded-lg text-xs font-semibold transition-colors',
            starredAlready
              ? 'bg-emerald-500/15 text-emerald-300 cursor-default'
              : 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90',
            starring && 'opacity-60',
          )}
        >
          {starredAlready ? t('achv.starred') : t('achv.star_cta')}
        </button>
      </Card>

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2 pl-1">
              {t(`achv.cat.${cat}`)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((a) => (
                <AchievementCard
                  key={a.slug}
                  achievement={a}
                  name={t(`achv.${a.slug}.name`)}
                  description={t(`achv.${a.slug}.desc`)}
                  language={language}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
