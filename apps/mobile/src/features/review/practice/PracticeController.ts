import type { Square } from '@tac/core/board';
import { parseUci } from '@tac/core/puzzle';
import {
  createPractice,
  e2eWrongMove,
  practiceReducer,
  type PracticeConfig,
  type PracticeEffect,
  type PracticeEvent,
  type PracticeItem,
  type PracticeState,
  type PracticeTimer,
} from '@tac/core/runner';
import { Chess } from 'chess.js';

import type { BoardHandle } from '@/board';
import { feel } from '@/feel';

// Effect interpreter for @tac/core/runner practiceReducer (drill, mistakes,
// viewer). Same contract as the session RunnerController: the reducer is
// pure, this class owns timers, the Board handle, the fade and the network.
// Screens read `state` through useSyncExternalStore; the Board never
// re-renders from here.

export type PracticeHooks = {
  /** Drill: resolve the solved puzzle, refetch the list, load the next one (null = theme cleared). */
  advance?: (puzzleId: string) => Promise<PracticeItem | null>;
  /** Q14: fire-and-forget resolve of a solved mistake. */
  resolve?: (puzzleId: string) => void;
};

/** Board cross-fade, owned by the screen's board slot (a SharedValue). */
export type Fader = (to: 0 | 1, done?: () => void) => void;

type E2EKind = 'solve' | 'wrong';

export class PracticeController {
  state: PracticeState;
  private board: BoardHandle | null = null;
  private fader: Fader | null = null;
  private timers = new Map<PracticeTimer, ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private disposed = false;
  private e2e: { kind: E2EKind; puzzleId: string } | null = null;
  private e2eQueue: E2EKind[] = [];
  private e2eTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    config: PracticeConfig,
    private readonly hooks: PracticeHooks = {},
  ) {
    this.state = createPractice(config);
  }

  setBoard = (board: BoardHandle | null): void => {
    this.board = board;
  };

  setFader(fader: Fader | null): void {
    this.fader = fader;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getState = (): PracticeState => this.state;

  /** False when the board must take the move back. */
  dispatch = (event: PracticeEvent): boolean => {
    if (this.disposed) return false;
    const { state, effects } = practiceReducer(this.state, event);
    const changed = state !== this.state;
    this.state = state;
    let accepted = true;
    for (const fx of effects) {
      if (fx.type === 'rejectMove') accepted = false;
      else this.run(fx);
    }
    if (changed) for (const fn of this.listeners) fn();
    if (this.e2e || this.e2eQueue.length > 0) this.armE2E();
    return accepted;
  };

  dispose(): void {
    this.disposed = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    if (this.e2eTimer) clearTimeout(this.e2eTimer);
    this.listeners.clear();
    this.board = null;
    this.fader = null;
  }

  private run(fx: Exclude<PracticeEffect, { type: 'rejectMove' }>): void {
    const board = this.board;
    switch (fx.type) {
      case 'reset':
        board?.reset(fx.fen, fx.orientation);
        return;
      case 'setPosition':
        void board?.setPosition(fx.fen, fx.lastMove, fx.ms);
        return;
      case 'animate':
        if (!board) {
          this.dispatch(fx.done);
          return;
        }
        board.animateMove(fx.from, fx.to, fx.ms, fx.promotion).then(
          () => this.dispatch(fx.done),
          () => {
            // Board out of sync: land anyway and snap it to the reducer's FEN.
            this.dispatch(fx.done);
            const s = this.state;
            if (s.fen) void this.board?.setPosition(s.fen, s.lastMove, 0);
          },
        );
        return;
      case 'interactive':
        board?.setInteractive(fx.on);
        return;
      case 'flash':
        void board?.flash(fx.square, fx.ok);
        return;
      case 'shake':
        void board?.shake(fx.square);
        return;
      case 'sparks':
        void board?.sparks(fx.square);
        return;
      case 'hint':
        board?.setHint(fx.level, fx.from, fx.to);
        return;
      case 'feel':
        feel.emit(fx.event, fx.ctx);
        return;
      case 'schedule': {
        const prev = this.timers.get(fx.id);
        if (prev) clearTimeout(prev);
        this.timers.set(
          fx.id,
          setTimeout(() => {
            this.timers.delete(fx.id);
            this.dispatch({ type: 'timer', id: fx.id });
          }, fx.ms),
        );
        return;
      }
      case 'cancel': {
        const t = this.timers.get(fx.id);
        if (t) clearTimeout(t);
        this.timers.delete(fx.id);
        return;
      }
      case 'fadeOut':
        // Outside the reducer's call stack, also when nothing fades.
        if (this.fader) this.fader(0, () => this.dispatch({ type: 'faded' }));
        else setTimeout(() => this.dispatch({ type: 'faded' }), 0);
        return;
      case 'fadeIn':
        this.fader?.(1);
        return;
      case 'advance': {
        const { reqId } = fx;
        const advance = this.hooks.advance;
        if (!advance) {
          this.dispatch({ type: 'loaded', reqId, item: null });
          return;
        }
        advance(fx.puzzleId).then(
          (item) => this.dispatch({ type: 'loaded', reqId, item }),
          () => this.dispatch({ type: 'loadFailed', reqId }),
        );
        return;
      }
      case 'resolve':
        this.hooks.resolve?.(fx.puzzleId);
        return;
    }
  }

  // ─── Dev / E2E hooks (same contract as the session runner) ────────────

  e2eSolve = (): void => {
    this.e2eQueue.push('solve');
    this.armE2E();
  };

  e2eWrong = (): void => {
    this.e2eQueue.push('wrong');
    this.armE2E();
  };

  private armE2E() {
    if (this.e2eTimer || (!this.e2e && this.e2eQueue.length === 0)) return;
    const s = this.state;
    if (s.phase !== 'playerTurn' || s.anim || !s.item) return;
    this.e2eTimer = setTimeout(() => {
      this.e2eTimer = null;
      this.runE2E();
    }, 0);
  }

  /** One queued tap per puzzle; a solve keeps playing its line through the replies. */
  private runE2E() {
    const s = this.state;
    if (s.phase !== 'playerTurn' || s.anim || !s.item || !s.fen) return;
    if (this.e2e && this.e2e.puzzleId !== s.item.puzzle.id) this.e2e = null;
    // A wrong try ends at its rewind; the next tap starts fresh.
    if (this.e2e?.kind === 'wrong') this.e2e = null;
    if (!this.e2e) {
      const kind = this.e2eQueue.shift();
      if (!kind) return;
      this.e2e = { kind, puzzleId: s.item.puzzle.id };
    }
    const uci = this.e2e.kind === 'solve' ? s.remaining[0] : e2eWrongMove(s.fen, s.remaining[0]);
    if (!uci) {
      this.e2e = null;
      return;
    }
    const m = parseUci(uci);
    const before = s.fen;
    const kind = this.e2e.kind;
    const accepted = this.dispatch({ type: 'move', from: m.from, to: m.to, promotion: m.promotion });
    if (kind === 'wrong') this.e2e = null;
    if (accepted) {
      const after = new Chess(before);
      after.move({ from: m.from, to: m.to, promotion: m.promotion });
      void this.board?.setPosition(after.fen(), { from: m.from as Square, to: m.to as Square }, 120);
    }
  }
}
