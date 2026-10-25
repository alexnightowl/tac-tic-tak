// practiceReducer: the drill / mistakes / viewer runner as a pure reducer.
// Ported from the three diverged web pages (review/[puzzleId],
// sessions/[id]/review, puzzles/[puzzleId]); one behaviour is picked on
// purpose where they disagreed, marked "fix:".
import { Chess } from 'chess.js';
import type { Square } from '../../board';
import { moveFeelEvent } from '../../feel';
import { buildSolutionFens, initPuzzle, parseUci, SOLVED_PAUSE_MS, uciFromMove } from '../../puzzle';
import type { LastMove, MoveFeel } from '../types';
import type {
  PracticeConfig, PracticeEffect, PracticeEvent, PracticeItem, PracticeState, PracticeTimer,
  PracticeTransition, StepSource,
} from './types';

/** Wrong move stays on the board this long, then the puzzle rewinds (web 520 ms). */
export const REWIND_DELAY_MS = 520;
/** Opponent reply waits for the player's slide (web max(animMs, 80)). */
export const PRACTICE_REPLY_MIN_MS = 80;
/** Long-press auto-repeat steps slide this fast so the next step never queues behind. */
export const REPEAT_SLIDE_MS = 120;

export function createPractice(config: PracticeConfig): PracticeState {
  return {
    mode: config.mode,
    animMs: config.animMs,
    fixedColor: config.fixedColor,
    phase: 'idle',
    item: null,
    incoming: null,
    start: null,
    fen: null,
    lastMove: null,
    orientation: 'white',
    playerColor: 'w',
    remaining: [],
    hintLevel: 0,
    anim: null,
    seq: 0,
    timers: {},
    advanceReqId: null,
    error: null,
    queue: [],
    total: 0,
    solvedCount: 0,
    failedTries: 0,
    rewinds: 0,
    counterIds: [],
    drilled: 0,
    fens: null,
    ply: 0,
  };
}

class Tx {
  s: PracticeState;
  fx: PracticeEffect[] = [];
  constructor(prev: PracticeState) {
    this.s = { ...prev, timers: { ...prev.timers } };
  }
  emit(e: PracticeEffect) {
    this.fx.push(e);
  }
  nextId() {
    this.s.seq += 1;
    return this.s.seq;
  }
  schedule(id: PracticeTimer, ms: number) {
    this.s.timers[id] = true;
    this.fx.push({ type: 'schedule', id, ms: Math.max(0, Math.round(ms)) });
  }
  cancelAll() {
    for (const id of Object.keys(this.s.timers) as PracticeTimer[]) {
      delete this.s.timers[id];
      this.fx.push({ type: 'cancel', id });
    }
  }
  interactive(on: boolean) {
    this.fx.push({ type: 'interactive', on });
  }
  clearHint() {
    if (this.s.hintLevel === 0) return;
    this.s.hintLevel = 0;
    this.fx.push({ type: 'hint', level: 0, from: null, to: null });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function play(fen: string, uci: string): { fen: string; move: MoveFeel; mate: boolean } | null {
  const c = new Chess(fen);
  try {
    const m = c.move(parseUci(uci));
    return { fen: c.fen(), move: { san: m.san, flags: m.flags, captured: m.captured, promotion: m.promotion }, mate: c.isCheckmate() };
  } catch {
    return null;
  }
}

export const lastMoveOfUci = (uci: string): LastMove => {
  const m = parseUci(uci);
  return { from: m.from, to: m.to };
};

type Promo = Extract<PracticeEffect, { type: 'animate' }>['promotion'];

// ─── Puzzle load ────────────────────────────────────────────────────────

/** New puzzle on the board: reset to the pre-setup FEN and slide the setup move. */
function begin(tx: Tx, item: PracticeItem) {
  const s = tx.s;
  tx.cancelAll();
  s.item = item;
  s.incoming = null;
  s.anim = null;
  s.fens = null;
  s.ply = 0;
  s.hintLevel = 0;
  s.error = null;
  tx.interactive(false);
  let init;
  try {
    init = initPuzzle(item.puzzle);
  } catch {
    return broken(tx);
  }
  s.playerColor = init.playerColor;
  s.orientation =
    s.fixedColor === 'white' ? 'white' : s.fixedColor === 'black' ? 'black' : init.playerColor === 'w' ? 'white' : 'black';
  s.remaining = init.remaining;
  const setup = init.setupMove ? uciFromMove(init.setupMove) : null;
  s.start = { fen: init.postFen, lastMove: setup ? lastMoveOfUci(setup) : null, remaining: init.remaining };
  if (!setup) {
    s.fen = init.postFen;
    s.lastMove = null;
    tx.emit({ type: 'reset', fen: init.postFen, orientation: s.orientation });
    startTurn(tx);
    return;
  }
  const landed = play(init.preFen, setup);
  if (!landed) return broken(tx);
  s.fen = init.preFen;
  s.lastMove = null;
  s.phase = 'setupAnimating';
  tx.emit({ type: 'reset', fen: init.preFen, orientation: s.orientation });
  const lm = lastMoveOfUci(setup);
  s.anim = { id: tx.nextId(), kind: 'setup', fenAfter: landed.fen, lastMove: lm, move: landed.move };
  tx.emit({
    type: 'animate', id: s.anim.id, from: lm.from, to: lm.to, ms: s.animMs,
    promotion: init.setupMove?.promotion as Promo, done: { type: 'animationDone', id: s.anim.id },
  });
}

/** A line chess.js rejects: skip it where a queue exists, else show the error. */
function broken(tx: Tx) {
  const s = tx.s;
  s.error = 'broken';
  if (s.mode === 'mistakes') return popHead(tx);
  if (s.mode === 'drill' && s.item) return requestAdvance(tx);
  s.phase = 'done';
}

/** Next puzzle in place (no route push): fade out, then begin on `faded`. */
function swapTo(tx: Tx, item: PracticeItem) {
  const s = tx.s;
  tx.cancelAll();
  s.anim = null;
  s.incoming = item;
  s.phase = 'swapping';
  tx.interactive(false);
  tx.emit({ type: 'fadeOut' });
}

function startTurn(tx: Tx) {
  tx.s.phase = 'playerTurn';
  tx.interactive(true);
}

function land(tx: Tx) {
  const s = tx.s;
  const a = s.anim!;
  s.anim = null;
  s.fen = a.fenAfter;
  s.lastMove = a.lastMove;
  tx.emit({ type: 'feel', event: 'opponentLanding', ctx: { move: a.move } });
  if (a.kind === 'setup') return startTurn(tx);
  s.remaining = s.remaining.slice(1);
  // A line that ends on the opponent's move: the player did their part.
  if (s.remaining.length === 0) return solve(tx, a.lastMove.to);
  startTurn(tx);
}

// ─── Moves ──────────────────────────────────────────────────────────────

function onMove(tx: Tx, from: Square, to: Square, promotion?: string) {
  const s = tx.s;
  const expected = s.remaining[0];
  if (s.phase !== 'playerTurn' || !s.fen || !expected) {
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
  if (candidate !== expected) {
    // Any mate solves, as in the session runner (Lichess lists one line).
    if (r.mate) return solve(tx, to);
    return wrong(tx, to);
  }
  s.remaining = s.remaining.slice(1);
  tx.clearHint();
  if (s.remaining.length === 0) return solve(tx, to);
  // The board runs with moveFeel='caller': the click is ours to play.
  tx.emit({ type: 'feel', event: moveFeelEvent(r.move), ctx: { move: r.move } });
  // fix: the web drill accepted input during the reply delay (no opponentBusy).
  s.phase = 'opponentReplying';
  tx.interactive(false);
  tx.schedule('reply', Math.max(s.animMs, PRACTICE_REPLY_MIN_MS));
}

function wrong(tx: Tx, square: Square) {
  const s = tx.s;
  if (s.mode === 'mistakes') s.failedTries += 1;
  s.phase = 'rewinding';
  tx.interactive(false);
  tx.clearHint();
  tx.emit({ type: 'feel', event: 'mistake' });
  tx.emit({ type: 'flash', square, ok: false });
  tx.emit({ type: 'shake', square });
  tx.schedule('rewind', REWIND_DELAY_MS);
}

/**
 * fix: the web restarted the whole puzzle (setup slide again) and the
 * mistakes runner's comment promised a rotation it never did. Every mode
 * now slides the board back to the puzzle's start position, in place.
 */
function rewind(tx: Tx) {
  const s = tx.s;
  if (!s.start) return;
  s.rewinds += 1;
  s.fen = s.start.fen;
  s.lastMove = s.start.lastMove;
  s.remaining = s.start.remaining;
  tx.emit({ type: 'setPosition', fen: s.start.fen, lastMove: s.start.lastMove, ms: s.animMs });
  startTurn(tx);
}

function solve(tx: Tx, square: Square) {
  const s = tx.s;
  s.phase = 'solved';
  tx.interactive(false);
  tx.clearHint();
  tx.emit({ type: 'feel', event: 'correct' });
  tx.emit({ type: 'flash', square, ok: true });
  tx.emit({ type: 'sparks', square });
  if (s.mode === 'viewer') return;
  if (s.mode === 'mistakes') {
    s.solvedCount += 1;
    // Q14 (PROVISIONAL yes): a solved mistake also leaves the review queue.
    // Only failed attempts own a ReviewItem; resolving a slow one would 500.
    if (s.item?.reason === 'failed') tx.emit({ type: 'resolve', puzzleId: s.item.puzzle.id });
  } else {
    s.drilled += 1;
  }
  tx.schedule('advance', SOLVED_PAUSE_MS);
}

function onReplyDue(tx: Tx) {
  const s = tx.s;
  if (s.phase !== 'opponentReplying' || !s.fen) return;
  const uci = s.remaining[0];
  const r = uci ? play(s.fen, uci) : null;
  if (!uci || !r) return solve(tx, s.lastMove?.to ?? 'a1');
  const pm = parseUci(uci);
  s.anim = { id: tx.nextId(), kind: 'opponent', fenAfter: r.fen, lastMove: { from: pm.from, to: pm.to }, move: r.move };
  tx.emit({
    type: 'animate', id: s.anim.id, from: pm.from, to: pm.to, ms: s.animMs,
    promotion: pm.promotion as Promo, done: { type: 'animationDone', id: s.anim.id },
  });
}

// ─── Advance ────────────────────────────────────────────────────────────

function requestAdvance(tx: Tx) {
  const s = tx.s;
  s.phase = 'advancing';
  s.advanceReqId = tx.nextId();
  tx.emit({ type: 'advance', reqId: s.advanceReqId, puzzleId: s.item!.puzzle.id });
}

function popHead(tx: Tx) {
  const s = tx.s;
  s.queue = s.queue.slice(1);
  if (s.queue.length === 0) {
    tx.cancelAll();
    s.phase = 'done';
    tx.interactive(false);
    return;
  }
  swapTo(tx, s.queue[0]);
}

function onAdvanceDue(tx: Tx) {
  const s = tx.s;
  if (s.phase !== 'solved') return;
  if (s.mode === 'mistakes') return popHead(tx);
  if (s.mode === 'drill') requestAdvance(tx);
}

// ─── Hint ───────────────────────────────────────────────────────────────

function onHint(tx: Tx) {
  const s = tx.s;
  const expected = s.remaining[0];
  if (s.phase !== 'playerTurn' || !expected || s.hintLevel >= 2) return;
  const level = (s.hintLevel + 1) as 1 | 2;
  s.hintLevel = level;
  const m = parseUci(expected);
  tx.emit({ type: 'hint', level, from: m.from, to: level >= 2 ? m.to : null });
  // Level 1 lifts the piece (selection), level 2 adds the target (light tick).
  tx.emit({ type: 'feel', event: level === 1 ? 'pickup' : 'hoverLegal' });
}

// ─── Viewer ─────────────────────────────────────────────────────────────

function showSolution(tx: Tx) {
  const s = tx.s;
  if (s.mode !== 'viewer' || !s.item || s.phase === 'solution') return;
  let fens: string[];
  try {
    fens = buildSolutionFens(s.item.puzzle);
  } catch {
    return;
  }
  if (fens.length < 2) return;
  tx.cancelAll();
  tx.clearHint();
  s.anim = null;
  s.fens = fens;
  s.phase = 'solution';
  tx.interactive(false);
  goTo(tx, 1, null);
}

/** Single forward steps slide with the move's own feel; jumps snap with a tick. */
function goTo(tx: Tx, target: number, source: StepSource | 'seek' | null) {
  const s = tx.s;
  const moves = s.item!.puzzle.moves;
  const fens = s.fens!;
  const forwardOne = source !== null && source !== 'seek' && target === s.ply + 1;
  const lm = lastMoveOfUci(moves[target - 1]);
  if (forwardOne) {
    const r = play(fens[s.ply], moves[target - 1]);
    if (source === 'repeat') tx.emit({ type: 'feel', event: 'sliderTick' });
    else if (r) tx.emit({ type: 'feel', event: moveFeelEvent(r.move), ctx: { move: r.move } });
  } else if (source !== null) {
    tx.emit({ type: 'feel', event: 'sliderTick' });
  }
  const ms = forwardOne ? (source === 'repeat' ? Math.min(s.animMs, REPEAT_SLIDE_MS) : s.animMs) : 0;
  s.ply = target;
  s.fen = fens[target];
  s.lastMove = lm;
  tx.emit({ type: 'setPosition', fen: fens[target], lastMove: lm, ms });
}

function step(tx: Tx, target: number, source: StepSource | 'seek') {
  const s = tx.s;
  if (s.phase !== 'solution' || !s.fens || !s.item) return;
  const max = s.item.puzzle.moves.length;
  const t = Math.max(1, Math.min(max, Math.round(target)));
  if (t === s.ply) return;
  goTo(tx, t, source);
}

// ─── Reducer ────────────────────────────────────────────────────────────

function onTimer(tx: Tx, id: PracticeTimer) {
  if (!tx.s.timers[id]) return; // cancelled
  delete tx.s.timers[id];
  switch (id) {
    case 'reply':
      return onReplyDue(tx);
    case 'rewind':
      if (tx.s.phase === 'rewinding') rewind(tx);
      return;
    case 'advance':
      return onAdvanceDue(tx);
  }
}

function stepEvent(tx: Tx, e: PracticeEvent) {
  const s = tx.s;
  switch (e.type) {
    case 'start': {
      if (s.phase !== 'idle' || s.item) return;
      s.counterIds = e.counterIds ?? e.items.map((i) => i.puzzle.id);
      if (s.mode === 'mistakes') {
        s.queue = e.items;
        s.total = e.items.length;
      }
      if (e.items.length === 0) {
        s.phase = 'done';
        return;
      }
      return begin(tx, e.items[0]);
    }
    case 'loaded':
      if (s.phase !== 'advancing' || e.reqId !== s.advanceReqId) return;
      s.advanceReqId = null;
      if (!e.item) {
        s.phase = 'done';
        return;
      }
      return swapTo(tx, e.item);
    case 'loadFailed':
      if (s.phase !== 'advancing' || e.reqId !== s.advanceReqId) return;
      s.advanceReqId = null;
      s.phase = 'advanceFailed';
      return;
    case 'retry':
      if (s.phase === 'advanceFailed' && s.item) requestAdvance(tx);
      return;
    case 'faded':
      if (s.phase !== 'swapping' || !s.incoming) return;
      begin(tx, s.incoming);
      tx.emit({ type: 'fadeIn' });
      return;
    case 'move':
      return onMove(tx, e.from, e.to, e.promotion);
    case 'animationDone':
      if (!s.anim || s.anim.id !== e.id) return;
      return land(tx);
    case 'timer':
      return onTimer(tx, e.id);
    case 'hint':
      return onHint(tx);
    case 'showSolution':
      return showSolution(tx);
    case 'tryAgain':
      if (s.mode === 'viewer' && s.item && s.phase !== 'idle') begin(tx, s.item);
      return;
    case 'step':
      return step(tx, s.ply + e.delta, e.source);
    case 'seek':
      return step(tx, e.ply, 'seek');
    case 'configure':
      if (e.animMs != null) s.animMs = e.animMs;
      if (e.fixedColor != null) s.fixedColor = e.fixedColor;
      return;
  }
}

/** (state, event) → { state, effects }. Pure; the same state object comes back when nothing changed. */
export function practiceReducer(state: PracticeState, event: PracticeEvent): PracticeTransition {
  const tx = new Tx(state);
  stepEvent(tx, event);
  if (shallowEqual(state, tx.s)) return { state, effects: tx.fx };
  return { state: tx.s, effects: tx.fx };
}

function shallowEqual(a: PracticeState, b: PracticeState): boolean {
  for (const k of Object.keys(a) as (keyof PracticeState)[]) {
    if (k === 'timers') continue;
    if (a[k] !== b[k]) return false;
  }
  const ta = Object.keys(a.timers);
  const tb = Object.keys(b.timers);
  return ta.length === tb.length && ta.every((id) => id in b.timers);
}
