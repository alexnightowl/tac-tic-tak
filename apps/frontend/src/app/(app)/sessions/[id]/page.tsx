'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Check, X } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { themeLabel } from '@/lib/theme-labels';
import { cn, fmtDuration } from '@/lib/utils';

type Attempt = {
  id: string;
  puzzleId: string;
  puzzleRating: number;
  correct: boolean;
  responseMs: number;
  createdAt: string;
};
type Detail = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  mode: string;
  theme: string | null;
  durationSec: number;
  startRating: number;
  endRating: number;
  peakRating: number;
  solved: number;
  failed: number;
  accuracy: number;
  avgResponseMs: number;
  attempts: Attempt[];
};

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const language = useAppStore((s) => s.settings.language);
  const locale = language === 'uk' ? 'uk-UA' : 'en-US';

  const { data, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => http.get<Detail>(`/sessions/${id}`),
  });

  if (isLoading || !data) {
    return <div className="text-zinc-500">…</div>;
  }

  const date = new Date(data.startedAt);
  const when = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) +
    ', ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronLeft size={16} /> {language === 'uk' ? 'Назад' : 'Back'}
        </Button>
      </div>

      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
          {when.charAt(0).toUpperCase() + when.slice(1)}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {data.theme ? themeLabel(data.theme) : (language === 'uk' ? 'Змішана' : 'Mixed')}
          {' · '}{Math.round(data.durationSec / 60)} {language === 'uk' ? 'хв' : 'min'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardTitle>{language === 'uk' ? 'Початок' : 'Start'}</CardTitle>
          <CardValue>{data.startRating}</CardValue>
        </Card>
        <Card>
          <CardTitle>{language === 'uk' ? 'Пік' : 'Peak'}</CardTitle>
          <CardValue>{data.peakRating}</CardValue>
        </Card>
        <Card>
          <CardTitle>{language === 'uk' ? 'Точність' : 'Accuracy'}</CardTitle>
          <CardValue>{Math.round(data.accuracy * 100)}%</CardValue>
        </Card>
        <Card>
          <CardTitle>{language === 'uk' ? 'Середній час' : 'Avg response'}</CardTitle>
          <CardValue>{Math.round(data.avgResponseMs)}ms</CardValue>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center justify-between">
          <CardTitle className="mb-0">{language === 'uk' ? 'Розвʼязано' : 'Solved'}</CardTitle>
          <span className="text-2xl font-semibold text-emerald-300">{data.solved}</span>
        </Card>
        <Card className="flex items-center justify-between">
          <CardTitle className="mb-0">{language === 'uk' ? 'Провалено' : 'Failed'}</CardTitle>
          <span className="text-2xl font-semibold text-rose-300">{data.failed}</span>
        </Card>
      </div>

      <SessionReviewCta sessionId={data.id} language={language} />


      <div>
        <h2 className="text-lg font-medium mb-2">
          {language === 'uk' ? 'Спроби' : 'Attempts'}
          <span className="text-zinc-500 text-sm font-normal ml-2">{data.attempts.length}</span>
        </h2>
        <div className="flex flex-col gap-1.5">
          {data.attempts.map((a, i) => (
            <div key={a.id} className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg glass',
            )}>
              <div className="w-6 text-xs text-zinc-500 tabular-nums">{i + 1}</div>
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                a.correct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
              )}>
                {a.correct ? <Check size={14} /> : <X size={14} />}
              </div>
              <div className="flex-1 text-sm tabular-nums">{a.puzzleRating}</div>
              <div className="text-xs text-zinc-500 tabular-nums">{fmtDuration(a.responseMs)}</div>
            </div>
          ))}
          {data.attempts.length === 0 && (
            <p className="text-sm text-zinc-500">{language === 'uk' ? 'Жодної спроби' : 'No attempts'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionReviewCta({ sessionId, language }: { sessionId: string; language: string }) {
  const { data } = useQuery({
    queryKey: ['session-review-items', sessionId],
    queryFn: () => http.get<{ items: Array<{ reason: 'failed' | 'slow' }> }>(`/sessions/${sessionId}/review-items`),
    staleTime: 60_000,
  });
  if (!data || data.items.length === 0) return null;
  const failed = data.items.filter((i) => i.reason === 'failed').length;
  const slow = data.items.filter((i) => i.reason === 'slow').length;
  const heading = language === 'uk' ? 'Повторити сесію' : 'Review this session';
  const hint = language === 'uk'
    ? `${failed} не вирішено · ${slow} повільно. Прожени без таймера.`
    : `${failed} missed · ${slow} slow. Drill them now — no timer.`;
  const cta = language === 'uk' ? 'Повторити' : 'Review mistakes';
  return (
    <a
      href={`/sessions/${sessionId}/review`}
      className="block rounded-2xl p-4 border border-[var(--border-soft)] bg-black/20 hover:bg-black/30 transition-colors"
    >
      <div className="text-sm font-semibold">{heading}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{hint}</div>
      <div className="mt-3 inline-flex items-center h-9 px-4 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold">
        {cta}
      </div>
    </a>
  );
}
