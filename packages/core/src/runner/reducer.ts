// The puzzle runner as a pure reducer (PLAN §2.7), ported from the web
// PlayRunner (apps/frontend/src/app/(app)/play/[id]/page.tsx). Differences
// from the web are deliberate and marked "fix:".
import { Chess } from 'chess.js';
import type { Square } from '../board';
import { initPuzzle, parseUci, uciFromMove, type ServerPuzzle } from '../puzzle';
import { moveFeelEvent } from '../feel';
import { isTrainingStyle, type TrainingStyle } from '../rules';
import type {
  ApiEffect, AttemptResponse, FinishResponse, LastMove, MoveFeel, NextResponse, PendingAnim,
  RunnerConfig, RunnerEffect, RunnerEvent, RunnerState, SessionAggregates, TimerId, Transition,
} from './types';

/** Next puzzle after the attempt response: correct / wrong (web afterAttempt). */
export const NEXT_DELAY_MS = { correct: 220, wrong: 360 } as const;
/** Opponent reply waits for the player's own move to settle (web: max(animMs, 80)). */
export const MIN_REPLY_DELAY_MS = 80;
/** /next failure: one retry after this, then finish (covers rolling deploys). */
export const NEXT_RETRY_MS = 1500;
/** Broken-streak chip lifetime. */
export const STREAK_BROKEN_MS = 700;
/** AttemptDto: @Max(10 * 60 * 1000). The web sent larger values and lost the attempt to a 400. */
export const MAX_RESPONSE_MS = 10 * 60 * 1000;

export function createRunner(config: RunnerConfig): RunnerState {
  return {
    mode: config.mode,
    sessionId: config.mode === 'session' ? config.sessionId : '',
    phase: 'booting',
    paused: false,
    pausedAt: null,
    animMs: config.animMs,
    fixedColor: config.fixedColor,
    durationSec: 0,
    style: null,
    sessionMode: 'mixed',
    sessionStartRating: null,
    rating: null,
    endsAt: null,
    pausedRemainingMs: null,
    puzzle: null,
    fen: null,
    orientation: 'white',
    playerColor: 'w',
    lastMove: null,
    remaining: [],
    turnStartedAt: null,
    anim: null,
    counters: { solved: 0, failed: 0, totalResponseMs: 0, peakRating: 0 },
    streak: 0,
    streakBroken: null,
    timers: {},
    seq: 0,
    pendingAttempt: null,
    attemptDone: false,
    nextReqId: null,
    nextRetried: false,
    heldNext: null,
    detailReqId: null,
    finishQueued: null,
    finishReq: null,
    result: null,
  };
}

// ─── Transaction helper ─────────────────────────────────────────────────
// Each event works on a shallow copy and collects effects in order; the
// caller sees a fresh state object only when something changed.

class Tx {
  s: RunnerState;
  fx: RunnerEffect[] = [];
  constructor(prev: RunnerState, readonly at: number) {
    this.s = { ...prev, timers: { ...prev.timers } };
  }
  emit(e: RunnerEffect) {
    this.fx.push(e);
  }
  nextId() {
    this.s.seq += 1;
    return this.s.seq;
  }
  api<C extends ApiEffect['call']>(call: C, payload: Extract<ApiEffect, { call: C }>['payload']): number {
    const reqId = this.nextId();
    this.fx.push({ type: 'api', call, reqId, payload } as ApiEffect);
    return reqId;
  }
  /** While paused the timer is parked (no effect) and starts on resume. */
  schedule(id: TimerId, ms: number) {
    const delay = Math.max(0, Math.round(ms));
    if (this.s.paused) {
      this.s.timers[id] = { ms: delay, dueAt: null };
      return;
    }
    this.s.timers[id] = { ms: delay, dueAt: this.at + delay };
    this.fx.push({ type: 'schedule', id, ms: delay, event: { type: 'timer', id } });
  }
  cancel(id: TimerId) {
    const t = this.s.timers[id];
    if (!t) return;
    delete this.s.timers[id];
    if (t.dueAt != null) this.fx.push({ type: 'cancel', id });
  }
  cancelAll(except: TimerId[] = []) {
    for (const id of Object.keys(this.s.timers) as TimerId[]) if (!except.includes(id)) this.cancel(id);
  }
  feel(event: Extract<RunnerEffect, { type: 'feel' }>['event'], ctx?: Extract<RunnerEffect, { type: 'feel' }>['ctx']) {
    this.fx.push(ctx ? { type: 'feel', event, ctx } : { type: 'feel', event });
  }
  interactive(on: boolean) {
    this.fx.push({ type: 'interactive', on });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

const moveFeel = (m: { san: string; flags: string; captured?: string; promotion?: string }): MoveFeel => ({
  san: m.san, flags: m.flags, captured: m.captured, promotion: m.promotion,
});

/** Plays a UCI move on an immutable FEN. Null when chess.js rejects it. */
function play(fen: string, uci: string): { fen: string; move: MoveFeel; mate: boolean } | null {
  const c = new Chess(fen);
  try {
    const m = c.move(parseUci(uci));
    return { fen: c.fen(), move: moveFeel(m), mate: c.isCheckmate() };
  } catch {
    return null;
  }
}

const lastMoveOf = (uci: string): LastMove => {
  const m = parseUci(uci);
  return { from: m.from, to: m.to };
};

/** fix: the style comes from the response that carries it, never from earlier state. */
const styleOf = (r: NextResponse): TrainingStyle | null => (isTrainingStyle(r.session.style) ? r.session.style : null);

function patchProgression(tx: Tx, style: TrainingStyle | null, rating: number) {
  // fix: theme sessions are unrated; the web patched the store anyway.
  if (tx.s.sessionMode === 'theme' || !style) return;
  tx.emit({ type: 'patchProgression', style, currentPuzzleRating: rating });
}

const attempts = (s: RunnerState) => s.counters.solved + s.counters.failed;

const isOver = (s: RunnerState) => s.phase === 'finishing' || s.phase === 'summary';

// ─── Puzzle load ────────────────────────────────────────────────────────

/** web loadPuzzle(): reset to the pre-setup FEN, slide the setup move, then the player's turn. */
function loadPuzzle(tx: Tx, r: NextResponse): boolean {
  const p: ServerPuzzle = r.puzzle;
  let init;
  try {
    init = initPuzzle(p);
  } catch {
    return false; // corrupt puzzle line: treated like a failed /next
  }
  const s = tx.s;
  const style = styleOf(r);
  if (style) s.style = style;
  if (r.session.mode === 'theme' || r.session.mode === 'mixed') s.sessionMode = r.session.mode;
  s.rating = r.currentRating;
  s.puzzle = p;
  s.playerColor = init.playerColor;
  s.orientation =
    s.fixedColor === 'white' ? 'white' : s.fixedColor === 'black' ? 'black' : init.playerColor === 'w' ? 'white' : 'black';
  s.remaining = init.remaining;
  s.lastMove = null;
  s.turnStartedAt = null;
  s.pendingAttempt = null;
  s.attemptDone = false;
  s.nextReqId = null;
  s.nextRetried = false;
  patchProgression(tx, style, r.currentRating);
  tx.interactive(false);

  if (!init.setupMove) {
    s.fen = init.postFen;
    tx.emit({ type: 'reset', fen: init.postFen, orientation: s.orientation });
    startTurn(tx);
    return true;
  }
  const setupUci = uciFromMove(init.setupMove);
  const landed = play(init.preFen, setupUci);
  if (!landed) return false;
  s.fen = init.preFen;
  s.phase = 'setupAnimating';
  tx.emit({ type: 'reset', fen: init.preFen, orientation: s.orientation });
  const anim: PendingAnim = {
    id: tx.nextId(), kind: 'setup', fenAfter: landed.fen, lastMove: lastMoveOf(setupUci), move: landed.move, landed: false,
  };
  s.anim = anim;
  tx.emit({
    type: 'animate', id: anim.id, from: anim.lastMove.from, to: anim.lastMove.to, ms: s.animMs,
    promotion: init.setupMove.promotion as RunnerEffectPromotion,
    done: { type: 'animationDone', id: anim.id },
  });
  return true;
}
type RunnerEffectPromotion = Extract<RunnerEffect, { type: 'animate' }>['promotion'];

/** Thinking time starts when the setup move has landed (web attemptStart). */
function startTurn(tx: Tx) {
  tx.s.phase = 'playerTurn';
  tx.s.turnStartedAt = tx.at;
  if (!tx.s.paused) tx.interactive(true);
}

/** First /next (stash or request): the client clock anchors the timer. */
function applyFirst(tx: Tx, r: NextResponse) {
  const s = tx.s;
  s.durationSec = r.session.durationSec;
  s.sessionStartRating = r.currentRating;
  s.counters = { ...s.counters, peakRating: r.currentRating };
  s.endsAt = tx.at + r.session.durationSec * 1000;
  tx.schedule('timeUp', r.session.durationSec * 1000);
  if (!loadPuzzle(tx, r)) beginFinish(tx, true);
}

// ─── Attempt ────────────────────────────────────────────────────────────

/** web afterAttempt(): counters, feel, optimistic streak, POST /attempt. */
function resolve(tx: Tx, correct: boolean, square: Square) {
  const s = tx.s;
  const p = s.puzzle!;
  const responseMs = Math.min(MAX_RESPONSE_MS, Math.max(0, Math.round(tx.at - (s.turnStartedAt ?? tx.at))));
  s.counters = {
    solved: s.counters.solved + (correct ? 1 : 0),
    failed: s.counters.failed + (correct ? 0 : 1),
    totalResponseMs: s.counters.totalResponseMs + responseMs,
    peakRating: correct ? Math.max(s.counters.peakRating, p.rating) : s.counters.peakRating,
  };
  s.phase = 'resolving';
  tx.interactive(false);
  if (correct) {
    tx.feel('correct');
    tx.emit({ type: 'flash', square, ok: true });
    tx.emit({ type: 'sparks', square });
  } else {
    tx.feel('mistake');
    tx.emit({ type: 'flash', square, ok: false });
    tx.emit({ type: 'shake', square });
  }
  if (!correct && s.streak >= 2) {
    s.streakBroken = s.streak;
    tx.feel('streakBroken');
    tx.schedule('streakBroken', STREAK_BROKEN_MS);
  }
  s.streak = correct ? s.streak + 1 : 0;
  if (correct && s.streak >= 2) tx.feel('streakUp', { streak: s.streak });
  const reqId = tx.api('attempt', { sessionId: s.sessionId, puzzleId: p.id, correct, responseMs });
  s.pendingAttempt = { puzzleId: p.id, correct, responseMs, square, reqId };
  s.attemptDone = false;
}

/** The attempt round-trip is over (ok or not): queue the next puzzle, or a queued finish. */
function afterAttempt(tx: Tx, correct: boolean) {
  const s = tx.s;
  s.pendingAttempt = null;
  s.attemptDone = true;
  if (s.finishQueued) {
    const { save } = s.finishQueued;
    s.finishQueued = null;
    beginFinish(tx, save);
    return;
  }
  tx.schedule('next', correct ? NEXT_DELAY_MS.correct : NEXT_DELAY_MS.wrong);
}

function requestNext(tx: Tx) {
  tx.s.phase = 'loadingNext';
  tx.s.nextReqId = tx.api('next', { sessionId: tx.s.sessionId });
}

// ─── Finish ─────────────────────────────────────────────────────────────

function beginFinish(tx: Tx, save: boolean) {
  const s = tx.s;
  // web: the `finishing` ref guard; a second finish (timer + exit) is dropped.
  if (isOver(s) || s.finishQueued) return;
  tx.cancelAll(['streakBroken']);
  tx.interactive(false);
  s.endsAt = null;
  // fix: the web raced /finish against an in-flight /attempt and could lose
  // the last attempt to "session ended". A save waits for it to land; one
  // restored from a snapshot and not re-sent yet goes out first.
  if (save && s.pendingAttempt) {
    const a = s.pendingAttempt;
    if (a.reqId == null) {
      s.pendingAttempt = { ...a, reqId: tx.api('attempt', { sessionId: s.sessionId, puzzleId: a.puzzleId, correct: a.correct, responseMs: a.responseMs }) };
    }
    s.finishQueued = { save };
    // The clock is over: drop the overlay so a resume can't restart it.
    s.paused = false;
    s.pausedAt = null;
    s.pausedRemainingMs = null;
    return;
  }
  s.phase = 'finishing';
  s.pendingAttempt = null;
  s.paused = false;
  s.pausedAt = null;
  s.nextReqId = null;
  s.heldNext = null;
  s.anim = null;
  s.finishReq = { reqId: tx.api('finish', { sessionId: s.sessionId, save }), save };
}

/** Network down at finish: the summary from client counters (web catch branch). */
function clientSummary(s: RunnerState): FinishResponse {
  const n = attempts(s);
  return {
    sessionId: s.sessionId,
    solved: s.counters.solved,
    failed: s.counters.failed,
    accuracy: n > 0 ? s.counters.solved / n : 0,
    avgResponseMs: n > 0 ? s.counters.totalResponseMs / n : 0,
    peakRating: s.counters.peakRating,
  };
}

function toSummary(tx: Tx, source: 'server' | 'client' | 'detail', summary: FinishResponse) {
  tx.s.phase = 'summary';
  tx.s.finishReq = null;
  tx.s.result = { kind: 'summary', source, summary };
  tx.emit({ type: 'clearSnapshot' });
}

function toDiscarded(tx: Tx) {
  tx.s.phase = 'summary';
  tx.s.finishReq = null;
  tx.s.result = { kind: 'discarded' };
  tx.emit({ type: 'clearSnapshot' });
  tx.emit({ type: 'exit' });
}

// ─── Pause ──────────────────────────────────────────────────────────────

function pause(tx: Tx, source: 'user' | 'background') {
  const s = tx.s;
  // web pause(): no-op before the clock runs, when finishing, or when paused.
  if (s.paused || s.endsAt == null || isOver(s) || s.finishQueued) return;
  s.paused = true;
  s.pausedAt = tx.at;
  s.pausedRemainingMs = Math.max(0, s.endsAt - tx.at);
  s.endsAt = null;
  // fix: the web left its timeouts running under the overlay.
  for (const id of Object.keys(s.timers) as TimerId[]) {
    const t = s.timers[id]!;
    if (t.dueAt == null) continue;
    s.timers[id] = { ms: Math.max(0, t.dueAt - tx.at), dueAt: null };
    tx.emit({ type: 'cancel', id });
  }
  tx.interactive(false);
  if (source === 'user') tx.feel('pause');
}

function resume(tx: Tx, source: 'user' | 'foreground') {
  const s = tx.s;
  if (!s.paused) return;
  const pausedFor = tx.at - (s.pausedAt ?? tx.at);
  s.paused = false;
  s.pausedAt = null;
  // Thinking time counts active time only (web resume()).
  if (s.turnStartedAt != null) s.turnStartedAt += pausedFor;
  s.endsAt = tx.at + (s.pausedRemainingMs ?? 0);
  s.pausedRemainingMs = null;
  for (const id of Object.keys(s.timers) as TimerId[]) {
    const t = s.timers[id]!;
    s.timers[id] = { ms: t.ms, dueAt: tx.at + t.ms };
    tx.emit({ type: 'schedule', id, ms: t.ms, event: { type: 'timer', id } });
  }
  if (source === 'user') tx.feel('resume');

  // Work that arrived under the overlay.
  if (s.anim?.landed) {
    land(tx, s.anim);
  } else if (s.heldNext) {
    const r = s.heldNext;
    s.heldNext = null;
    if (!loadPuzzle(tx, r)) nextFailed(tx);
  } else if (s.pendingAttempt && s.pendingAttempt.reqId == null) {
    // Restored from a snapshot before its /attempt landed: send it again.
    const a = s.pendingAttempt;
    s.pendingAttempt = { ...a, reqId: tx.api('attempt', { sessionId: s.sessionId, puzzleId: a.puzzleId, correct: a.correct, responseMs: a.responseMs }) };
  } else if (s.phase === 'loadingNext' && s.nextReqId == null && !s.timers.nextRetry) {
    requestNext(tx);
  } else if (s.phase === 'playerTurn') {
    tx.interactive(true);
  }
}

// ─── Board slides ───────────────────────────────────────────────────────

function land(tx: Tx, a: PendingAnim) {
  const s = tx.s;
  s.anim = null;
  s.fen = a.fenAfter;
  s.lastMove = a.lastMove;
  if (a.kind === 'opponent') s.remaining = s.remaining.slice(1);
  if (!a.landed) tx.feel('opponentLanding', { move: a.move });
  if (a.kind === 'setup') startTurn(tx);
  else if (s.remaining.length === 0) {
    // A line that ends on the opponent's move: the player did their part
    // (the web waited forever on an empty `remaining`).
    resolve(tx, true, a.lastMove.to);
  } else {
    // The thinking-time anchor stays at the setup landing (web attemptStart).
    s.phase = 'playerTurn';
    tx.interactive(true);
  }
}

function onAnimationDone(tx: Tx, id: number) {
  const a = tx.s.anim;
  if (!a || a.id !== id || isOver(tx.s)) return;
  // Landed under the overlay (e.g. backgrounded mid-slide): the board shows
  // the position, but the turn and its clock start on resume, silently.
  if (tx.s.paused) {
    tx.s.anim = { ...a, landed: true };
    tx.s.fen = a.fenAfter;
    tx.s.lastMove = a.lastMove;
    return;
  }
  land(tx, a);
}

function onOpponentReplyDue(tx: Tx) {
  const s = tx.s;
  if (s.phase !== 'opponentReplying' || !s.fen) return;
  const uci = s.remaining[0];
  const r = uci ? play(s.fen, uci) : null;
  if (!uci || !r) {
    // Broken line after a correct move: the player did their part.
    resolve(tx, true, s.lastMove?.to ?? 'a1');
    return;
  }
  const pm = parseUci(uci);
  const a: PendingAnim = { id: tx.nextId(), kind: 'opponent', fenAfter: r.fen, lastMove: { from: pm.from, to: pm.to }, move: r.move, landed: false };
  s.anim = a;
  tx.emit({
    type: 'animate', id: a.id, from: pm.from, to: pm.to, ms: s.animMs,
    promotion: pm.promotion as RunnerEffectPromotion, done: { type: 'animationDone', id: a.id },
  });
}

// ─── Player move ────────────────────────────────────────────────────────

/** web handleMove(): expected-move check, alternative mates, reply scheduling. */
function onMove(tx: Tx, from: Square, to: Square, promotion?: string) {
  const s = tx.s;
  const expected = s.remaining[0];
  if (s.phase !== 'playerTurn' || s.paused || !s.fen || !s.puzzle || !expected) {
    tx.emit({ type: 'rejectMove' });
    return;
  }
  const candidate = uciFromMove({ from, to, promotion });
  const r = play(s.fen, candidate);
  if (!r) {
    tx.emit({ type: 'rejectMove' });
    return;
  }
  s.fen = r.fen;
  s.lastMove = { from, to };
  // The board runs with moveFeel='caller', so the move's own click is ours to
  // play: a wrong move gets only `mistake`, a winning one only `correct`
  // (resolve) — the web suppressed the click on the winning move too.
  if (candidate !== expected) {
    // Lichess lists one solution, but any mate solves the puzzle. A wrong
    // move stays on the board until the next puzzle loads.
    resolve(tx, r.mate, to);
    return;
  }
  const afterExpected = s.remaining.slice(1);
  s.remaining = afterExpected;
  if (afterExpected.length === 0) {
    resolve(tx, true, to);
    return;
  }
  tx.feel(moveFeelEvent(r.move), { move: r.move });
  s.phase = 'opponentReplying';
  tx.interactive(false);
  tx.schedule('opponentReply', Math.max(s.animMs, MIN_REPLY_DELAY_MS));
}

// ─── API results ────────────────────────────────────────────────────────

function onNextOk(tx: Tx, reqId: number, r: NextResponse) {
  const s = tx.s;
  if (s.phase === 'booting' && reqId === s.nextReqId) {
    s.nextReqId = null;
    applyFirst(tx, r);
    return;
  }
  if (s.phase !== 'loadingNext' || reqId !== s.nextReqId) return;
  s.nextReqId = null;
  if (s.paused) {
    s.heldNext = r;
    return;
  }
  if (!loadPuzzle(tx, r)) nextFailed(tx);
}

function nextFailed(tx: Tx) {
  const s = tx.s;
  s.nextReqId = null;
  if (!s.nextRetried) {
    s.nextRetried = true;
    s.phase = 'loadingNext';
    tx.schedule('nextRetry', NEXT_RETRY_MS);
    return;
  }
  beginFinish(tx, true);
}

function onAttemptResult(tx: Tx, reqId: number, data: AttemptResponse | null) {
  const s = tx.s;
  const a = s.pendingAttempt;
  if (!a || a.reqId !== reqId || isOver(s)) return;
  if (data) {
    s.rating = data.newRating;
    patchProgression(tx, s.style, data.newRating);
    if (typeof data.streak === 'number') s.streak = data.streak;
  }
  // Errors are swallowed as on the web: the session goes on.
  afterAttempt(tx, a.correct);
}

function onFinishResult(tx: Tx, reqId: number, data: FinishResponse | null) {
  const s = tx.s;
  const f = s.finishReq;
  if (s.phase !== 'finishing' || !f || f.reqId !== reqId) return;
  if (data?.discarded) return toDiscarded(tx);
  if (data) {
    tx.emit({ type: 'finished', response: data });
    return toSummary(tx, 'server', data);
  }
  // fix: a failed discard still leaves (the session is orphaned server-side
  // until the sweeper); the web showed a zero summary instead.
  if (!f.save) return toDiscarded(tx);
  toSummary(tx, 'client', clientSummary(s));
}

function onDetailResult(tx: Tx, reqId: number, data: SessionAggregates | null) {
  const s = tx.s;
  if (s.phase !== 'booting' || reqId !== s.detailReqId) return;
  s.detailReqId = null;
  const d = data ?? { solved: 0, failed: 0, accuracy: 0, avgResponseMs: 0, peakRating: 0 };
  toSummary(tx, 'detail', { sessionId: s.sessionId, ...d });
}

// ─── Reducer ────────────────────────────────────────────────────────────

function onTimer(tx: Tx, id: TimerId) {
  const s = tx.s;
  const t = s.timers[id];
  if (!t || t.dueAt == null) return; // cancelled or parked
  delete s.timers[id];
  switch (id) {
    case 'timeUp':
      return beginFinish(tx, true);
    case 'opponentReply':
      return onOpponentReplyDue(tx);
    case 'next':
    case 'nextRetry':
      if (s.phase === 'resolving' || s.phase === 'loadingNext') requestNext(tx);
      return;
    case 'streakBroken':
      s.streakBroken = null;
      return;
  }
}

function sessionStep(tx: Tx, e: RunnerEvent) {
  const s = tx.s;
  switch (e.type) {
    case 'boot': {
      if (s.phase !== 'booting' || s.nextReqId != null || s.detailReqId != null) return;
      if (e.stash) return applyFirst(tx, e.stash);
      s.nextReqId = tx.api('next', { sessionId: s.sessionId });
      return;
    }
    case 'move':
      return onMove(tx, e.from, e.to, e.promotion);
    case 'animationDone':
      return onAnimationDone(tx, e.id);
    case 'timer':
      return onTimer(tx, e.id);
    case 'tick':
      if (!s.paused && s.endsAt != null && e.at >= s.endsAt && !isOver(s)) {
        tx.cancel('timeUp');
        beginFinish(tx, true);
      }
      return;
    case 'pause':
      return pause(tx, e.source);
    case 'resume':
      return resume(tx, e.source);
    case 'requestExit':
      if (isOver(s) || s.finishQueued) return;
      // web requestExit(): nothing to keep → discard straight away.
      if (attempts(s) === 0) return beginFinish(tx, false);
      tx.feel('exitSheet');
      tx.emit({ type: 'confirmExit' });
      return;
    case 'finish':
      if (!e.save && !isOver(s) && !s.finishQueued && attempts(s) > 0) tx.feel('discard');
      return beginFinish(tx, e.save);
    case 'configure':
      if (e.animMs != null) s.animMs = e.animMs;
      if (e.fixedColor != null) s.fixedColor = e.fixedColor;
      return;
    case 'apiOk':
      switch (e.call) {
        case 'next': return onNextOk(tx, e.reqId, e.data);
        case 'attempt': return onAttemptResult(tx, e.reqId, e.data);
        case 'finish': return onFinishResult(tx, e.reqId, e.data);
        case 'detail': return onDetailResult(tx, e.reqId, e.data);
      }
      return;
    case 'apiError':
      switch (e.call) {
        case 'next':
          if (s.phase === 'booting' && e.reqId === s.nextReqId) {
            // web: /next 400s once the session ended; show its real aggregates.
            s.nextReqId = null;
            s.detailReqId = tx.api('detail', { sessionId: s.sessionId });
            return;
          }
          if (s.phase === 'loadingNext' && e.reqId === s.nextReqId) nextFailed(tx);
          return;
        case 'attempt': return onAttemptResult(tx, e.reqId, null);
        case 'finish': return onFinishResult(tx, e.reqId, null);
        case 'detail': return onDetailResult(tx, e.reqId, null);
      }
  }
}

/**
 * (state, event) → { state, effects }. Pure: no clock, no I/O. When nothing
 * changed the same state object comes back (React bails out of the render).
 */
export function runnerReducer(state: RunnerState, event: RunnerEvent): Transition {
  if (state.mode !== 'session') {
    // TODO(phase 6): drill / mistakes / viewer transitions.
    return { state, effects: [] };
  }
  const tx = new Tx(state, event.at);
  sessionStep(tx, event);
  if (shallowEqual(state, tx.s)) return { state, effects: tx.fx };
  // PLAN §2.10: a snapshot after every transition that changed the state.
  // Not while a finish is queued: toSnapshot has nothing resumable then.
  if (!isOver(tx.s) && !tx.s.finishQueued && tx.s.phase !== 'booting') tx.emit({ type: 'persistSnapshot' });
  return { state: tx.s, effects: tx.fx };
}

function shallowEqual(a: RunnerState, b: RunnerState): boolean {
  for (const k of Object.keys(a) as (keyof RunnerState)[]) {
    if (k === 'timers') continue;
    if (a[k] !== b[k]) return false;
  }
  const ta = Object.keys(a.timers) as TimerId[];
  const tb = Object.keys(b.timers) as TimerId[];
  return ta.length === tb.length && ta.every((id) => a.timers[id] === b.timers[id]);
}
