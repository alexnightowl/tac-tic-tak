import { describe, expect, it } from 'vitest';
import {
  comboBar,
  comboBonusMs,
  hardestSolved,
  raceBase,
  raceVerdict,
  stormClock,
  stormInit,
  stormLadder,
  stormReduce,
  type StormEvent,
  type StormState,
} from '../src/storm';
import type { ServerPuzzle } from '../src/puzzle';
import {
  STORM_REVEAL_MS,
  STORM_SOLVED_PAUSE_MS,
  STORM_WRONG_HOLD_MS,
  createPractice,
  practiceReducer,
  type PracticeEffect,
  type PracticeEvent,
  type PracticeState,
} from '../src/runner';

const run = (s: StormState, events: StormEvent[]) => events.reduce(stormReduce, s);
const T0 = 1_000_000;

describe('storm engine', () => {
  it('counts solves, builds the combo and buys time at 5 and 10', () => {
    const solves = Array.from({ length: 10 }, (_, k) => ({ type: 'solve' as const, at: T0 + (k + 1) * 1000 }));
    const s = run(stormInit('time3'), [{ type: 'start', at: T0 }, ...solves]);
    expect(s).toMatchObject({ score: 10, combo: 10, bestCombo: 10, index: 10, extraMs: 8000, lastSolveMs: 10_000, ended: null });
    expect(stormClock(s, T0 + 10_000)).toBe(180_000 + 8000 - 10_000);
    expect(s.results[3]).toEqual({ i: 3, ok: true, ms: 1000 });
  });

  it('a mistake costs a life, 10 s and the combo; three end the run', () => {
    let s = run(stormInit('time3'), [
      { type: 'start', at: T0 },
      { type: 'solve', at: T0 + 1000 },
      { type: 'miss', at: T0 + 2000 },
    ]);
    expect(s).toMatchObject({ lives: 2, combo: 0, mistakes: 1, extraMs: -10_000, bestCombo: 1 });
    s = run(s, [{ type: 'miss', at: T0 + 3000 }, { type: 'miss', at: T0 + 4000 }]);
    expect(s).toMatchObject({ ended: 'lives', endedAt: T0 + 4000, mistakes: 3 });
    expect(stormReduce(s, { type: 'solve', at: T0 + 5000 })).toBe(s);
  });

  it('ends at the deadline and ignores a late answer', () => {
    const s = run(stormInit('time3'), [{ type: 'start', at: T0 }, { type: 'solve', at: T0 + 181_000 }]);
    expect(s).toMatchObject({ ended: 'time', endedAt: T0 + 180_000, score: 0 });
    expect(stormClock(s, T0 + 999_999)).toBe(0);
  });

  it('a penalty can run the clock out at once', () => {
    const s = run(stormInit('time3'), [{ type: 'start', at: T0 }, { type: 'miss', at: T0 + 175_000 }]);
    expect(s).toMatchObject({ ended: 'time', mistakes: 1, endedAt: T0 + 170_000 });
  });

  it('Survival has no clock and no bonus', () => {
    const s = run(stormInit('survival'), [{ type: 'start', at: T0 }, ...Array.from({ length: 5 }, (_, k) => ({ type: 'solve' as const, at: T0 + 600_000 * (k + 1) }))]);
    expect(s).toMatchObject({ score: 5, extraMs: 0, ended: null });
    expect(stormClock(s, T0)).toBeNull();
  });

  it('ends when the stream runs out, and on quit', () => {
    expect(run(stormInit('time3', 2), [{ type: 'start', at: T0 }, { type: 'solve', at: T0 + 1 }, { type: 'solve', at: T0 + 2 }]).ended).toBe('stream');
    expect(run(stormInit('time3'), [{ type: 'start', at: T0 }, { type: 'quit', at: T0 + 5 }])).toMatchObject({ ended: 'quit', endedAt: T0 + 5 });
  });
});

describe('storm helpers', () => {
  it('combo bonuses and the bar', () => {
    expect([0, 4, 5, 9, 10, 15, 20].map(comboBonusMs)).toEqual([0, 0, 3000, 0, 5000, 3000, 5000]);
    expect(comboBar(0)).toMatchObject({ filled: 0, nextAt: 5 });
    expect(comboBar(6)).toMatchObject({ filled: 6, nextAt: 10, nextBonusMs: 5000 });
    expect(comboBar(10).filled).toBe(10);
    expect(comboBar(11)).toMatchObject({ filled: 1, nextAt: 5 });
  });

  it('the ladder rises fast, then flattens', () => {
    expect(stormLadder(0, 1000)).toBe(1000);
    expect(stormLadder(10, 1000)).toBe(1290);
    expect(stormLadder(35, 1000)).toBe(1810);
    expect(stormLadder(99, 1000)).toBe(2380);
  });

  it('race base sits under both ratings, clamped', () => {
    expect(raceBase(1654, 1612)).toEqual({ base: 1030, avg: 1633 });
    expect(raceBase(500, 600).base).toBe(600);
    expect(raceBase(2700, 2700).base).toBe(1800);
  });

  it('race verdict: solved, then the earlier last solve', () => {
    expect(raceVerdict({ score: 15, lastSolveMs: 9 }, { score: 13, lastSolveMs: 1 })).toEqual({ verdict: 'win', byTime: false });
    expect(raceVerdict({ score: 14, lastSolveMs: 170_000 }, { score: 14, lastSolveMs: 175_000 })).toEqual({ verdict: 'win', byTime: true });
    expect(raceVerdict({ score: 14, lastSolveMs: 175_000 }, { score: 14, lastSolveMs: 170_000 }).verdict).toBe('loss');
    expect(raceVerdict({ score: 0, lastSolveMs: 0 }, { score: 0, lastSolveMs: 0 }).verdict).toBe('draw');
  });

  it('hardest solved skips mistakes', () => {
    expect(hardestSolved([{ i: 0, ok: true, ms: 1 }, { i: 2, ok: false, ms: 1 }, { i: 1, ok: true, ms: 1 }], [1000, 1100, 1900])).toBe(1100);
    expect(hardestSolved([], [1000])).toBeNull();
  });
});

// ─── The storm practice mode (runner/modes) ──────────────────────────────

// Real Lichess 00008: setup f2g3, then e6e7 (player) b2b1 (reply) b3c1 b1c1 h6c1.
const LONG: ServerPuzzle = {
  id: '00008', fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'], rating: 1913, themes: ['crushing', 'fork'], gameUrl: null,
};

function stormDriver() {
  let s: PracticeState = createPractice({ mode: 'storm', animMs: 100, fixedColor: 'auto' });
  let fx: PracticeEffect[] = [];
  const send = (e: PracticeEvent) => {
    const r = practiceReducer(s, e);
    s = r.state;
    fx = r.effects;
    return fx;
  };
  return {
    get s() { return s; },
    get fx() { return fx; },
    send,
    move: (uci: string) => send({ type: 'move', from: uci.slice(0, 2) as 'a1', to: uci.slice(2, 4) as 'a1' }),
  };
}

describe('practice: storm mode', () => {
  it('a wrong move holds, reveals the right move from the position before it, then asks for the next puzzle', () => {
    const d = stormDriver();
    d.send({ type: 'start', items: [{ puzzle: LONG }] });
    d.send({ type: 'animationDone', id: d.s.anim!.id });
    const before = d.s.fen;
    d.move('e6e5');
    expect(d.s.phase).toBe('rewinding');
    expect(d.s.fen).toBe(before);
    expect(d.fx).toContainEqual({ type: 'schedule', id: 'rewind', ms: STORM_WRONG_HOLD_MS });
    expect(d.fx).toContainEqual({ type: 'feel', event: 'mistake' });
    d.send({ type: 'timer', id: 'rewind' });
    expect(d.s.phase).toBe('revealing');
    expect(d.s.lastMove).toEqual({ from: 'e6', to: 'e7' });
    expect(d.fx).toContainEqual(expect.objectContaining({ type: 'setPosition', lastMove: { from: 'e6', to: 'e7' } }));
    expect(d.fx).toContainEqual({ type: 'schedule', id: 'advance', ms: 100 + STORM_REVEAL_MS });
    d.send({ type: 'timer', id: 'advance' });
    expect(d.s.phase).toBe('advancing');
    expect(d.fx).toContainEqual(expect.objectContaining({ type: 'advance', puzzleId: '00008' }));
  });

  it('a solve moves on after the short storm pause', () => {
    const d = stormDriver();
    const MATE: ServerPuzzle = { id: 'm', fen: '6k1/2p2ppp/8/8/8/8/1R6/R5K1 b - - 0 1', moves: ['c7c6', 'a1a8'], rating: 1300, themes: [], gameUrl: null };
    d.send({ type: 'start', items: [{ puzzle: MATE }] });
    d.send({ type: 'animationDone', id: d.s.anim!.id });
    d.move('b2b8'); // the other mate counts
    expect(d.s.phase).toBe('solved');
    expect(d.fx).toContainEqual({ type: 'schedule', id: 'advance', ms: STORM_SOLVED_PAUSE_MS });
  });
});
