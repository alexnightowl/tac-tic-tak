// Scheduling-latency log: performance.now() at feel.emit (or sfx) entry →
// right after AudioBufferSourceNode.start() returned. This is the JS-side
// cost only; the device's output latency comes on top and is judged with
// /dev/metronome on film (PLAN Phase 1: gesture-end → start() p95 < 5 ms).

export type LatencySample = { event: string; ms: number; at: number };

const MAX = 500;
const samples: LatencySample[] = [];

export const feelStats = {
  errors: 0,
  lastError: '' as string,
  plays: 0,
  /** Plays that waited for a decode (not in the latency log). */
  lateStarts: 0,
  /**
   * Cold-start check: ms from the first sfx request of the session to its
   * start() (includes creating the context and decoding when not preloaded).
   */
  firstPlayMs: -1,
  firstEvent: '',
  /** performance.now() of the first sfx request; -1 until then. */
  firstRequestAt: -1,
  /** ms the preload took, once it finished. */
  preloadMs: -1,
  decoded: 0,
  /** ms to create the AudioContext, and to start its output driver. */
  contextMs: -1,
  driverMs: -1,
  /** AppState-driven context suspends / resumes (background check). */
  suspends: 0,
  resumes: 0,
};

export function recordLatency(event: string, t0: number): void {
  const now = performance.now();
  samples.push({ event, ms: now - t0, at: now });
  if (samples.length > MAX) samples.shift();
  markPlayed(event);
}

/** Counts a play; the first one is logged for the cold-start check. */
export function markPlayed(event: string): void {
  feelStats.plays += 1;
  if (feelStats.firstPlayMs < 0 && feelStats.firstRequestAt >= 0) {
    feelStats.firstPlayMs = performance.now() - feelStats.firstRequestAt;
    feelStats.firstEvent = event;
    console.log(`[feel] first sound (${event}) started ${feelStats.firstPlayMs.toFixed(0)} ms after the first request`);
  }
}

export function markRequested(): void {
  if (feelStats.firstRequestAt < 0) feelStats.firstRequestAt = performance.now();
}

export function recordError(where: string, e: unknown): void {
  feelStats.errors += 1;
  feelStats.lastError = `${where}: ${e instanceof Error ? e.message : String(e)}`;
  console.warn(`[feel] ${feelStats.lastError}`);
}

export function latencyLog(): readonly LatencySample[] {
  return samples;
}

export function clearLatency(): void {
  samples.length = 0;
}

export type LatencySummary = { n: number; p50: number; p95: number; max: number };

export function latencySummary(): LatencySummary {
  if (samples.length === 0) return { n: 0, p50: 0, p95: 0, max: 0 };
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { n: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
}
