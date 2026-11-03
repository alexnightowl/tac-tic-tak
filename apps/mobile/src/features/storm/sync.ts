import { isApiError, queryKeys } from '@tac/core/api';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { invalidateChallenges } from '@/features/challenge/api';
import { readNetwork } from '@/features/offline/sync';
import { queryClient } from '@/platform/query';
import { authStore, useAuthStore } from '@/stores/authStore';
import { invalidateStorm, stormApi } from './api';
import { pendingRuns, recoverLive, stormStore } from './store';

// Posts finished Storm / Race runs (docs/mobile/STORM.md "Rules"): right
// after a run, on app start (after finishing a run the app was killed in)
// and on every return to the foreground. One flush at a time.

export type StormSyncReason = 'start' | 'foreground' | 'run';

let inFlight: Promise<void> | null = null;

export function requestStormSync(reason: StormSyncReason): Promise<void> {
  if (!inFlight) {
    inFlight = flush(reason)
      .catch(() => undefined)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** A refusal that a retry would not change (bad body, gone stream / challenge). */
const permanent = (e: unknown) => isApiError(e) && e.kind === 'http' && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);

async function flush(reason: StormSyncReason): Promise<void> {
  if (authStore.getState().status !== 'authed') return;
  const uid = stormStore.getState().uid;
  if (!uid) return;
  if (reason !== 'run') recoverLive();
  const queue = pendingRuns(stormStore.getState());
  if (queue.length === 0) return;
  if (!(await readNetwork()).online) return;
  let sent = 0;
  for (const run of [...queue].reverse()) {
    try {
      const saved = await stormApi.run(run.body);
      if (stormStore.getState().uid !== uid) return;
      stormStore.getState().markSaved(run.clientId, saved);
      sent += 1;
    } catch (e) {
      if (stormStore.getState().uid !== uid) return;
      if (permanent(e)) stormStore.getState().markRejected(run.clientId);
      else break;
    }
  }
  if (sent > 0) {
    invalidateStorm();
    invalidateChallenges();
    // XP, streak and Review moved with the run.
    for (const queryKey of [queryKeys.me(), queryKeys.overview(), queryKeys.experience(), queryKeys.reviewThemes(), ['review-list']]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }
}

/** Mounted once in the signed-in stack: flushes on start and on foreground. */
export function StormSyncHost() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status !== 'authed') return;
    void requestStormSync('start');
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void requestStormSync('foreground');
    });
    return () => sub.remove();
  }, [status]);
  return null;
}
