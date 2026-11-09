import { useEffect, useState } from 'react';
import { Easing, useSharedValue, withTiming, cancelAnimation, type SharedValue } from 'react-native-reanimated';

import type { BlindView } from './director';

/**
 * The preview countdown for a blind runner's status: whole seconds left
 * (re-renders only the caller, once a second) and a 1 → 0 drain on the
 * UI thread for a progress bar.
 */
export function useLook(view: BlindView): { secs: number; drain: SharedValue<number> } {
  const total = view.previewSec * 1000;
  const endsAt = view.stage === 'preview' ? view.previewEndsAt : null;
  const leftMs = view.stage === 'preview' ? view.previewLeftMs : view.stage === 'setup' ? total : 0;
  // The interval's reading for this run of the countdown; until the first
  // tick (or while it stands still) the seconds come from leftMs.
  const key = `${endsAt}:${leftMs}`;
  const [tick, setTick] = useState<{ key: string; secs: number } | null>(null);
  const secs = tick && tick.key === key ? tick.secs : Math.ceil(leftMs / 1000);
  const drain = useSharedValue(total > 0 ? leftMs / total : 0);

  useEffect(() => {
    const read = () => Math.max(0, Math.ceil((endsAt != null ? endsAt - Date.now() : leftMs) / 1000));
    cancelAnimation(drain);
    const now = endsAt != null ? Math.max(0, endsAt - Date.now()) : leftMs;
    drain.set(total > 0 ? now / total : 0);
    if (endsAt == null) return;
    drain.set(withTiming(0, { duration: now, easing: Easing.linear }));
    const id = setInterval(() => {
      const n = read();
      // Same second: same object, no render.
      setTick((prev) => (prev && prev.key === key && prev.secs === n ? prev : { key, secs: n }));
    }, 250);
    return () => clearInterval(id);
  }, [endsAt, leftMs, total, drain, key]);

  return { secs, drain };
}
