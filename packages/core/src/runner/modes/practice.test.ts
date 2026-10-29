import { describe, expect, it } from 'vitest';
import type { ServerPuzzle } from '../../puzzle';
import { SOLVED_PAUSE_MS } from '../../puzzle';
import {
  REPEAT_SLIDE_MS, REWIND_DELAY_MS, canHint, createPractice, drillCounterOf, e2eWrongMove, nextReviewPuzzleId,
  normalizeMoves, practiceReducer, practiceTitleOf, sessionItemToPractice, solutionStepOf, tacticalThemes,
  type PracticeConfig, type PracticeEffect, type PracticeEvent, type PracticeState,
} from './index';

// Two mates after the setup c7c6: the listed Ra8# and the alternative Rb8#.
const MATE: ServerPuzzle = {
  id: 'mate', fen: '6k1/2p2ppp/8/8/8/8/1R6/R5K1 b - - 0 1', moves: ['c7c6', 'a1a8'], rating: 1300, themes: ['mateIn1', 'endgame'], gameUrl: null,
};
// Real Lichess 00008: setup f2g3, then e6e7 (player) b2b1 (reply) b3c1 b1c1 h6c1.
const LONG: ServerPuzzle = {
  id: '00008', fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'], rating: 1913, themes: ['crushing', 'fork'], gameUrl: null,
};

class Driver {
  s: PracticeState;
  fx: PracticeEffect[] = [];
  constructor(config: Partial<PracticeConfig> & Pick<PracticeConfig, 'mode'>) {
    this.s = createPractice({ animMs: 280, fixedColor: 'auto', ...config });
  }
  send(e: PracticeEvent) {
    const r = practiceReducer(this.s, e);
    this.s = r.state;
    this.fx = r.effects;
    return r.effects;
  }
  last<T extends PracticeEffect['type']>(type: T) {
    return this.fx.filter((f) => f.type === type).pop() as Extract<PracticeEffect, { type: T }> | undefined;
  }
  types() {
    return this.fx.map((f) => (f.type === 'feel' ? `feel:${f.event}` : f.type));
  }
  land() {
    return this.send({ type: 'animationDone', id: this.s.anim!.id });
  }
  move(uci: string) {
    return this.send({ type: 'move', from: uci.slice(0, 2) as 'a1', to: uci.slice(2, 4) as 'a1', promotion: uci.slice(4) || undefined });
  }
  timer(id: 'reply' | 'rewind' | 'advance') {
    return this.send({ type: 'timer', id });
  }
}

describe('practice: load and setup', () => {
  it('start resets to the pre-setup FEN and slides the setup move, then the player turn', () => {
    const d = new Driver({ mode: 'drill' });
    d.send({ type: 'start', items: [{ puzzle: LONG }], counterIds: ['00008', 'x'] });
    expect(d.types()).toEqual(['interactive', 'reset', 'animate']);
    expect(d.last('reset')).toMatchObject({ fen: LONG.fen, orientation: 'white' });
    expect(d.last('animate')).toMatchObject({ from: 'f2', to: 'g3', ms: 280 });
    expect(d.s.phase).toBe('setupAnimating');
    d.land();
    expect(d.s.phase).toBe('playerTurn');
    expect(d.types()).toEqual(['feel:opponentLanding', 'interactive']);
    expect(d.s.lastMove).toEqual({ from: 'f2', to: 'g3' });
  });

  it('fixedColor is honoured in every mode (Q13)', () => {
    const d = new Driver({ mode: 'viewer', fixedColor: 'black' });
    d.send({ type: 'start', items: [{ puzzle: LONG }] });
    expect(d.s.orientation).toBe('black');
    expect(d.s.playerColor).toBe('w');
  });

  it('an empty start is done at once', () => {
    const d = new Driver({ mode: 'mistakes' });
    d.send({ type: 'start', items: [] });
    expect(d.s.phase).toBe('done');
  });

  it('a broken line in the mistakes queue is skipped', () => {
    const d = new Driver({ mode: 'mistakes' });
    const bad: ServerPuzzle = { ...MATE, id: 'bad', moves: ['a1a1'] };
    d.send({ type: 'start', items: [{ puzzle: bad }, { puzzle: MATE }] });
    expect(d.s.phase).toBe('swapping');
    expect(d.s.incoming?.puzzle.id).toBe('mate');
  });
});

describe('practice: moves', () => {
  it('a correct move plays its feel, blocks input, and the reply lands after max(animMs, 80)', () => {
    const d = new Driver({ mode: 'drill' });
    d.send({ type: 'start', items: [{ puzzle: LONG }] });
    d.land();
    d.move('e6e7');
    expect(d.s.phase).toBe('opponentReplying');
    expect(d.types()).toEqual(['feel:capture', 'interactive', 'schedule']);
    expect(d.last('schedule')).toMatchObject({ id: 'reply', ms: 280 });
    // fix: no input during the reply (the web drill accepted it).
    d.move('h6h7');
    expect(d.types()).toEqual(['rejectMove']);
    d.timer('reply');
    expect(d.last('animate')).toMatchObject({ from: 'b2', to: 'b1' });
    d.land();
    expect(d.s.phase).toBe('playerTurn');
    expect(d.s.remaining).toEqual(['b3c1', 'b1c1', 'h6c1']);
  });

  it('a wrong move flashes, shakes, then rewinds with a slide to the start after 520 ms', () => {
    const d = new Driver({ mode: 'mistakes' });
    d.send({ type: 'start', items: [{ puzzle: LONG, reason: 'failed' }] });
    d.land();
    d.move('e6e7');
    d.timer('reply');
    d.land();
    d.move(e2eWrongMove(d.s.fen!, d.s.remaining[0])!);
    expect(d.s.phase).toBe('rewinding');
    expect(d.types()).toEqual(['interactive', 'feel:mistake', 'flash', 'shake', 'schedule']);
    expect(d.last('schedule')).toMatchObject({ id: 'rewind', ms: REWIND_DELAY_MS });
    expect(d.s.failedTries).toBe(1);
    d.timer('rewind');
    expect(d.last('setPosition')).toMatchObject({ lastMove: { from: 'f2', to: 'g3' }, ms: 280 });
    expect(d.s.phase).toBe('playerTurn');
    expect(d.s.remaining).toEqual(LONG.moves.slice(1));
    expect(d.s.rewinds).toBe(1);
  });

  it('an illegal move is taken back; the alternative mate solves', () => {
    const d = new Driver({ mode: 'viewer' });
    d.send({ type: 'start', items: [{ puzzle: MATE }] });
    d.land();
    d.move('a1h8');
    expect(d.types()).toEqual(['rejectMove']);
    d.move('b2b8');
    expect(d.s.phase).toBe('solved');
    expect(d.types()).toContain('feel:correct');
    // The viewer never advances.
    expect(d.types()).not.toContain('schedule');
  });
});

describe('practice: hints', () => {
  it('level 1 rings the from-square, level 2 adds the target, then stops; a correct move clears it', () => {
    const d = new Driver({ mode: 'drill' });
    d.send({ type: 'start', items: [{ puzzle: LONG }] });
    expect(canHint(d.s)).toBe(false);
    d.land();
    d.send({ type: 'hint' });
    expect(d.last('hint')).toEqual({ type: 'hint', level: 1, from: 'e6', to: null });
    expect(d.types()).toContain('feel:pickup');
    d.send({ type: 'hint' });
    expect(d.last('hint')).toEqual({ type: 'hint', level: 2, from: 'e6', to: 'e7' });
    expect(canHint(d.s)).toBe(false);
    expect(d.send({ type: 'hint' })).toEqual([]);
    d.move('e6e7');
    expect(d.s.hintLevel).toBe(0);
    expect(d.fx[0]).toEqual({ type: 'hint', level: 0, from: null, to: null });
  });
});

describe('practice: drill advance', () => {
  it('solved → 1000 ms → advance request → loaded swaps in place with a fade; counter stays frozen', () => {
    const d = new Driver({ mode: 'drill' });
    d.send({ type: 'start', items: [{ puzzle: MATE }], counterIds: ['mate', 'b', 'c'] });
    d.land();
    expect(drillCounterOf(d.s)).toEqual({ position: 1, total: 3 });
    d.move('a1a8');
    expect(practiceTitleOf(d.s)).toBe('solved');
    expect(d.last('schedule')).toMatchObject({ id: 'advance', ms: SOLVED_PAUSE_MS });
    d.timer('advance');
    const req = d.last('advance')!;
    expect(req.puzzleId).toBe('mate');
    expect(d.s.phase).toBe('advancing');
    d.send({ type: 'loaded', reqId: req.reqId + 99, item: { puzzle: LONG } });
    expect(d.s.phase).toBe('advancing'); // stale reply ignored
    d.send({ type: 'loaded', reqId: req.reqId, item: { puzzle: LONG } });
    expect(d.types()).toEqual(['interactive', 'fadeOut']);
    d.send({ type: 'faded' });
    expect(d.types()).toEqual(['interactive', 'reset', 'animate', 'fadeIn']);
    // 00008 was never in the frozen list: pinned to N.
    expect(drillCounterOf(d.s)).toEqual({ position: 3, total: 3 });
    expect(d.s.drilled).toBe(1);
  });

  it('a null next puzzle is the done screen; a failed advance can be retried', () => {
    const d = new Driver({ mode: 'drill' });
    d.send({ type: 'start', items: [{ puzzle: MATE }] });
    d.land();
    d.move('a1a8');
    d.timer('advance');
    d.send({ type: 'loadFailed', reqId: d.s.advanceReqId! });
    expect(d.s.phase).toBe('advanceFailed');
    d.send({ type: 'retry' });
    expect(d.s.phase).toBe('advancing');
    d.send({ type: 'loaded', reqId: d.s.advanceReqId!, item: null });
    expect(d.s.phase).toBe('done');
  });
});

describe('practice: skip', () => {
  it('drill: skip mid-puzzle cancels timers and asks for the next puzzle', () => {
    const d = new Driver({ mode: 'drill' });
    d.send({ type: 'start', items: [{ puzzle: LONG }] });
    d.land();
    d.move('e6e7');
    expect(d.s.phase).toBe('opponentReplying');
    d.send({ type: 'skip' });
    expect(d.types()).toEqual(['cancel', 'interactive', 'advance']);
    expect(d.s.phase).toBe('advancing');
    expect(d.last('advance')!.puzzleId).toBe('00008');
    expect(d.s.drilled).toBe(0);
    // The cancelled reply timer is inert.
    d.timer('reply');
    expect(d.s.phase).toBe('advancing');
  });

  it('skip during a wrong-move rewind and during the setup slide', () => {
    const d = new Driver({ mode: 'drill' });
    d.send({ type: 'start', items: [{ puzzle: MATE }] });
    d.send({ type: 'skip' });
    expect(d.s.phase).toBe('advancing');
    const d2 = new Driver({ mode: 'drill' });
    d2.send({ type: 'start', items: [{ puzzle: MATE }] });
    d2.land();
    d2.move('a1a7');
    expect(d2.s.phase).toBe('rewinding');
    d2.send({ type: 'skip' });
    expect(d2.s.phase).toBe('advancing');
    d2.timer('rewind');
    expect(d2.s.phase).toBe('advancing');
  });

  it('is ignored when solved, idle, or in the viewer; mistakes pops the head', () => {
    const d = new Driver({ mode: 'drill' });
    d.send({ type: 'skip' });
    expect(d.s.phase).toBe('idle');
    d.send({ type: 'start', items: [{ puzzle: MATE }] });
    d.land();
    d.move('a1a8');
    d.send({ type: 'skip' });
    expect(d.s.phase).toBe('solved');
    const v = new Driver({ mode: 'viewer' });
    v.send({ type: 'start', items: [{ puzzle: MATE }] });
    v.land();
    v.send({ type: 'skip' });
    expect(v.s.phase).toBe('playerTurn');
    const m = new Driver({ mode: 'mistakes' });
    m.send({ type: 'start', items: [{ puzzle: MATE }, { puzzle: { ...MATE, id: 'm2' } }] });
    m.land();
    m.send({ type: 'skip' });
    expect(m.s.phase).toBe('swapping');
    expect(m.s.queue.map((i) => i.puzzle.id)).toEqual(['m2']);
  });
});

describe('practice: mistakes queue', () => {
  it('FIFO with progress; failed items resolve the review queue (Q14), slow ones do not', () => {
    const d = new Driver({ mode: 'mistakes' });
    d.send({ type: 'start', items: [{ puzzle: MATE, reason: 'failed' }, { puzzle: { ...MATE, id: 'm2' }, reason: 'slow' }] });
    expect(d.s.total).toBe(2);
    d.land();
    d.move('a1a8');
    expect(d.last('resolve')).toEqual({ type: 'resolve', puzzleId: 'mate' });
    expect(d.s.solvedCount).toBe(1);
    d.timer('advance');
    expect(d.s.phase).toBe('swapping');
    d.send({ type: 'faded' });
    d.land();
    d.move('a1a8');
    expect(d.last('resolve')).toBeUndefined();
    d.timer('advance');
    expect(d.s.phase).toBe('done');
    expect(d.s.solvedCount).toBe(2);
  });
});

describe('practice: viewer solution stepper', () => {
  it('jumps to ply 1, steps forward with a slide, back with a snap, clamps, and tries again', () => {
    const d = new Driver({ mode: 'viewer' });
    d.send({ type: 'start', items: [{ puzzle: LONG }] });
    d.send({ type: 'showSolution' });
    expect(d.s.phase).toBe('solution');
    expect(solutionStepOf(d.s)).toEqual({ n: 0, total: 5, ply: 1, maxPly: 6 });
    expect(d.last('setPosition')).toMatchObject({ ms: 0, lastMove: { from: 'f2', to: 'g3' } });
    // The setup slide that was running no longer lands.
    expect(d.send({ type: 'animationDone', id: 1 })).toEqual([]);
    d.send({ type: 'step', delta: 1, source: 'swipe' });
    expect(d.last('setPosition')).toMatchObject({ ms: 280, lastMove: { from: 'e6', to: 'e7' } });
    expect(d.types()).toContain('feel:capture');
    d.send({ type: 'step', delta: 1, source: 'repeat' });
    expect(d.last('setPosition')!.ms).toBe(REPEAT_SLIDE_MS);
    expect(d.types()).toContain('feel:sliderTick');
    d.send({ type: 'step', delta: -1, source: 'tap' });
    expect(d.last('setPosition')!.ms).toBe(0);
    d.send({ type: 'seek', ply: 99 });
    expect(d.s.ply).toBe(6);
    expect(d.send({ type: 'step', delta: 1, source: 'tap' })).toEqual([]);
    d.send({ type: 'tryAgain' });
    expect(d.s.phase).toBe('setupAnimating');
    expect(d.s.fens).toBeNull();
  });
});

describe('practice: adapters', () => {
  it('normalizes review-item moves and picks the next puzzle', () => {
    expect(normalizeMoves('e2e4  e7e5 ')).toEqual(['e2e4', 'e7e5']);
    expect(normalizeMoves(['a', ''])).toEqual(['a']);
    const item = sessionItemToPractice({ puzzleId: 'p', reason: 'slow', responseMs: 1, rating: 1500, fen: MATE.fen, moves: 'c7c6 a1a8', themes: [] });
    expect(item.puzzle.moves).toEqual(['c7c6', 'a1a8']);
    expect(nextReviewPuzzleId([{ puzzleId: 'a' }, { puzzleId: 'b' }], 'a')).toBe('b');
    expect(nextReviewPuzzleId([{ puzzleId: 'a' }], 'a')).toBeNull();
    expect(tacticalThemes(['endgame', 'fork', 'mate', 'pin'])).toEqual(['fork', 'pin']);
  });

  it('e2eWrongMove is legal, not the expected move and not a mate', () => {
    const fen = '6k1/5ppp/2p5/8/8/8/1R6/R5K1 w - - 0 2';
    const w = e2eWrongMove(fen, 'a1a8')!;
    expect(w).not.toBe('a1a8');
    expect(w).not.toBe('b2b8');
  });
});
