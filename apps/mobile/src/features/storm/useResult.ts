import { hardestSolved, stormAccuracy, type StormBest } from '@tac/core/storm';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { feel } from '@/feel';
import { useLang } from '@/ui';
import { useT } from '@/ui/lang';
import { stormSummaryQuery } from './api';
import { ordinal } from './format';
import type { StormLocalRun } from './store';
import { requestStormSync } from './sync';

// What Storm Result shows for a finished run, shared by the phone screen
// (ResultScreen) and the desktop page (desktop/home DxStormResult). Drawn
// from the run on the device, so it works offline at once; the server's
// answer (old best, place among friends, the run id a dare needs) fills in
// when it lands.

export function useStormResult(run: StormLocalRun) {
  const t = useT();
  const { lang } = useLang();
  // The last known summary stands in for the server's answer until it lands.
  const cached = useQuery({ ...stormSummaryQuery(), enabled: false });
  const [syncTried, setSyncTried] = useState(false);
  const { body, saved } = run;
  const score = body.score;

  useEffect(() => {
    if (run.saved || run.rejected) return;
    let alive = true;
    void requestStormSync('run').finally(() => alive && setSyncTried(true));
    return () => {
      alive = false;
    };
  }, [run.saved, run.rejected]);

  const isBest = saved ? saved.isBest : score > 0 && score > (cached.data?.best?.score ?? 0);
  useEffect(() => {
    if (isBest) feel.emit('normRise');
  }, [isBest]);

  const prev: StormBest | null = saved ? saved.previousBest : (cached.data?.best ?? null);
  let line: string;
  if (isBest) {
    line = prev ? t('storm.result.beat_old', { n: prev.score }) : t('storm.result.first');
    if (saved?.friendsRank && saved.friendsCount > 1) line += ` · ${t('storm.result.rank', { rank: ordinal(saved.friendsRank, lang) })}`;
  } else if (prev) {
    const d = prev.score - score;
    line = t('storm.result.best_is', { n: prev.score }) + (d > 0 ? ` · ${t('storm.result.to_go', { d })}` : '');
  } else {
    line = t('storm.result.first');
  }
  const status = saved ? null : run.rejected ? t('storm.result.rejected') : syncTried ? t('storm.result.offline') : t('storm.result.saving');

  const ratings = body.results.map((r) => run.ratings[r.i] ?? 0);
  const lo = ratings.length ? Math.min(...ratings) : 0;
  const hi = ratings.length ? Math.max(...ratings) : 0;
  const mistakes = body.results.filter((r) => !r.ok).length;
  const hardest = hardestSolved(body.results, run.ratings);
  const accuracy = Math.round(stormAccuracy(score, body.mistakes) * 100);

  return { score, saved, isBest, line, status, ratings, lo, hi, mistakes, hardest, accuracy };
}
