import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { ServerPuzzle } from '../src/puzzle';
import { parseUci, uciFromMove } from '../src/puzzle';
import { hasteMs } from '../src/rules';
import {
  HASTE_NUDGE_RUN, createRunner, restoreRunner, runnerReducer, toSnapshot,
  type NextResponse, type RunnerEffect, type RunnerEventInput, type RunnerSnapshot, type RunnerState,
} from '../src/runner';

// Haste (D40): the runner measures the thinking time on the move that went
// wrong (mistakeMs), counts hasty mistakes and raises a one-time nudge.

const MATE: ServerPuzzle = {
  id: 'mate', fen: '6k1/2p2ppp/8/8/8/8/1R6/R5K1 b - - 0 1', moves: ['c7c6', 'a1a8'], rating: 1300, themes: ['mateIn1'], gameUrl: null,
};
// Lichess 00008: setup f2g3, then e6e7 (player) b2b1 (reply) b3c1 b1c1 h6c1.
const LONG: ServerPuzzle = {
  id: '00008', fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'], rating: 1913, themes: ['crushing'], gameUrl: null,
};

const next = (puzzle: ServerPuzzle, style: 'bullet' | 'blitz' | 'rapid' = 'blitz'): NextResponse => ({
  puzzle, currentRating: 1200, session: { id: 's1', startedAt: '2026-11-10T10:00:00Z', durationSec: 600, style, mode: 'mixed' },
});

const T0 = 1_000_000;
const CONFIG = { mode: 'session' as const, sessionId: 's1', animMs: 280, fixedColor: 'auto' as const };

class Driver {
  s: RunnerState = createRunner(CONFIG);
  fx: RunnerEffect[] = [];
  send(e: RunnerEventInput, at: number) {
    const r = runnerReducer(this.s, { ...e, at } as Parameters<typeof runnerReducer>[1]);
    this.s = r.state;
    this.fx = r.effects;
    return r.effects;
  }
  attempt() {
    return this.fx.filter((f) => f.type === 'api' && f.call === 'attempt').pop() as Extract<RunnerEffect, { type: 'api'; call: 'attempt' }> | undefined;
  }
  /** Boot a puzzle (or load it as the next one) and land its setup at `at`. */
  load(p: ServerPuzzle, at: number, style: 'bullet' | 'blitz' | 'rapid' = 'blitz') {
    if (this.s.phase === 'booting') this.send({ type: 'boot', stash: next(p, style) }, at - 300);
    else {
      this.send({ type: 'timer', id: 'next' }, at - 400);
      const req = this.fx.find((f) => f.type === 'api' && f.call === 'next') as Extract<RunnerEffect, { type: 'api' }>;
      this.send({ type: 'apiOk', call: 'next', reqId: req.reqId, data: next(p, style) }, at - 300);
    }
    this.send({ type: 'animationDone', id: this.s.anim!.id }, at);
    return this;
  }
  /** A legal, non-mating move that isn't the expected one. */
  wrong(at: number) {
    const s = this.s;
    const c = new Chess(s.fen!);
    const m = c.moves({ verbose: true }).find((mv) => {
      if (uciFromMove({ from: mv.from, to: mv.to, promotion: mv.promotion }) === s.remaining[0]) return false;
      const probe = new Chess(s.fen!);
      probe.move(mv);
      return !probe.isCheckmate();
    })!;
    this.send({ type: 'move', from: m.from as 'a1', to: m.to as 'a1' }, at);
    return this;
  }
  right(at: number) {
    const m = parseUci(this.s.remaining[0]);
    this.send({ type: 'move', from: m.from, to: m.to, promotion: m.promotion }, at);
    return this;
  }
  /** Confirm the in-flight attempt. */
  ack(at: number) {
    this.send({ type: 'apiOk', call: 'attempt', reqId: this.s.pendingAttempt!.reqId!, data: { newRating: 1200, step: 0, streak: 0 } }, at);
    return this;
  }
}

describe('runner haste: mistakeMs', () => {
  it('a wrong move sends mistakeMs from the setup landing; a hasty one counts', () => {
    const d = new Driver().load(MATE, T0).wrong(T0 + 2000);
    expect(d.attempt()).toMatchObject({ payload: { correct: false, responseMs: 2000, mistakeMs: 2000 } });
    expect(d.s.pendingAttempt).toMatchObject({ mistakeMs: 2000 });
    expect(2000).toBeLessThan(hasteMs('blitz'));
    expect(d.s.counters).toMatchObject({ failed: 1, hasty: 1 });
  });

  it('a solve sends no mistakeMs and counts nothing', () => {
    const d = new Driver().load(MATE, T0).right(T0 + 1000);
    expect(d.attempt()!.payload).not.toHaveProperty('mistakeMs');
    expect(d.s.counters.hasty).toBe(0);
  });

  it('a calm mistake (over the style threshold) is not hasty', () => {
    const d = new Driver().load(MATE, T0, 'bullet').wrong(T0 + hasteMs('bullet'));
    expect(d.attempt()!.payload.mistakeMs).toBe(hasteMs('bullet'));
    expect(d.s.counters).toMatchObject({ failed: 1, hasty: 0 });
  });

  it('after an opponent reply the clock restarts for the next move', () => {
    const d = new Driver().load(LONG, T0).right(T0 + 5000);
    d.send({ type: 'timer', id: 'opponentReply' }, T0 + 5280);
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 5560);
    expect(d.s.moveStartedAt).toBe(T0 + 5560);
    d.wrong(T0 + 6560);
    // responseMs is the whole puzzle (web), mistakeMs only the move that went wrong.
    expect(d.attempt()).toMatchObject({ payload: { correct: false, responseMs: 6560, mistakeMs: 1000 } });
    expect(d.s.counters.hasty).toBe(1);
  });

  it('pause time is not thinking time', () => {
    const d = new Driver().load(MATE, T0);
    d.send({ type: 'pause', source: 'user' }, T0 + 1000);
    d.send({ type: 'resume', source: 'user' }, T0 + 61_000);
    d.wrong(T0 + 62_000);
    expect(d.attempt()!.payload.mistakeMs).toBe(2000);
  });
});

describe('runner haste: the nudge', () => {
  it(`fires once, on the ${HASTE_NUDGE_RUN}nd hasty mistake in a row`, () => {
    const d = new Driver().load(MATE, T0).wrong(T0 + 800).ack(T0 + 900);
    expect(d.s.hasteNudge).toBeNull();
    d.load(MATE, T0 + 2000).wrong(T0 + 3200);
    expect(d.s.hastyRun).toBe(2);
    expect(d.s.hasteNudge).toEqual({ mistakeMs: 1200, at: T0 + 3200 });
    const first = d.s.hasteNudge;
    d.ack(T0 + 3300).load(MATE, T0 + 4000).wrong(T0 + 4500);
    expect(d.s.hasteNudge).toBe(first);
    expect(d.s.counters.hasty).toBe(3);
  });

  it('a solve or a calm mistake between hasty ones resets the run', () => {
    const d = new Driver().load(MATE, T0).wrong(T0 + 800).ack(T0 + 900);
    d.load(MATE, T0 + 2000).right(T0 + 2500).ack(T0 + 2600);
    d.load(MATE, T0 + 4000).wrong(T0 + 4500).ack(T0 + 4600);
    expect(d.s.hastyRun).toBe(1);
    d.load(MATE, T0 + 6000).wrong(T0 + 16_000).ack(T0 + 16_100);
    expect(d.s.hastyRun).toBe(0);
    d.load(MATE, T0 + 18_000).wrong(T0 + 18_500);
    expect(d.s.hasteNudge).toBeNull();
    expect(d.s.counters).toMatchObject({ failed: 4, hasty: 3 });
  });
});

describe('runner haste: snapshot', () => {
  it('keeps the move clock, the counter and the pending mistakeMs', () => {
    const d = new Driver().load(MATE, T0);
    const snap = toSnapshot(d.s, T0 + 700)!;
    expect(snap.moveElapsedMs).toBe(700);
    const r = restoreRunner(snap, CONFIG, T0 + 100_000);
    expect(r.state.moveStartedAt).toBe(T0 + 100_000 - 700);

    d.wrong(T0 + 1000);
    const snap2 = toSnapshot(d.s, T0 + 1050)!;
    expect(snap2).toMatchObject({ stage: 'attempt', counters: { hasty: 1 }, pendingAttempt: { mistakeMs: 1000 } });
    const r2 = restoreRunner(JSON.parse(JSON.stringify(snap2)) as RunnerSnapshot, CONFIG, T0 + 2000);
    const d2 = new Driver();
    d2.s = r2.state;
    d2.send({ type: 'resume', source: 'user' }, T0 + 3000);
    expect(d2.attempt()).toMatchObject({ payload: { correct: false, mistakeMs: 1000 } });
  });

  it('an older snapshot (no haste fields) restores with zero', () => {
    const d = new Driver().load(MATE, T0);
    const snap = toSnapshot(d.s, T0 + 500)! as Partial<RunnerSnapshot> & RunnerSnapshot;
    const { hasty: _h, ...counters } = snap.counters;
    const old = { ...snap, counters, moveElapsedMs: undefined, hastyRun: undefined, hasteNudged: undefined } as unknown as RunnerSnapshot;
    const r = restoreRunner(old, CONFIG, T0 + 10_000);
    expect(r.state.counters.hasty).toBe(0);
    expect(r.state.moveStartedAt).toBe(T0 + 10_000 - 500);
    expect(r.state.hasteNudge).toBeNull();
  });

  it('a nudge shown before a kill does not come back', () => {
    const d = new Driver().load(MATE, T0).wrong(T0 + 800).ack(T0 + 900);
    d.load(MATE, T0 + 2000).wrong(T0 + 2500).ack(T0 + 2600);
    d.send({ type: 'timer', id: 'next' }, T0 + 3000);
    const req = d.fx.find((f) => f.type === 'api' && f.call === 'next') as Extract<RunnerEffect, { type: 'api' }>;
    d.send({ type: 'apiOk', call: 'next', reqId: req.reqId, data: next(MATE) }, T0 + 3100);
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 3400);
    const r = restoreRunner(toSnapshot(d.s, T0 + 3500)!, CONFIG, T0 + 5000);
    expect(r.state.hasteNudge).toEqual({ mistakeMs: 0, at: 0 });
  });
});
