import { describe, expect, it } from 'vitest';
import type { ServerPuzzle } from '../src/puzzle';
import {
  MAX_RESPONSE_MS, NEXT_DELAY_MS, NEXT_RETRY_MS, STREAK_BROKEN_MS,
  createRunner, remainingMs, restoreRunner, runnerReducer, toSnapshot, turnCardOf,
  type NextResponse, type RunnerEffect, type RunnerEventInput, type RunnerState,
} from '../src/runner';

// Two mates after the setup c7c6: the listed Ra8# and the alternative Rb8#.
const MATE: ServerPuzzle = {
  id: 'mate', fen: '6k1/2p2ppp/8/8/8/8/1R6/R5K1 b - - 0 1', moves: ['c7c6', 'a1a8'], rating: 1300, themes: ['mateIn1'], gameUrl: null,
};
// Real Lichess 00008: setup f2g3, then e6e7 (player) b2b1 (reply) b3c1 b1c1 h6c1.
const LONG: ServerPuzzle = {
  id: '00008', fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'], rating: 1913, themes: ['crushing'], gameUrl: null,
};

const next = (puzzle: ServerPuzzle, over: Partial<NextResponse['session']> = {}, currentRating = 1200): NextResponse => ({
  puzzle, currentRating, session: { id: 's1', startedAt: '2026-10-25T10:00:00Z', durationSec: 60, style: 'blitz', mode: 'mixed', ...over },
});

const T0 = 1_000_000;

/** Drives the reducer like usePuzzleRunner: each step returns the effects it produced. */
class Driver {
  s: RunnerState;
  fx: RunnerEffect[] = [];
  constructor(animMs = 280) {
    this.s = createRunner({ mode: 'session', sessionId: 's1', animMs, fixedColor: 'auto' });
  }
  send(e: RunnerEventInput, at: number) {
    const r = runnerReducer(this.s, { ...e, at } as Parameters<typeof runnerReducer>[1]);
    this.s = r.state;
    this.fx = r.effects;
    return r.effects;
  }
  /** The last effect of a type from the latest step. */
  last<T extends RunnerEffect['type']>(type: T) {
    return this.fx.filter((f) => f.type === type).pop() as Extract<RunnerEffect, { type: T }> | undefined;
  }
  types() {
    return this.fx.map((f) => (f.type === 'api' ? `api:${f.call}` : f.type === 'feel' ? `feel:${f.event}` : f.type));
  }
  /** Boot with a stash and let the setup slide land at `at`. */
  start(p: ServerPuzzle, at = T0, over?: Partial<NextResponse['session']>) {
    this.send({ type: 'boot', stash: next(p, over) }, T0);
    this.send({ type: 'animationDone', id: this.s.anim!.id }, at);
    return this;
  }
  attemptReq() {
    return this.s.pendingAttempt!.reqId!;
  }
}

const sq = (s: string) => s as 'a1';

describe('runner: boot and setup slide', () => {
  it('stash boot: timer, reset to pre-setup FEN, setup slide, progression from the response style', () => {
    const d = new Driver();
    d.send({ type: 'boot', stash: next(MATE, { style: 'bullet' }) }, T0);
    expect(d.s.phase).toBe('setupAnimating');
    expect(d.types()).toEqual(['schedule', 'patchProgression', 'interactive', 'reset', 'animate', 'persistSnapshot']);
    expect(d.last('schedule')).toMatchObject({ id: 'timeUp', ms: 60_000 });
    expect(d.last('reset')).toEqual({ type: 'reset', fen: MATE.fen, orientation: 'white' });
    expect(d.last('animate')).toMatchObject({ from: 'c7', to: 'c6', ms: 280 });
    // fix: the style comes from the response (the web wrote into its stale default 'blitz')
    expect(d.last('patchProgression')).toEqual({ type: 'patchProgression', style: 'bullet', currentPuzzleRating: 1200 });
    expect(d.s.endsAt).toBe(T0 + 60_000);
    expect(d.s.fen).toBe(MATE.fen);
  });

  it('setup landing starts the player turn and its clock; the reply sound fires at landing', () => {
    const d = new Driver();
    d.send({ type: 'boot', stash: next(MATE) }, T0);
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 300);
    expect(d.s.phase).toBe('playerTurn');
    expect(d.s.turnStartedAt).toBe(T0 + 300);
    expect(d.s.lastMove).toEqual({ from: 'c7', to: 'c6' });
    expect(d.types()).toEqual(['feel:opponentLanding', 'interactive', 'persistSnapshot']);
    expect(d.last('feel')!.ctx!.move!.san).toBe('c6');
  });

  it('a move during the setup slide is rejected (the board takes it back)', () => {
    const d = new Driver();
    d.send({ type: 'boot', stash: next(MATE) }, T0);
    const before = d.s;
    expect(d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 10)).toEqual([{ type: 'rejectMove' }]);
    expect(d.s).toBe(before);
  });

  it('fixedColor overrides the orientation only', () => {
    const d = new Driver();
    d.s = { ...d.s, fixedColor: 'black' };
    d.start(MATE);
    expect(d.s.orientation).toBe('black');
    expect(d.s.playerColor).toBe('w');
    expect(d.s.phase).toBe('playerTurn');
  });

  it('no stash: POST /next; a failing /next falls back to GET /sessions/:id for the summary', () => {
    const d = new Driver();
    d.send({ type: 'boot' }, T0);
    const reqId = d.last('api')!.reqId;
    expect(d.types()).toEqual(['api:next']);
    d.send({ type: 'apiError', call: 'next', reqId, status: 400 }, T0 + 50);
    const detail = d.last('api')!;
    expect(detail.call).toBe('detail');
    d.send({ type: 'apiOk', call: 'detail', reqId: detail.reqId, data: { solved: 4, failed: 1, accuracy: 0.8, avgResponseMs: 9000, peakRating: 1400 } }, T0 + 90);
    expect(d.s.phase).toBe('summary');
    expect(d.s.result).toMatchObject({ kind: 'summary', source: 'detail', summary: { solved: 4, failed: 1 } });
  });
});

describe('runner: transition table', () => {
  it('correct (mainline mate): attempt(correct) + correct feel, next after 220 ms', () => {
    const d = new Driver().start(MATE, T0 + 300);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 4300);
    expect(d.s.phase).toBe('resolving');
    expect(d.types()).toEqual(['interactive', 'feel:correct', 'flash', 'sparks', 'api:attempt', 'persistSnapshot']);
    expect(d.last('api')).toMatchObject({ call: 'attempt', payload: { sessionId: 's1', puzzleId: 'mate', correct: true, responseMs: 4000 } });
    expect(d.last('flash')).toEqual({ type: 'flash', square: 'a8', ok: true });
    expect(d.s.counters).toMatchObject({ solved: 1, failed: 0, peakRating: 1300, totalResponseMs: 4000 });

    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1215, step: 15, streak: 1 } }, T0 + 4400);
    expect(d.last('patchProgression')).toEqual({ type: 'patchProgression', style: 'blitz', currentPuzzleRating: 1215 });
    expect(d.last('schedule')).toMatchObject({ id: 'next', ms: NEXT_DELAY_MS.correct });

    d.send({ type: 'timer', id: 'next' }, T0 + 4620);
    expect(d.s.phase).toBe('loadingNext');
    const nextReq = d.last('api')!;
    expect(nextReq.call).toBe('next');
    d.send({ type: 'apiOk', call: 'next', reqId: nextReq.reqId, data: next(LONG, {}, 1215) }, T0 + 4700);
    expect(d.s.phase).toBe('setupAnimating');
    expect(d.s.puzzle!.id).toBe('00008');
    expect(d.last('reset')).toEqual({ type: 'reset', fen: LONG.fen, orientation: 'white' });
  });

  it('wrong: attempt(correct=false) + mistake feel + shake, the wrong move stays, next after 360 ms', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('g1'), to: sq('f1') }, T0 + 2000);
    expect(d.types()).toEqual(['interactive', 'feel:mistake', 'flash', 'shake', 'api:attempt', 'persistSnapshot']);
    expect(d.last('api')).toMatchObject({ payload: { correct: false, responseMs: 2000 } });
    expect(d.s.lastMove).toEqual({ from: 'g1', to: 'f1' });
    expect(d.s.counters.failed).toBe(1);
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1190, step: -10, streak: 0 } }, T0 + 2100);
    expect(d.last('schedule')).toMatchObject({ id: 'next', ms: NEXT_DELAY_MS.wrong });
  });

  it('alternative mate is accepted as correct', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('b2'), to: sq('b8') }, T0 + 1000);
    expect(d.last('api')).toMatchObject({ call: 'attempt', payload: { correct: true } });
    expect(d.s.counters.solved).toBe(1);
  });

  it('opponent reply: scheduled after max(animMs, 80), slides, then the player moves again', () => {
    const d = new Driver(280).start(LONG, T0);
    d.send({ type: 'move', from: sq('e6'), to: sq('e7') }, T0 + 1000);
    expect(d.s.phase).toBe('opponentReplying');
    // A correct, non-final move plays its own click (here a capture); the
    // winning and wrong cases above play only correct / mistake.
    expect(d.types()).toEqual(['feel:capture', 'interactive', 'schedule', 'persistSnapshot']);
    expect(d.last('schedule')).toMatchObject({ id: 'opponentReply', ms: 280 });

    d.send({ type: 'timer', id: 'opponentReply' }, T0 + 1280);
    expect(d.last('animate')).toMatchObject({ from: 'b2', to: 'b1', ms: 280 });
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 1560);
    expect(d.s.phase).toBe('playerTurn');
    expect(d.s.remaining).toEqual(['b3c1', 'b1c1', 'h6c1']);
    expect(d.s.lastMove).toEqual({ from: 'b2', to: 'b1' });
    expect(d.types()).toEqual(['feel:opponentLanding', 'interactive', 'persistSnapshot']);
    // Thinking time stays anchored at the setup landing (web attemptStart).
    expect(d.s.turnStartedAt).toBe(T0);

    const fast = new Driver(0).start(LONG, T0);
    fast.send({ type: 'move', from: sq('e6'), to: sq('e7') }, T0 + 1000);
    expect(fast.last('schedule')).toMatchObject({ id: 'opponentReply', ms: 80 });
  });

  it('pause during a pending reply: the reply is cancelled, deferred, and re-armed with what was left', () => {
    const d = new Driver(280).start(LONG, T0);
    d.send({ type: 'move', from: sq('e6'), to: sq('e7') }, T0 + 1000);
    d.send({ type: 'pause', source: 'user' }, T0 + 1100);
    expect(d.s.paused).toBe(true);
    expect(d.fx).toEqual(expect.arrayContaining([
      { type: 'cancel', id: 'opponentReply' }, { type: 'cancel', id: 'timeUp' }, { type: 'feel', event: 'pause' },
    ]));
    expect(d.s.timers.opponentReply).toEqual({ ms: 180, dueAt: null });
    expect(d.s.pausedRemainingMs).toBe(60_000 - 1100);

    // A timer that slipped through the cancel is ignored while parked.
    d.send({ type: 'timer', id: 'opponentReply' }, T0 + 1280);
    expect(d.fx).toEqual([]);
    expect(d.s.anim).toBeNull();

    d.send({ type: 'resume', source: 'user' }, T0 + 31_100);
    expect(d.fx).toEqual(expect.arrayContaining([
      { type: 'schedule', id: 'opponentReply', ms: 180, event: { type: 'timer', id: 'opponentReply' } },
      { type: 'schedule', id: 'timeUp', ms: 58_900, event: { type: 'timer', id: 'timeUp' } },
    ]));
    expect(d.s.endsAt).toBe(T0 + 31_100 + 58_900);
    expect(d.s.turnStartedAt).toBe(T0 + 30_000);
    d.send({ type: 'timer', id: 'opponentReply' }, T0 + 31_280);
    expect(d.last('animate')).toMatchObject({ from: 'b2', to: 'b1' });
  });

  it('background during the setup slide: the turn and its clock start only on resume', () => {
    const d = new Driver();
    d.send({ type: 'boot', stash: next(MATE) }, T0);
    d.send({ type: 'pause', source: 'background' }, T0 + 100);
    expect(d.types()).not.toContain('feel:pause'); // auto-pause is silent
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 290);
    expect(d.s.phase).toBe('setupAnimating');
    expect(d.types()).not.toContain('feel:opponentLanding');
    expect(d.types()).not.toContain('interactive');

    d.send({ type: 'resume', source: 'foreground' }, T0 + 20_100);
    expect(d.s.phase).toBe('playerTurn');
    expect(d.s.turnStartedAt).toBe(T0 + 20_100);
    expect(d.last('interactive')).toEqual({ type: 'interactive', on: true });
    expect(remainingMs(d.s, T0 + 20_100)).toBe(59_900);

    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 25_100);
    expect(d.last('api')).toMatchObject({ payload: { responseMs: 5000 } });
  });

  it('timer end during a pending reply: the reply is cancelled and the session finishes once', () => {
    const d = new Driver().start(LONG, T0);
    d.send({ type: 'move', from: sq('e6'), to: sq('e7') }, T0 + 59_900);
    d.send({ type: 'timer', id: 'timeUp' }, T0 + 60_000);
    expect(d.s.phase).toBe('finishing');
    expect(d.types()).toEqual(['cancel', 'interactive', 'api:finish']);
    expect(d.last('cancel')).toEqual({ type: 'cancel', id: 'opponentReply' });
    expect(d.last('api')).toMatchObject({ call: 'finish', payload: { sessionId: 's1', save: true } });

    // The late reply never lands.
    d.send({ type: 'timer', id: 'opponentReply' }, T0 + 60_180);
    expect(d.fx).toEqual([]);
    const finishReq = d.s.finishReq!.reqId;
    const response = { sessionId: 's1', solved: 3, failed: 1, accuracy: 0.75, avgResponseMs: 8000, peakRating: 1400 };
    d.send({ type: 'apiOk', call: 'finish', reqId: finishReq, data: response }, T0 + 60_300);
    expect(d.s.phase).toBe('summary');
    expect(d.types()).toEqual(['finished', 'clearSnapshot']);
    expect(d.s.result).toEqual({ kind: 'summary', source: 'server', summary: response });
  });

  it('timer end while an attempt is in flight: finish waits for the attempt', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 59_950);
    d.send({ type: 'timer', id: 'timeUp' }, T0 + 60_000);
    expect(d.types()).not.toContain('api:finish');
    expect(d.s.finishQueued).toEqual({ save: true });
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1210, streak: 1 } }, T0 + 60_100);
    expect(d.last('api')).toMatchObject({ call: 'finish', payload: { save: true } });
    expect(d.types()).not.toContain('schedule');
  });

  it('attempt failure: no rating patch, the optimistic streak stays, the session goes on', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    d.send({ type: 'apiError', call: 'attempt', reqId: d.attemptReq(), status: 500 }, T0 + 1100);
    expect(d.types()).toEqual(['schedule', 'persistSnapshot']);
    expect(d.last('schedule')).toMatchObject({ id: 'next', ms: 220 });
    expect(d.s.streak).toBe(1);
    expect(d.s.pendingAttempt).toBeNull();
  });

  it('/next failure: one retry after 1.5 s, then finish', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1210 } }, T0 + 1100);
    d.send({ type: 'timer', id: 'next' }, T0 + 1320);
    d.send({ type: 'apiError', call: 'next', reqId: d.s.nextReqId!, status: 502 }, T0 + 1400);
    expect(d.last('schedule')).toMatchObject({ id: 'nextRetry', ms: NEXT_RETRY_MS });
    expect(d.s.phase).toBe('loadingNext');
    d.send({ type: 'timer', id: 'nextRetry' }, T0 + 2900);
    expect(d.last('api')!.call).toBe('next');
    d.send({ type: 'apiError', call: 'next', reqId: d.s.nextReqId!, status: 502 }, T0 + 3000);
    expect(d.s.phase).toBe('finishing');
    expect(d.last('api')).toMatchObject({ call: 'finish', payload: { save: true } });

    // Finish unreachable as well: the summary comes from client counters.
    d.send({ type: 'apiError', call: 'finish', reqId: d.s.finishReq!.reqId }, T0 + 3100);
    expect(d.s.result).toMatchObject({ kind: 'summary', source: 'client', summary: { solved: 1, failed: 0, accuracy: 1, avgResponseMs: 1000 } });
  });

  it('/next retry that succeeds resets the retry budget', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1210 } }, T0 + 1100);
    d.send({ type: 'timer', id: 'next' }, T0 + 1320);
    d.send({ type: 'apiError', call: 'next', reqId: d.s.nextReqId! }, T0 + 1400);
    d.send({ type: 'timer', id: 'nextRetry' }, T0 + 2900);
    d.send({ type: 'apiOk', call: 'next', reqId: d.s.nextReqId!, data: next(LONG) }, T0 + 3000);
    expect(d.s.phase).toBe('setupAnimating');
    expect(d.s.nextRetried).toBe(false);
  });

  it('double finish is guarded (exit Save + time up + a second tap)', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'finish', save: true }, T0 + 1000);
    expect(d.types().filter((t) => t === 'api:finish')).toHaveLength(1);
    const st = d.s;
    expect(d.send({ type: 'finish', save: true }, T0 + 1001)).toEqual([]);
    expect(d.send({ type: 'timer', id: 'timeUp' }, T0 + 60_000)).toEqual([]);
    expect(d.send({ type: 'tick' }, T0 + 61_000)).toEqual([]);
    expect(d.send({ type: 'requestExit' }, T0 + 61_000)).toEqual([]);
    expect(d.s).toBe(st);
  });

  it('discard with 0 attempts: straight to finish(save=false), then exit', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'requestExit' }, T0 + 500);
    expect(d.types()).toEqual(['cancel', 'interactive', 'api:finish']);
    expect(d.last('api')).toMatchObject({ call: 'finish', payload: { save: false } });
    d.send({ type: 'apiOk', call: 'finish', reqId: d.s.finishReq!.reqId, data: { discarded: true } as never }, T0 + 600);
    expect(d.s.result).toEqual({ kind: 'discarded' });
    expect(d.types()).toEqual(['clearSnapshot', 'exit']);
  });

  it('exit with ≥ 1 attempt opens the ExitSheet; Discard is heavy and leaves even offline', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('g1'), to: sq('f1') }, T0 + 1000);
    d.send({ type: 'requestExit' }, T0 + 1100);
    expect(d.types()).toEqual(['feel:exitSheet', 'confirmExit']);
    expect(d.s.phase).toBe('resolving');
    const attemptReq = d.attemptReq();
    d.send({ type: 'finish', save: false }, T0 + 1200);
    expect(d.types()).toEqual(['feel:discard', 'cancel', 'interactive', 'api:finish']);
    // The in-flight attempt resolves after the discard: ignored.
    expect(d.send({ type: 'apiOk', call: 'attempt', reqId: attemptReq, data: { newRating: 1 } }, T0 + 1250)).toEqual([]);
    d.send({ type: 'apiError', call: 'finish', reqId: d.s.finishReq!.reqId }, T0 + 1300);
    expect(d.s.result).toEqual({ kind: 'discarded' });
  });
});

describe('runner: streak, theme, clamps', () => {
  it('streak counts up (streakUp from 2), breaks with a 700 ms chip', () => {
    const d = new Driver().start(MATE, T0);
    const solve = (at: number) => {
      d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, at);
      const fx = d.fx;
      d.send({ type: 'apiError', call: 'attempt', reqId: d.attemptReq() }, at + 10);
      d.send({ type: 'timer', id: 'next' }, at + 230);
      d.send({ type: 'apiOk', call: 'next', reqId: d.s.nextReqId!, data: next(MATE) }, at + 240);
      d.send({ type: 'animationDone', id: d.s.anim!.id }, at + 520);
      return fx;
    };
    expect(solve(T0 + 1000).some((f) => f.type === 'feel' && f.event === 'streakUp')).toBe(false);
    expect(solve(T0 + 3000)).toContainEqual({ type: 'feel', event: 'streakUp', ctx: { streak: 2 } });
    expect(d.s.streak).toBe(2);

    d.send({ type: 'move', from: sq('g1'), to: sq('f1') }, T0 + 5000);
    expect(d.types()).toContain('feel:streakBroken');
    expect(d.s.streakBroken).toBe(2);
    expect(d.s.streak).toBe(0);
    expect(d.last('schedule')).toMatchObject({ id: 'streakBroken', ms: STREAK_BROKEN_MS });
    d.send({ type: 'timer', id: 'streakBroken' }, T0 + 5700);
    expect(d.s.streakBroken).toBeNull();
  });

  it('the server streak reconciles the optimistic one', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1210, streak: 4 } }, T0 + 1100);
    expect(d.s.streak).toBe(4);
  });

  it('theme sessions never patch progressions', () => {
    const d = new Driver();
    d.send({ type: 'boot', stash: next(MATE, { mode: 'theme' }) }, T0);
    expect(d.types()).not.toContain('patchProgression');
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 300);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1200, step: 0, streak: 1 } }, T0 + 1100);
    expect(d.types()).not.toContain('patchProgression');
  });

  it('responseMs is clamped to the AttemptDto maximum', () => {
    const d = new Driver();
    d.send({ type: 'boot', stash: next(MATE, { durationSec: 3600 }) }, T0);
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 900_000);
    expect(d.last('api')).toMatchObject({ payload: { responseMs: MAX_RESPONSE_MS } });
  });

  it('a /next that lands while paused is held and loaded on resume', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1210 } }, T0 + 1100);
    d.send({ type: 'timer', id: 'next' }, T0 + 1320);
    d.send({ type: 'pause', source: 'background' }, T0 + 1330);
    d.send({ type: 'apiOk', call: 'next', reqId: d.s.nextReqId!, data: next(LONG) }, T0 + 1400);
    expect(d.types()).not.toContain('reset');
    expect(d.s.heldNext).not.toBeNull();
    d.send({ type: 'resume', source: 'foreground' }, T0 + 9000);
    expect(d.s.phase).toBe('setupAnimating');
    expect(d.last('reset')!.fen).toBe(LONG.fen);
  });

  it('tick after a late timer finishes the session', () => {
    const d = new Driver().start(MATE, T0);
    expect(d.send({ type: 'tick' }, T0 + 30_000)).toEqual([]);
    d.send({ type: 'tick' }, T0 + 60_500);
    expect(d.types()).toEqual(['cancel', 'interactive', 'api:finish']);
  });

  it('non-session modes are typed stubs (no transitions yet)', () => {
    const s = createRunner({ mode: 'viewer', puzzle: MATE, animMs: 280, fixedColor: 'auto' });
    const r = runnerReducer(s, { type: 'boot', at: T0 });
    expect(r.state).toBe(s);
    expect(r.effects).toEqual([]);
  });
});

describe('runner: snapshot', () => {
  it('round-trips a mid-puzzle session as paused, with the same puzzle, position and time', () => {
    const d = new Driver().start(LONG, T0);
    d.send({ type: 'move', from: sq('e6'), to: sq('e7') }, T0 + 1000);
    // Killed while the reply is pending: saved as if the reply had landed.
    const snap = toSnapshot(d.s, T0 + 1100)!;
    expect(snap).toMatchObject({ stage: 'turn', ply: 3, remaining: ['b3c1', 'b1c1', 'h6c1'], remainingMs: 58_900, turnElapsedMs: 1100 });
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);

    const r = restoreRunner(snap, { mode: 'session', sessionId: 's1', animMs: 280, fixedColor: 'auto' }, T0 + 500_000);
    expect(r.state.paused).toBe(true);
    expect(r.state.phase).toBe('playerTurn');
    expect(r.effects).toContainEqual({ type: 'reset', fen: snap.fen, orientation: 'white' });
    expect(remainingMs(r.state, T0 + 600_000)).toBe(58_900);

    const d2 = new Driver();
    d2.s = r.state;
    d2.send({ type: 'resume', source: 'user' }, T0 + 510_000);
    expect(d2.last('schedule')).toMatchObject({ id: 'timeUp', ms: 58_900 });
    d2.send({ type: 'move', from: sq('b3'), to: sq('c1') }, T0 + 512_000);
    expect(d2.s.phase).toBe('opponentReplying');
    expect(d2.s.remaining).toEqual(['b1c1', 'h6c1']);
  });

  it('an unconfirmed attempt is re-sent on resume', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    const snap = toSnapshot(d.s, T0 + 1050)!;
    expect(snap.stage).toBe('attempt');
    const r = restoreRunner(snap, { mode: 'session', sessionId: 's1', animMs: 280, fixedColor: 'auto' }, T0 + 2000);
    const d2 = new Driver();
    d2.s = r.state;
    d2.send({ type: 'resume', source: 'user' }, T0 + 3000);
    expect(d2.last('api')).toMatchObject({ call: 'attempt', payload: { puzzleId: 'mate', correct: true, responseMs: 1000 } });
    d2.send({ type: 'apiOk', call: 'attempt', reqId: d2.attemptReq(), data: { newRating: 1210 } }, T0 + 3100);
    expect(d2.last('schedule')).toMatchObject({ id: 'next' });
  });

  it('nothing to snapshot once finishing', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'finish', save: true }, T0 + 100);
    expect(toSnapshot(d.s, T0 + 100)).toBeNull();
  });
});

describe('runner: verifier edge cases', () => {
  const cfg = { mode: 'session', sessionId: 's1', animMs: 280, fixedColor: 'auto' } as const;

  it('snapshot after a reply slide landed under the pause overlay drops the reply from remaining', () => {
    const d = new Driver().start(LONG, T0);
    d.send({ type: 'move', from: sq('e6'), to: sq('e7') }, T0 + 1000);
    d.send({ type: 'timer', id: 'opponentReply' }, T0 + 1280);
    d.send({ type: 'pause', source: 'background' }, T0 + 1300);
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 1560);
    expect(d.types()).toEqual(['persistSnapshot']);
    const snap = toSnapshot(d.s, T0 + 2000)!;
    expect(snap).toMatchObject({ stage: 'turn', ply: 3, remaining: ['b3c1', 'b1c1', 'h6c1'], lastMove: { from: 'b2', to: 'b1' } });

    // Killed in the background, restored: the player's next move is still right.
    const d2 = new Driver();
    d2.s = restoreRunner(snap, cfg, T0 + 90_000).state;
    d2.send({ type: 'resume', source: 'user' }, T0 + 91_000);
    d2.send({ type: 'move', from: sq('b3'), to: sq('c1') }, T0 + 92_000);
    expect(d2.s.phase).toBe('opponentReplying');
  });

  it('the same landed-under-pause reply, resumed without a kill, plays on silently', () => {
    const d = new Driver().start(LONG, T0);
    d.send({ type: 'move', from: sq('e6'), to: sq('e7') }, T0 + 1000);
    d.send({ type: 'timer', id: 'opponentReply' }, T0 + 1280);
    d.send({ type: 'pause', source: 'background' }, T0 + 1300);
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 1560);
    d.send({ type: 'resume', source: 'foreground' }, T0 + 10_000);
    expect(d.s.phase).toBe('playerTurn');
    expect(d.s.remaining).toEqual(['b3c1', 'b1c1', 'h6c1']);
    expect(d.types()).not.toContain('feel:opponentLanding');
    expect(d.last('interactive')).toEqual({ type: 'interactive', on: true });
  });

  it('pause while /attempt is in flight: the next-puzzle delay is parked until resume', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    d.send({ type: 'pause', source: 'user' }, T0 + 1050);
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1210 } }, T0 + 1100);
    expect(d.types()).not.toContain('schedule');
    expect(d.s.timers.next).toEqual({ ms: NEXT_DELAY_MS.correct, dueAt: null });
    d.send({ type: 'resume', source: 'user' }, T0 + 5000);
    expect(d.fx).toContainEqual({ type: 'schedule', id: 'next', ms: NEXT_DELAY_MS.correct, event: { type: 'timer', id: 'next' } });
  });

  it('Save while paused with an attempt in flight: the overlay drops and a resume cannot restart the clock', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    d.send({ type: 'pause', source: 'user' }, T0 + 1100);
    d.send({ type: 'finish', save: true }, T0 + 1200);
    expect(d.s.finishQueued).toEqual({ save: true });
    expect(d.s.paused).toBe(false);
    expect(d.types()).not.toContain('persistSnapshot');
    expect(d.send({ type: 'resume', source: 'user' }, T0 + 1300)).toEqual([]);
    expect(d.s.endsAt).toBeNull();
    expect(remainingMs(d.s, T0 + 1300)).toBe(0);
    d.send({ type: 'apiOk', call: 'attempt', reqId: d.attemptReq(), data: { newRating: 1210 } }, T0 + 1400);
    expect(d.last('api')).toMatchObject({ call: 'finish', payload: { save: true } });
  });

  it('Save on a restored session before resume re-sends the unconfirmed attempt first', () => {
    const d = new Driver().start(MATE, T0);
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    const r = restoreRunner(toSnapshot(d.s, T0 + 1050)!, cfg, T0 + 5000);
    const d2 = new Driver();
    d2.s = r.state;
    d2.send({ type: 'finish', save: true }, T0 + 6000);
    expect(d2.types()).toEqual(['interactive', 'api:attempt']);
    expect(d2.last('api')).toMatchObject({ payload: { puzzleId: 'mate', correct: true, responseMs: 1000 } });
    d2.send({ type: 'apiOk', call: 'attempt', reqId: d2.attemptReq(), data: { newRating: 1210 } }, T0 + 6100);
    expect(d2.last('api')).toMatchObject({ call: 'finish', payload: { save: true } });
  });

  it('a line that ends on the opponent reply resolves as solved instead of waiting forever', () => {
    const SHORT: ServerPuzzle = { ...LONG, id: 'short', moves: ['f2g3', 'e6e7', 'b2b1'] };
    const d = new Driver().start(SHORT, T0);
    d.send({ type: 'move', from: sq('e6'), to: sq('e7') }, T0 + 1000);
    d.send({ type: 'timer', id: 'opponentReply' }, T0 + 1280);
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 1560);
    expect(d.s.phase).toBe('resolving');
    expect(d.last('api')).toMatchObject({ call: 'attempt', payload: { correct: true } });
  });

  it('time up during the setup slide of the next puzzle: the late landing is ignored', () => {
    const d = new Driver();
    d.send({ type: 'boot', stash: next(MATE) }, T0);
    const animId = d.s.anim!.id;
    d.send({ type: 'timer', id: 'timeUp' }, T0 + 60_000);
    expect(d.s.phase).toBe('finishing');
    expect(d.send({ type: 'animationDone', id: animId }, T0 + 60_010)).toEqual([]);
  });

  it('exit while booting (no puzzle yet) discards; the late /next is ignored', () => {
    const d = new Driver();
    d.send({ type: 'boot' }, T0);
    const nextReq = d.last('api')!.reqId;
    d.send({ type: 'requestExit' }, T0 + 10);
    expect(d.last('api')).toMatchObject({ call: 'finish', payload: { save: false } });
    expect(d.send({ type: 'apiOk', call: 'next', reqId: nextReq, data: next(MATE) }, T0 + 50)).toEqual([]);
  });

  it('TurnCard follows the web: "opponent moving" from the resolution until the next turn', () => {
    const d = new Driver();
    d.send({ type: 'boot', stash: next(MATE) }, T0);
    expect(turnCardOf(d.s)).toMatchObject({ opponentMoving: true, playerTurn: false });
    d.send({ type: 'animationDone', id: d.s.anim!.id }, T0 + 300);
    expect(turnCardOf(d.s)).toMatchObject({ opponentMoving: false, playerTurn: true });
    d.send({ type: 'move', from: sq('a1'), to: sq('a8') }, T0 + 1000);
    expect(turnCardOf(d.s)).toMatchObject({ opponentMoving: true, playerTurn: false });
  });
});
