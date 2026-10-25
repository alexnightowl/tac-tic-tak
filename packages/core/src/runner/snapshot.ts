// Kill-safe snapshot (PLAN §2.10): written to MMKV `session` on every
// persistSnapshot effect, restored by the Home resume card. Plain JSON.
import { Chess } from 'chess.js';
import type { Square } from '../board';
import { parseUci, type ServerPuzzle } from '../puzzle';
import type { TrainingStyle } from '../rules';
import { createRunner } from './reducer';
import type {
  LastMove, RunnerConfig, RunnerCounters, RunnerEffect, RunnerState, SessionMode, Transition,
} from './types';

export const SNAPSHOT_VERSION = 1;

export type RunnerSnapshot = {
  v: typeof SNAPSHOT_VERSION;
  sessionId: string;
  style: TrainingStyle | null;
  sessionMode: SessionMode;
  durationSec: number;
  sessionStartRating: number | null;
  rating: number | null;
  remainingMs: number;
  paused: boolean;
  puzzle: ServerPuzzle;
  /** Solution moves played from puzzle.fen (1 = after the setup move). */
  ply: number;
  /** 'turn': the player is to move; 'attempt': /attempt not confirmed; 'next': waiting for /next. */
  stage: 'turn' | 'attempt' | 'next';
  fen: string;
  lastMove: LastMove | null;
  remaining: string[];
  /** Thinking time already spent on this puzzle. */
  turnElapsedMs: number;
  counters: RunnerCounters;
  streak: number;
  pendingAttempt: { puzzleId: string; correct: boolean; responseMs: number; square: Square } | null;
  savedAt: number;
};

/** Null when there is nothing to resume (booting, finishing, summary). */
export function toSnapshot(s: RunnerState, at: number): RunnerSnapshot | null {
  if (s.mode !== 'session' || !s.puzzle || !s.fen) return null;
  if (s.phase === 'booting' || s.phase === 'finishing' || s.phase === 'summary' || s.finishQueued) return null;

  let fen = s.fen;
  let lastMove = s.lastMove;
  let remaining = s.remaining;
  let stage: RunnerSnapshot['stage'] = 'turn';
  // A slide in flight is saved as landed: deterministic, and the resume card
  // replaces the animation anyway.
  if (s.anim) {
    fen = s.anim.fenAfter;
    lastMove = s.anim.lastMove;
    // remaining drops the reply only in land(), which a landed-under-pause slide hasn't run yet.
    if (s.anim.kind === 'opponent') remaining = remaining.slice(1);
  } else if (s.phase === 'opponentReplying' && remaining[0]) {
    const c = new Chess(fen);
    try {
      c.move(parseUci(remaining[0]));
      const m = parseUci(remaining[0]);
      fen = c.fen();
      lastMove = { from: m.from, to: m.to };
      remaining = remaining.slice(1);
    } catch {
      // leave the position as is; the reply is re-scheduled on resume
    }
  }
  if (s.phase === 'resolving') stage = s.pendingAttempt ? 'attempt' : 'next';
  if (s.phase === 'loadingNext') stage = 'next';
  const clock = s.paused ? (s.pausedAt ?? at) : at;
  const remainingTime = s.paused ? (s.pausedRemainingMs ?? 0) : Math.max(0, (s.endsAt ?? at) - at);
  return {
    v: SNAPSHOT_VERSION,
    sessionId: s.sessionId,
    style: s.style,
    sessionMode: s.sessionMode,
    durationSec: s.durationSec,
    sessionStartRating: s.sessionStartRating,
    rating: s.rating,
    remainingMs: remainingTime,
    paused: s.paused,
    puzzle: s.puzzle,
    ply: s.puzzle.moves.length - remaining.length,
    stage,
    fen,
    lastMove,
    remaining,
    turnElapsedMs: s.turnStartedAt != null ? Math.max(0, clock - s.turnStartedAt) : 0,
    counters: s.counters,
    streak: s.streak,
    pendingAttempt: s.pendingAttempt
      ? { puzzleId: s.pendingAttempt.puzzleId, correct: s.pendingAttempt.correct, responseMs: s.pendingAttempt.responseMs, square: s.pendingAttempt.square }
      : null,
    savedAt: at,
  };
}

/**
 * Rebuilds a runner from a snapshot, PAUSED: the same puzzle and the same
 * remaining time, and the player resumes from the overlay. A stage-'attempt'
 * snapshot re-sends its /attempt on resume (until B6 idempotency lands this
 * can double-record an attempt the server already took).
 */
export function restoreRunner(snap: RunnerSnapshot, config: Extract<RunnerConfig, { mode: 'session' }>, at: number): Transition {
  const base = createRunner(config);
  // The solver is whoever moves after the setup move.
  const playerColor: 'w' | 'b' = new Chess(snap.puzzle.fen).turn() === 'w' ? 'b' : 'w';
  const orientation =
    config.fixedColor === 'white' ? 'white' : config.fixedColor === 'black' ? 'black' : playerColor === 'w' ? 'white' : 'black';
  const state: RunnerState = {
    ...base,
    phase: snap.stage === 'turn' ? 'playerTurn' : snap.stage === 'attempt' ? 'resolving' : 'loadingNext',
    paused: true,
    pausedAt: at,
    durationSec: snap.durationSec,
    style: snap.style,
    sessionMode: snap.sessionMode,
    sessionStartRating: snap.sessionStartRating,
    rating: snap.rating,
    endsAt: null,
    pausedRemainingMs: snap.remainingMs,
    puzzle: snap.puzzle,
    fen: snap.fen,
    orientation,
    playerColor,
    lastMove: snap.lastMove,
    remaining: snap.remaining,
    turnStartedAt: snap.stage === 'turn' ? at - snap.turnElapsedMs : null,
    counters: snap.counters,
    streak: snap.streak,
    timers: { timeUp: { ms: snap.remainingMs, dueAt: null } },
    pendingAttempt: snap.pendingAttempt ? { ...snap.pendingAttempt, reqId: null } : null,
    attemptDone: snap.stage === 'next',
  };
  const effects: RunnerEffect[] = [
    { type: 'interactive', on: false },
    { type: 'reset', fen: snap.fen, orientation: state.orientation },
    { type: 'setPosition', fen: snap.fen, lastMove: snap.lastMove, ms: 0 },
  ];
  return { state, effects };
}
