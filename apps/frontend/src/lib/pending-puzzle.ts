/**
 * Tiny in-memory hand-off so the New Session page can pass the first
 * puzzle (embedded in POST /sessions response) to the play runner
 * without a second network round-trip. Cleared on read — any leftover
 * entries evict on module reload, so it's fine as plain module state.
 */
import type { ServerPuzzle } from './puzzle';

export type FirstPuzzlePayload = {
  puzzle: ServerPuzzle;
  currentRating: number;
  session: {
    id: string;
    startedAt: string;
    durationSec: number;
    style: string;
    mode: 'mixed' | 'theme' | string;
  };
};

const cache = new Map<string, FirstPuzzlePayload>();

export function stashFirstPuzzle(sessionId: string, data: FirstPuzzlePayload) {
  cache.set(sessionId, data);
}

export function takeFirstPuzzle(sessionId: string): FirstPuzzlePayload | null {
  const v = cache.get(sessionId) ?? null;
  if (v) cache.delete(sessionId);
  return v;
}
