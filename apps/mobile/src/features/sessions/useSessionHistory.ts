import { queryKeys } from '@tac/core/api';
import { timing } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { feel } from '@/feel';
import { reviewKeys, sessionApi, type OverviewResponse } from '@/features/review/api';
import { queryClient } from '@/platform/query';
import { toast } from '@/shell/toast/store';
import { useT } from '@/ui/lang';

/** Undo window (Q15, PROVISIONAL): the toast lifetime. */
const UNDO_MS = timing.toastDismiss;

/** After a delete lands: the web's invalidations (dashboard, analytics, theme stats). */
function invalidateAfterDelete(id: string) {
  queryClient.setQueryData<OverviewResponse>(reviewKeys.overview(), (d) =>
    d ? { ...d, recentSessions: d.recentSessions.filter((s) => s.id !== id) } : d,
  );
  void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsAll() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsThemesAll() });
  queryClient.removeQueries({ queryKey: reviewKeys.session(id) });
}

/**
 * The session history's data and its optimistic delete (Q15): a deleted row
 * hides at once, `undo` names it for the toast lifetime, then DELETE
 * /sessions/:id. Unmounting commits a pending delete. Shared by the phone
 * HistoryScreen and the desktop page.
 */
export function useSessionHistory() {
  const t = useT();
  const q = useQuery({ queryKey: reviewKeys.overview(), queryFn: () => sessionApi.overview() });
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [undo, setUndo] = useState<string | null>(null);
  // The one delete waiting for its undo window (a second delete commits the first).
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const commit = (id: string) => {
    sessionApi.remove(id).then(
      () => {
        invalidateAfterDelete(id);
        setHidden((h) => without(h, id));
      },
      () => {
        // Roll back: the row comes back and the user hears why.
        setHidden((h) => without(h, id));
        toast.show({ title: t('sessions.delete_failed') });
      },
    );
  };

  const flush = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    commit(p.id);
  };

  const onDelete = (id: string) => {
    flush();
    setHidden((h) => new Set(h).add(id));
    setUndo(id);
    pending.current = {
      id,
      timer: setTimeout(() => {
        pending.current = null;
        setUndo((u) => (u === id ? null : u));
        commit(id);
      }, UNDO_MS),
    };
  };

  const onUndo = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setHidden((h) => without(h, p.id));
    setUndo(null);
  };

  // Leaving with a delete in its undo window still deletes.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const rows = (q.data?.recentSessions ?? []).filter((r) => !hidden.has(r.id));
  const total = q.data?.recentSessions.length ?? 0;
  return { q, rows, total, refreshing, onRefresh, onDelete, onUndo, undo };
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}
