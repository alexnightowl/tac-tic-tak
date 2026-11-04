'use client';

import { useEffect } from 'react';

/**
 * Runs `dispose` when the component really unmounts. React 18 StrictMode
 * (dev) unmounts and remounts every effect once on mount; disposing a
 * controller there would kill it for good, so the disposal waits a task and
 * is dropped when the effect has been set up again in the meantime.
 */
export function useDisposeOnUnmount(owner: object, dispose: () => void): void {
  useEffect(() => {
    live.set(owner, (live.get(owner) ?? 0) + 1);
    return () => {
      live.set(owner, (live.get(owner) ?? 1) - 1);
      setTimeout(() => {
        if ((live.get(owner) ?? 0) === 0) dispose();
      }, 0);
    };
    // dispose belongs to owner, which never changes.
  }, [owner]); // eslint-disable-line react-hooks/exhaustive-deps
}

const live = new WeakMap<object, number>();
