import { queryKeys } from '@tac/core/api';
import { useEffect, useState } from 'react';

import { queryClient } from '@/platform/query';
import type { RunnerController } from '@/runner';
import { addPlanResult, readPlanRecord, writePlanRecord, type PlanRecord } from './model';

/**
 * The runner's view of a daily-plan session (D40): null for any other
 * session. Counts each resolved puzzle under the plan themes it carries
 * (the summary's per-theme lines) and refreshes the Home plan card when
 * the session ends. View-layer only: the reducer knows nothing of plans.
 */
export function usePlanSession(sessionId: string, controller: RunnerController): PlanRecord | null {
  const [plan, setPlan] = useState<PlanRecord | null>(() => readPlanRecord(sessionId));
  const isPlan = plan != null;

  useEffect(() => {
    if (!isPlan) return;
    let ended = false;
    const sync = () => {
      const s = controller.state;
      const rec = readPlanRecord(sessionId);
      if (!rec) return;
      const done = s.counters.solved + s.counters.failed;
      let next = rec;
      if (done > rec.seen) {
        // One new attempt on the current puzzle; more than one means a
        // restore skipped some (their themes are gone): count them as seen.
        const solvedNow = s.pendingAttempt?.correct ?? false;
        next = done === rec.seen + 1 && s.puzzle ? addPlanResult(rec, s.puzzle.themes, solvedNow) : { ...rec, seen: done };
        writePlanRecord(next);
        setPlan(next);
      }
      if (s.phase === 'summary' && !ended) {
        ended = true;
        void queryClient.invalidateQueries({ queryKey: queryKeys.planTodayAll() });
      }
    };
    sync();
    return controller.subscribe(sync);
  }, [controller, sessionId, isPlan]);

  return plan;
}
