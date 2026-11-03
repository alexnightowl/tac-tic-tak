import type { PracticeItem, PracticeState } from '@tac/core/runner';
import {
  comboBonusMs,
  stormClockMs,
  stormInit,
  stormReduce,
  type StormEvent,
  type StormFormat,
  type StormState,
  type StormStreamResponse,
} from '@tac/core/storm';

import type { BoardHandle } from '@/board';
import { feel } from '@/feel';
import { newClientId, stormStore, type StormLive, type StormLocalRun } from './store';
import { requestStormSync } from './sync';

// One Storm / Race run outside React: the @tac/core/storm engine, the
// live snapshot (saved after every change), and the bridge from the
// practice runner (a solve / a wrong move on the board) to engine events.
// Screens read the immutable `snap` through useSyncExternalStore; the
// clock components read `deadline()` on their own timers.

export type RunSnap = {
  state: StormState;
  /** Stream index of the puzzle on the board. */
  shown: number;
  /** The last combo bonus (ms) and a counter that changes with each one. */
  bonus: { ms: number; seq: number };
  /** The finished local run, once ended. */
  finished: StormLocalRun | null;
};

export class StormRun {
  readonly live: StormLive;
  private snap: RunSnap;
  private listeners = new Set<() => void>();
  private answered = -1;
  private board: BoardHandle | null = null;

  constructor(
    readonly stream: StormStreamResponse,
    readonly format: StormFormat,
    readonly challengeId: string | null,
  ) {
    const state = stormInit(format, stream.puzzles.length);
    this.live = {
      clientId: newClientId(),
      streamId: stream.streamId,
      format,
      challengeId,
      ids: stream.puzzles.map((p) => p.id),
      ratings: stream.puzzles.map((p) => p.rating),
      state,
      savedAt: Date.now(),
    };
    this.snap = { state, shown: 0, bonus: { ms: 0, seq: 0 }, finished: null };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnap = (): RunSnap => this.snap;

  setBoard(h: BoardHandle | null) {
    this.board = h;
  }

  /** Epoch ms when the clock runs out; null for Survival or before the start. */
  deadline(): number | null {
    const s = this.snap.state;
    const total = stormClockMs(s.format);
    if (total == null || s.startedAt == null) return null;
    return s.startedAt + total + s.extraMs;
  }

  item(i: number): PracticeItem {
    const p = this.stream.puzzles[i];
    return { puzzle: { id: p.id, fen: p.fen, moves: p.moves, rating: p.rating, themes: p.themes, gameUrl: null } };
  }

  /** The practice runner's `advance` hook: the next stream puzzle, or null once the run is over. */
  advance = async (): Promise<PracticeItem | null> => {
    // A line the board could not play (never seen with the server's quality
    // floor): it counts as a mistake so the stream index stays in step.
    if (this.answered < this.snap.shown && !this.snap.state.ended) this.send({ type: 'miss', at: Date.now() });
    const s = this.snap.state;
    if (s.ended || s.index >= this.stream.puzzles.length) return null;
    this.snap = { ...this.snap, shown: s.index };
    this.emit();
    return this.item(s.index);
  };

  /** Watches the practice runner: its first turn starts the clock, a solve or a wrong move is an answer. */
  onPractice = (p: PracticeState) => {
    const s = this.snap.state;
    if (s.ended || p.item?.puzzle.id !== this.stream.puzzles[this.snap.shown]?.id) return;
    const now = Date.now();
    if (s.startedAt == null && p.phase === 'playerTurn') this.send({ type: 'start', at: now });
    if (this.answered >= this.snap.shown) return;
    if (p.phase === 'solved') {
      this.answered = this.snap.shown;
      this.send({ type: 'solve', at: now });
    } else if (p.phase === 'rewinding') {
      this.answered = this.snap.shown;
      this.send({ type: 'miss', at: now });
    }
  };

  tick(at = Date.now()) {
    this.send({ type: 'tick', at });
  }

  quit(at = Date.now()) {
    if (this.snap.state.startedAt == null) this.send({ type: 'start', at });
    this.send({ type: 'quit', at });
  }

  private send(e: StormEvent) {
    const prev = this.snap.state;
    const state = stormReduce(prev, e);
    if (state === prev) return;
    let bonus = this.snap.bonus;
    if (e.type === 'solve' && !state.ended) {
      const ms = stormClockMs(state.format) != null ? comboBonusMs(state.combo) : 0;
      if (ms > 0) {
        bonus = { ms, seq: bonus.seq + 1 };
        feel.emit('streakUp', { streak: state.combo });
      }
    }
    let finished = this.snap.finished;
    const live: StormLive = { ...this.live, state, savedAt: e.at };
    if (state.ended && !prev.ended) {
      this.board?.setInteractive(false);
      finished = stormStore.getState().finish(live, state);
      void requestStormSync('run');
      feel.emit('normGateUp');
    } else {
      stormStore.getState().setLive(live);
    }
    this.snap = { ...this.snap, state, bonus, finished };
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }
}
