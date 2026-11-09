import { blindMotion } from '@tac/core/tokens';
import { useEffect, useState, useSyncExternalStore } from 'react';

import type { RunnerController } from '@/runner';
import { blindSessionOf, writeBlindPeeks } from './store';

// Blind mode (D40) is a view-layer feature on top of the session runner:
// this director watches the runner's state and decides when the board's
// pieces show. Per puzzle: visible through the setup move ('setup'), a
// look with a countdown once it is the player's turn ('preview'), then
// hidden for the rest of the line ('hidden'; Peek shows them for a moment),
// visible again once the puzzle resolves ('revealed'). The opponent's
// replies are named in text. Timers live here, never in src/board.

export type BlindStage = 'setup' | 'preview' | 'hidden' | 'revealed';

export type BlindView = {
  stage: BlindStage;
  previewSec: number;
  /** Preview countdown end (wall clock); null while paused or outside the preview. */
  previewEndsAt: number | null;
  /** Preview time left while paused (or before it started). */
  previewLeftMs: number;
  /** The opponent's last reply on this puzzle (SAN), if any. */
  reply: string | null;
  /** How the puzzle ended ('revealed'). */
  result: 'solved' | 'missed' | null;
  peeking: boolean;
  peeks: number;
  /** The board hides its pieces now. */
  hidden: boolean;
};

export class BlindDirector {
  view: BlindView;
  private listeners = new Set<() => void>();
  private unsub: (() => void) | null = null;
  private puzzleId: string | null = null;
  private solved = 0;
  private failed = 0;
  private lastAnimId = -1;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private peekTimer: ReturnType<typeof setTimeout> | null = null;
  private peekUntil = 0;
  private held = false;

  constructor(
    private readonly sessionId: string,
    private readonly controller: RunnerController,
    previewSec: number,
    peeks: number,
  ) {
    this.view = {
      stage: 'setup',
      previewSec,
      previewEndsAt: null,
      previewLeftMs: previewSec * 1000,
      reply: null,
      result: null,
      peeking: false,
      peeks,
      hidden: false,
    };
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getView = (): BlindView => this.view;

  attach(): void {
    if (this.unsub) return;
    this.unsub = this.controller.subscribe(this.sync);
    this.sync();
  }

  detach(): void {
    this.unsub?.();
    this.unsub = null;
    this.clearPreview();
    this.clearPeek();
  }

  /** Peek pressed (button down, B / Space): the pieces show for at least peekMs, or while held. */
  peekStart = (hold = true): void => {
    const v = this.view;
    if (v.stage !== 'hidden' || this.controller.state.paused) return;
    this.held = hold;
    this.peekUntil = Date.now() + blindMotion.peekMs;
    this.clearPeek();
    this.peekTimer = setTimeout(() => {
      this.peekTimer = null;
      if (!this.held) this.endPeek();
    }, blindMotion.peekMs);
    if (v.peeking) return;
    const peeks = v.peeks + 1;
    writeBlindPeeks(this.sessionId, peeks);
    this.set({ peeking: true, peeks });
  };

  /** Peek released: hides again once the minimum peek is over. */
  peekEnd = (): void => {
    this.held = false;
    if (this.view.peeking && Date.now() >= this.peekUntil) this.endPeek();
  };

  private endPeek() {
    this.clearPeek();
    if (this.view.peeking) this.set({ peeking: false });
  }

  private clearPeek() {
    if (this.peekTimer) clearTimeout(this.peekTimer);
    this.peekTimer = null;
  }

  private clearPreview() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = null;
  }

  private runPreview(leftMs: number): Partial<BlindView> {
    this.clearPreview();
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      if (this.view.stage === 'preview') this.set({ stage: 'hidden', previewEndsAt: null, previewLeftMs: 0 });
    }, leftMs);
    return { previewEndsAt: Date.now() + leftMs, previewLeftMs: leftMs };
  }

  /** Runner state → stage. Runs on every runner commit (cheap, no React work unless something changed). */
  private sync = (): void => {
    const s = this.controller.state;
    const v = this.view;
    const patch: Partial<BlindView> = {};
    let stage = v.stage;
    const pid = s.puzzle?.id ?? null;

    // A new puzzle: pieces visible through its setup move.
    if (pid !== this.puzzleId) {
      this.puzzleId = pid;
      this.solved = s.counters.solved;
      this.failed = s.counters.failed;
      this.clearPreview();
      this.endPeek();
      stage = 'setup';
      Object.assign(patch, { reply: null, result: null, previewEndsAt: null, previewLeftMs: v.previewSec * 1000 });
    }
    // The puzzle resolved: show the position.
    if (s.counters.solved > this.solved || s.counters.failed > this.failed) {
      const solved = s.counters.solved > this.solved;
      this.solved = s.counters.solved;
      this.failed = s.counters.failed;
      this.clearPreview();
      this.endPeek();
      stage = 'revealed';
      Object.assign(patch, { result: solved ? 'solved' : 'missed', previewEndsAt: null });
    }
    // The opponent replied: name the move (the piece itself stays hidden).
    if (s.anim && s.anim.kind === 'opponent' && s.anim.id !== this.lastAnimId) {
      this.lastAnimId = s.anim.id;
      patch.reply = s.anim.move.san;
    }
    // The player's turn on a fresh puzzle: the look starts.
    if (stage === 'setup' && s.phase === 'playerTurn' && pid) {
      stage = 'preview';
      if (!s.paused) Object.assign(patch, this.runPreview(v.previewSec * 1000));
    } else if (stage === 'preview') {
      if (s.phase !== 'playerTurn' && s.phase !== 'booting') {
        // Moved during the look: the line goes on blind.
        this.clearPreview();
        stage = 'hidden';
        Object.assign(patch, { previewEndsAt: null, previewLeftMs: 0 });
      } else if (s.paused && v.previewEndsAt != null) {
        this.clearPreview();
        Object.assign(patch, { previewEndsAt: null, previewLeftMs: Math.max(0, v.previewEndsAt - Date.now()) });
      } else if (!s.paused && v.previewEndsAt == null && this.previewTimer == null) {
        Object.assign(patch, this.runPreview(Math.max(300, v.previewLeftMs)));
      }
    }
    if (s.paused && v.peeking) {
      this.held = false;
      this.endPeek();
    }
    if (stage !== v.stage) patch.stage = stage;
    if (Object.keys(patch).length > 0) this.set(patch);
  };

  private set(patch: Partial<BlindView>) {
    const next = { ...this.view, ...patch };
    next.hidden = next.stage === 'hidden' && !next.peeking;
    const prev = this.view;
    if ((Object.keys(next) as (keyof BlindView)[]).every((k) => next[k] === prev[k])) return;
    this.view = next;
    for (const fn of this.listeners) fn();
  }
}

const noop = () => () => {};
const none = () => null;

/**
 * The blind director of a session started blind on this device (else
 * null). Attaches to the runner while mounted.
 */
export function useBlind(sessionId: string, controller: RunnerController): { director: BlindDirector | null; view: BlindView | null } {
  const [director] = useState(() => {
    const info = blindSessionOf(sessionId);
    return info ? new BlindDirector(sessionId, controller, info.previewSec, info.peeks) : null;
  });
  useEffect(() => {
    if (!director) return;
    director.attach();
    return () => director.detach();
  }, [director]);
  const view = useSyncExternalStore(director ? director.subscribe : noop, director ? director.getView : none);
  return { director, view };
}

/** The resolved position's minimum time on screen for a blind session (the runner's revealMs). */
export function blindRevealMs(sessionId: string): number | undefined {
  return blindSessionOf(sessionId) ? blindMotion.revealMs : undefined;
}
