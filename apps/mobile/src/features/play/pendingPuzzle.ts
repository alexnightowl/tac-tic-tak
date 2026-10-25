import type { NextResponse } from '@tac/core/runner';

// web lib/pending-puzzle.ts: POST /sessions' firstPuzzle handed to the
// runner in memory, so the board appears without a second /next round-trip.
// Read once; a missing entry (deep link, reload) falls back to /next.
const pending = new Map<string, NextResponse>();

export function stashFirstPuzzle(sessionId: string, payload: NextResponse): void {
  pending.set(sessionId, payload);
}

export function takeFirstPuzzle(sessionId: string): NextResponse | null {
  const p = pending.get(sessionId) ?? null;
  pending.delete(sessionId);
  return p;
}
