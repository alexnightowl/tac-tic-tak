import { isApiError, queryKeys, type FinishResponse as ApiFinishResponse } from '@tac/core/api';
import type { Square } from '@tac/core/board';
import { formatLocalDate } from '@tac/core/format';
import { uciFromMove, parseUci } from '@tac/core/puzzle';
import {
  createRunner,
  progressionPatchOf,
  remainingMs,
  restoreRunner,
  runnerReducer,
  toSnapshot,
  type ApiEffect,
  type FinishResponse,
  type NextResponse,
  type RunnerConfig,
  type RunnerEffect,
  type RunnerEventInput,
  type RunnerEvent,
  type RunnerSnapshot,
  type RunnerState,
  type TimerId,
} from '@tac/core/runner';
import { Chess } from 'chess.js';

import type { BoardHandle } from '@/board';
import { feel } from '@/feel';
import { api } from '@/platform/api';
import { queryClient } from '@/platform/query';
import { readJSON, sessionKV, writeJSON } from '@/platform/storage';
import { toast } from '@/shell/toast/store';
import { appStore } from '@/stores/appStore';
import { translatorFor } from '@/ui/lang';

// The effect interpreter for @tac/core/runner (PLAN §2.7). The reducer is
// pure; this class owns the clock (`at` on every event), the cancellable
// timers, the Board handle promises, the API calls and the store writes.
// React reads `view` through useSyncExternalStore; the board and the
// countdown never re-render from here.

/** MMKV `session` key of the kill-safe snapshot (PLAN §2.10). */
export const SNAPSHOT_KEY = 'taktic.activeSession';

export function readSnapshot(sessionId: string): RunnerSnapshot | null {
  const snap = readJSON<RunnerSnapshot | null>(sessionKV, SNAPSHOT_KEY, null);
  return snap && snap.sessionId === sessionId && snap.v === 1 ? snap : null;
}

/** Any resumable session on this device (Home's resume card). */
export function readActiveSnapshot(): RunnerSnapshot | null {
  const snap = readJSON<RunnerSnapshot | null>(sessionKV, SNAPSHOT_KEY, null);
  return snap && snap.v === 1 && typeof snap.sessionId === 'string' ? snap : null;
}

export function clearActiveSnapshot(): void {
  sessionKV.remove(SNAPSHOT_KEY);
}

export type RunnerView = {
  state: RunnerState;
  /** ExitSheet open (confirmExit effect; closed by the sheet). */
  exitOpen: boolean;
  /**
   * The style's norm when the finish went out (web ceilingAtFinish): the
   * summary measures the rank change against it, since the store is
   * patched from the finish response before the summary renders.
   */
  ceilingBefore: number | null;
  /** Booted from a kill-safe snapshot (the pause overlay says so). */
  restored: boolean;
};

type SessionConfig = Extract<RunnerConfig, { mode: 'session' }>;

/** Dev / E2E: the request playing on a puzzle (queued ones wait for theirs). */
type E2ERequest = { kind: 'solve' | 'wrong'; puzzleId: string };

export class RunnerController {
  view: RunnerView;
  private board: BoardHandle | null = null;
  private timers = new Map<TimerId, ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private disposed = false;
  private e2e: E2ERequest | null = null;
  private e2eQueue: E2ERequest['kind'][] = [];
  private e2eTimer: ReturnType<typeof setTimeout> | null = null;
  /** Discarded / left: the screen navigates (and drops its back-block). */
  private onExit: (() => void) | null = null;

  constructor(readonly config: SessionConfig) {
    this.view = { state: createRunner(config), exitOpen: false, ceilingBefore: null, restored: false };
  }

  get state(): RunnerState {
    return this.view.state;
  }

  /** Returns the unsubscribe. */
  setOnExit(fn: () => void): () => void {
    this.onExit = fn;
    return () => {
      if (this.onExit === fn) this.onExit = null;
    };
  }

  setBoard(board: BoardHandle | null): void {
    this.board = board;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getView = (): RunnerView => this.view;

  remainingMs(at: number = Date.now()): number {
    return remainingMs(this.view.state, at);
  }

  /**
   * Called by <Countdown> once a second while the clock runs: refreshes
   * the snapshot's remaining time, so a kill (no background event, e.g.
   * the OS reclaiming memory) resumes within a second of where it was.
   * An MMKV write, no React work.
   */
  persistTick(): void {
    const s = this.view.state;
    if (this.disposed || s.paused || s.endsAt == null) return;
    const snap = toSnapshot(s, Date.now());
    if (snap) writeJSON(sessionKV, SNAPSHOT_KEY, snap);
  }

  /** Mount: a snapshot of this session resumes it (paused), else the stash or /next. */
  start(stash: NextResponse | null): void {
    const snap = stash ? null : readSnapshot(this.config.sessionId);
    if (snap) {
      const t = restoreRunner(snap, this.config, Date.now());
      this.view = { ...this.view, restored: true };
      this.commit(t.state, t.effects);
      return;
    }
    this.dispatch({ type: 'boot', stash });
  }

  /** Runs one event through the reducer. False when the board must take the move back. */
  dispatch = (event: RunnerEventInput): boolean => {
    if (this.disposed) return false;
    if (event.type === 'resume' && this.view.restored) this.view = { ...this.view, restored: false };
    const { state, effects } = runnerReducer(this.view.state, { ...event, at: Date.now() } as RunnerEvent);
    return this.commit(state, effects);
  };

  closeExit = (): void => {
    if (!this.view.exitOpen) return;
    this.view = { ...this.view, exitOpen: false };
    this.notify();
  };

  dispose(): void {
    this.disposed = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    if (this.e2eTimer) clearTimeout(this.e2eTimer);
    this.listeners.clear();
    this.board = null;
  }

  // ─── Effects ──────────────────────────────────────────────────────────

  private commit(state: RunnerState, effects: RunnerEffect[]): boolean {
    const changed = state !== this.view.state;
    if (changed) this.view = { ...this.view, state };
    let accepted = true;
    for (const fx of effects) {
      if (fx.type === 'rejectMove') accepted = false;
      else this.run(fx);
    }
    if (changed || effects.some((fx) => fx.type === 'confirmExit')) this.notify();
    if (this.e2e || this.e2eQueue.length > 0) this.armE2E();
    return accepted;
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  private run(fx: Exclude<RunnerEffect, { type: 'rejectMove' }>): void {
    const board = this.board;
    switch (fx.type) {
      case 'reset':
        board?.reset(fx.fen, fx.orientation);
        return;
      case 'setPosition':
        void board?.setPosition(fx.fen, fx.lastMove, fx.ms);
        return;
      case 'animate': {
        if (!board) {
          this.dispatch(fx.done);
          return;
        }
        board.animateMove(fx.from, fx.to, fx.ms, fx.promotion).then(
          () => this.dispatch(fx.done),
          () => {
            // The board refused the slide (out of sync): land the runner
            // anyway and snap the board to the runner's position.
            this.dispatch(fx.done);
            const s = this.view.state;
            if (s.fen) void this.board?.setPosition(s.fen, s.lastMove, 0);
          },
        );
        return;
      }
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
      case 'feel':
        feel.emit(fx.event, fx.ctx);
        return;
      case 'api':
        if (fx.call === 'finish') this.captureCeiling();
        this.callApi(fx);
        return;
      case 'schedule': {
        const prev = this.timers.get(fx.id);
        if (prev) clearTimeout(prev);
        this.timers.set(
          fx.id,
          setTimeout(() => {
            this.timers.delete(fx.id);
            this.dispatch(fx.event);
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
      case 'patchProgression':
        appStore.getState().patchStyleProgression(fx.style, { currentPuzzleRating: fx.currentPuzzleRating });
        return;
      case 'confirmExit':
        this.view = { ...this.view, exitOpen: true };
        return;
      case 'finished':
        this.onFinished(fx.response);
        return;
      case 'exit':
        // A discard rolls the server rating back to the session's start, but
        // the store still holds the per-attempt patches: refetch /users/me.
        void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
        this.onExit?.();
        return;
      case 'persistSnapshot': {
        const snap = toSnapshot(this.view.state, Date.now());
        if (snap) writeJSON(sessionKV, SNAPSHOT_KEY, snap);
        else sessionKV.remove(SNAPSHOT_KEY);
        return;
      }
      case 'clearSnapshot':
        sessionKV.remove(SNAPSHOT_KEY);
        return;
    }
  }

  private callApi(fx: ApiEffect): void {
    const { reqId } = fx;
    const fail = (e: unknown) =>
      this.dispatch({ type: 'apiError', call: fx.call, reqId, status: isApiError(e) ? e.status : undefined });
    switch (fx.call) {
      case 'next':
        api.sessions.next(fx.payload.sessionId).then(
          (data) => this.dispatch({ type: 'apiOk', call: 'next', reqId, data }),
          fail,
        );
        return;
      case 'attempt': {
        const { sessionId, ...body } = fx.payload;
        api.sessions.attempt(sessionId, body).then(
          (data) => this.dispatch({ type: 'apiOk', call: 'attempt', reqId, data }),
          fail,
        );
        return;
      }
      case 'finish':
        // localDate is stamped at send time (the reducer never reads a clock).
        api.sessions
          .finish(fx.payload.sessionId, { save: fx.payload.save, localDate: formatLocalDate(new Date()) })
          .then(
            (data: ApiFinishResponse) =>
              this.dispatch({ type: 'apiOk', call: 'finish', reqId, data: data as unknown as FinishResponse }),
            fail,
          );
        return;
      case 'detail':
        api.sessions.detail(fx.payload.sessionId).then(
          (d) =>
            this.dispatch({
              type: 'apiOk',
              call: 'detail',
              reqId,
              data: { solved: d.solved, failed: d.failed, accuracy: d.accuracy, avgResponseMs: d.avgResponseMs, peakRating: d.peakRating },
            }),
          fail,
        );
        return;
    }
  }

  private captureCeiling() {
    const style = this.view.state.style;
    const ceilingBefore = style ? appStore.getState().progressions[style].unlockedStartRating : null;
    this.view = { ...this.view, ceilingBefore };
  }

  /**
   * web finish(): daily streak into the store and achievement toasts.
   * fix: the web never patched the progression and relied on the full
   * page loads of its summary links; here the norm, calibration count and
   * weak streak come from the response at once, so Home and the setup are
   * right before ['me'] revalidates.
   */
  private onFinished(r: FinishResponse): void {
    const store = appStore.getState();
    const { t } = translatorFor(store.settings.language);
    if (r.streak) {
      const { days, freezes, lastDay, freezeRegenAt } = r.streak;
      store.setStreak({ days, freezes, lastDay, freezeRegenAt });
      // The freeze is spent silently on the server: say why the streak lived.
      if (r.streak.outcome === 'frozen') {
        toast.show({ title: t('streak.outcome_frozen'), description: t('streak.outcome_frozen_hint') });
      }
    }
    const style = this.view.state.style;
    const patch = this.view.state.sessionMode === 'theme' ? null : progressionPatchOf(r);
    if (style && patch) store.patchStyleProgression(style, patch);
    toast.achievements(r.achievementsUnlocked, t);
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsAll() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsThemesAll() });
  }

  // ─── Dev / E2E hooks ──────────────────────────────────────────────────
  // Moves go through the same path as a board move (dispatch 'move'); the
  // board is then brought along, since nobody dragged its piece.

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
    const s = this.view.state;
    if (s.phase !== 'playerTurn' || s.paused || s.anim || !s.puzzle) return;
    // Outside the reducer's call stack.
    this.e2eTimer = setTimeout(() => {
      this.e2eTimer = null;
      this.runE2E();
    }, 0);
  }

  /**
   * Taps queue up (one per puzzle), so a flow can fire them without
   * waiting: each one starts on the next ready puzzle; a solve keeps
   * playing its puzzle's line through the opponent's replies.
   */
  private runE2E() {
    const s = this.view.state;
    if (s.phase !== 'playerTurn' || s.paused || s.anim || !s.puzzle || !s.fen) return;
    if (this.e2e && this.e2e.puzzleId !== s.puzzle.id) this.e2e = null;
    if (!this.e2e) {
      const kind = this.e2eQueue.shift();
      if (!kind) return;
      this.e2e = { kind, puzzleId: s.puzzle.id };
    }
    const uci = this.e2e.kind === 'solve' ? s.remaining[0] : wrongMove(s.fen, s.remaining[0]);
    if (!uci) {
      this.e2e = null;
      return;
    }
    const m = parseUci(uci);
    const before = s.fen;
    const accepted = this.dispatch({ type: 'move', from: m.from, to: m.to, promotion: m.promotion });
    if (accepted) {
      const after = new Chess(before);
      after.move({ from: m.from, to: m.to, promotion: m.promotion });
      void this.board?.setPosition(after.fen(), { from: m.from as Square, to: m.to as Square }, 120);
    }
  }
}

/** A legal move that is neither the expected one nor a mate (an e2e mistake). */
function wrongMove(fen: string, expected: string | undefined): string | null {
  const c = new Chess(fen);
  for (const m of c.moves({ verbose: true })) {
    const uci = uciFromMove({ from: m.from, to: m.to, promotion: m.promotion });
    if (uci === expected) continue;
    const probe = new Chess(fen);
    probe.move(m);
    if (!probe.isCheckmate()) return uci;
  }
  return null;
}
