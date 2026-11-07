import type { StormFormat, StormStreamResponse } from '@tac/core/storm';
import { router, type Href } from 'expo-router';
import { useState } from 'react';

import { feel } from '@/feel';
import { toast } from '@/shell/toast/store';
import { useT } from '@/ui/lang';
import { stormApi } from './api';

// A Storm run starts like a session (owner, 2026-11-07: "the loading screens
// differ"): the Start button spins while the stream loads, and the runner
// opens with its board ready. The stream is handed over in memory, read
// once; a missing entry (deep link, retry) makes the runner fetch it itself.

const pending = new Map<string, StormStreamResponse>();
const keyOf = (challengeId: string | null) => challengeId ?? 'solo';

export function takeStream(challengeId: string | null): StormStreamResponse | null {
  const s = pending.get(keyOf(challengeId)) ?? null;
  pending.delete(keyOf(challengeId));
  return s;
}

export function runHref(challengeId: string | null, format?: StormFormat): Href {
  if (!challengeId) return '/storm/run' as Href;
  return `/storm/run?challenge=${encodeURIComponent(challengeId)}${format ? `&format=${format}` : ''}` as Href;
}

/** Loads the stream, then opens the runner with it. Throws when the stream fails. */
export async function openRun(opts: { challengeId?: string | null; format?: StormFormat; replace?: boolean } = {}): Promise<void> {
  const challengeId = opts.challengeId ?? null;
  const stream = await stormApi.stream(challengeId ?? undefined);
  if (stream.puzzles.length === 0) throw new Error('empty stream');
  pending.set(keyOf(challengeId), stream);
  const href = runHref(challengeId, opts.format);
  if (opts.replace) router.replace(href);
  else router.push(href);
}

/** openRun for a button: `launching` drives its spinner, a failure toasts. */
export function useStormLaunch() {
  const t = useT();
  const [launching, setLaunching] = useState(false);
  const launch = async (opts: { challengeId?: string | null; format?: StormFormat; replace?: boolean } = {}) => {
    if (launching) return;
    setLaunching(true);
    try {
      await openRun(opts);
    } catch {
      feel.emit('formError');
      toast.show({ title: t('storm.run.error') });
    } finally {
      setLaunching(false);
    }
  };
  return { launching, launch };
}
