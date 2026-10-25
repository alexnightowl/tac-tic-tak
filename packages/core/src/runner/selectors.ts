// Read-only views over RunnerState for the runner screen. The countdown
// reads remainingMs itself at 1 Hz; nothing here is a tick path.
import { computeUnlockProgress } from '../rules';
import type { RunnerState } from './types';

export const attemptsOf = (s: RunnerState) => s.counters.solved + s.counters.failed;

export const accuracyOf = (s: RunnerState) => {
  const n = attemptsOf(s);
  return n > 0 ? s.counters.solved / n : 0;
};

export const avgResponseMsOf = (s: RunnerState) => {
  const n = attemptsOf(s);
  return n > 0 ? s.counters.totalResponseMs / n : 0;
};

/** Session time left. Frozen while paused; 0 once finishing. */
export function remainingMs(s: RunnerState, at: number): number {
  if (s.paused) return s.pausedRemainingMs ?? 0;
  if (s.endsAt == null) return s.phase === 'booting' ? s.durationSec * 1000 : 0;
  return Math.max(0, s.endsAt - at);
}

/** web warnThreshold: 10–30 s, 10% of the session. */
export const warnThresholdSec = (durationSec: number) => Math.min(30, Math.max(10, Math.round(durationSec * 0.1)));

/**
 * fix: the web derived "your turn" from orientation === chess.turn(), which a
 * fixedColor override inverts. The phase is the truth.
 */
export const isPlayerTurn = (s: RunnerState) => s.phase === 'playerTurn' && !s.paused;

/**
 * TurnCard props (web priority: loading > opponent moving > your turn). As on
 * the web, everything between the player's move and the next turn (reply,
 * attempt, /next, setup slide) reads "opponent moving".
 */
export function turnCardOf(s: RunnerState) {
  return {
    loading: s.phase === 'booting',
    opponentMoving: s.phase !== 'booting' && s.phase !== 'playerTurn',
    playerTurn: s.phase === 'playerTurn',
    playerColor: s.playerColor,
    streak: s.streak,
    streakBroken: s.streakBroken,
  };
}

/** Live unlock progress (eligibility, calibration and theme gating stay with the screen). */
export function unlockProgressOf(s: RunnerState) {
  if (s.sessionStartRating == null || s.durationSec === 0 || !s.style) return null;
  return computeUnlockProgress(s.style, {
    solved: s.counters.solved,
    accuracy: accuracyOf(s),
    peakRating: s.counters.peakRating,
    startRating: s.sessionStartRating,
  }, s.durationSec);
}
