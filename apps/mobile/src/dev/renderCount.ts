/**
 * Counts React commits of a component (PLAN §2.6: zero board commits during
 * a drag). Read the latest values with `renderCounts()`; dev screens render
 * them under a testID so Maestro can assert on them.
 */
const counts = new Map<string, number>();

export function useRenderCount(name: string): number {
  // Counting renders is a deliberate render-time side effect; keep the
  // compiler from memoising it away.
  'use no memo';
  const n = (counts.get(name) ?? 0) + 1;
  counts.set(name, n);
  return n;
}

export function renderCounts(): Record<string, number> {
  return Object.fromEntries(counts);
}
