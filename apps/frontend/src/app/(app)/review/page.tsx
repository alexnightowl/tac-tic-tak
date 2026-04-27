'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT, useTn } from '@/lib/i18n';
import { themeLabel } from '@/lib/theme-labels';

type ReviewTheme = {
  slug: string;
  count: number;
  minRating: number;
};

type ReviewItem = {
  puzzleId: string;
  rating: number;
};

export default function ReviewList() {
  const settings = useAppStore((s) => s.settings);
  const t = useT();
  const tn = useTn();

  const themes = useQuery({
    queryKey: ['review-themes'],
    queryFn: () => http.get<ReviewTheme[]>('/review/themes'),
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('review.title')}</h1>
        <p className="text-zinc-400 text-sm mt-1">{t('review.subtitle_themes')}</p>
      </div>
      {themes.isLoading && (
        <div className="flex items-center justify-center py-10 text-zinc-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
      {themes.data && themes.data.length === 0 && (
        <p className="text-sm text-zinc-500 py-6 text-center">{t('review.empty')}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(themes.data ?? []).map((th) => (
          <ThemeCard
            key={th.slug}
            theme={th}
            language={settings.language as 'en' | 'uk'}
            t={t}
            tn={tn}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  language,
  t,
  tn,
}: {
  theme: ReviewTheme;
  language: 'en' | 'uk';
  t: (k: string) => string;
  tn: (k: string, n: number) => string;
}) {
  // Pre-fetch the first puzzle of this theme so the runner doesn't
  // flicker through a loading state when the user taps in.
  const startUrl = useStartUrl(theme.slug);

  return (
    <Link href={startUrl}>
      <div className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-[var(--accent)] cursor-pointer transition-colors border border-[var(--border-soft)]">
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-white truncate">
            {themeLabel(theme.slug, language)}
          </div>
          <div className="text-xs text-zinc-400 mt-1 flex items-center gap-3 tabular-nums">
            <span>
              {theme.count} {tn('review.puzzle_word', theme.count)}
            </span>
            <span className="text-zinc-600">·</span>
            <span>
              {t('review.theme_from')} {theme.minRating}
            </span>
          </div>
        </div>
        <ChevronRight size={18} className="text-zinc-500 shrink-0" />
      </div>
    </Link>
  );
}

/**
 * Resolves the URL to the first puzzle of the theme. We need the
 * puzzleId so the runner has somewhere to land — fetched lazily here
 * (small list, cached by react-query) and the URL falls back to the
 * theme list if the bucket somehow becomes empty between paint and
 * tap.
 */
function useStartUrl(themeSlug: string): string {
  const queue = useQuery({
    queryKey: ['review-list', themeSlug],
    queryFn: () => http.get<ReviewItem[]>(`/review?theme=${encodeURIComponent(themeSlug)}`),
    staleTime: 30_000,
  });
  const first = queue.data?.[0]?.puzzleId;
  return first
    ? `/review/${first}?theme=${encodeURIComponent(themeSlug)}`
    : '/review';
}
