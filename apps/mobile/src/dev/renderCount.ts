import { useRef } from 'react';

/**
 * Counts React commits of a component (PLAN §2.6: zero board commits during
 * a drag). Read the latest values with `renderCounts()`; dev screens render
 * them under a testID so Maestro can assert on them.
 */
const counts = new Map<string, number>();

export function useRenderCount(name: string): number {
  const n = useRef(0);
  n.current += 1;
  counts.set(name, n.current);
  return n.current;
}

export function renderCounts(): Record<string, number> {
  return Object.fromEntries(counts);
}
