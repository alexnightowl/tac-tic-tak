// Shared helpers for the Library pipeline: chess.js loader, a Stockfish
// UCI pool, score maths and the "only move" rules. verify.mjs re-implements
// the line checks itself and uses only the engine + chess plumbing from here.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '../..');

// chess.js lives in packages/core's node_modules (pnpm, not hoisted).
const require = createRequire(path.join(REPO, 'packages/core/package.json'));
export const { Chess } = require('chess.js');

export const CACHE_DIR =
  process.env.LIBRARY_CACHE || path.join(os.tmpdir(), 'tac-library-cache');
export const STOCKFISH = process.env.STOCKFISH || '/opt/homebrew/bin/stockfish';

// ---------------------------------------------------------------- thresholds
export const RULES = {
  depth: 22, // minimum search depth per solver position
  deepDepth: 28, // re-search depth when a decision is borderline
  borderline: 40, // cp distance from a threshold that triggers the re-search
  winBest: 300, // goal win: best must be >= this
  winSecond: 120, // goal win: second-best must be <= this
  winSecondVsMate: 300, // goal win, best is a mate: second must be no mate and <= this
  trivialSecond: 500, // first solver move: second-best >= this means "already won anyway"
  defenderTolerance: 60, // a game defence is kept when within this of the best defence
  finalWin: 300, // goal win: eval after the last solver move
};

// --------------------------------------------------------------- score maths
const MATE = 100000;
/** Score object {cp} | {mate} (side-to-move view) -> sortable number. */
export function val(s) {
  if (!s) return -Infinity;
  if (s.mate !== undefined) return s.mate > 0 ? MATE - s.mate : -MATE - s.mate;
  return s.cp;
}
export const isMate = (s) => s && s.mate !== undefined && s.mate > 0;
export const isMated = (s) => s && s.mate !== undefined && s.mate <= 0;
export const neg = (s) =>
  s.mate !== undefined ? { mate: -s.mate } : { cp: -s.cp };
export function fmt(s) {
  if (!s) return '—';
  return s.mate !== undefined ? `#${s.mate}` : `${s.cp >= 0 ? '+' : ''}${s.cp}`;
}

// ------------------------------------------------------------ engine (UCI)
/** Node cap per search: 8M at depth <= 22, 25M for the deeper re-searches. */
export const nodeCap = (depth) => (depth <= 22 ? 8e6 : 25e6);

class Engine {
  constructor({ threads = 1, hash = 128 } = {}) {
    this.p = spawn(STOCKFISH, [], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.buf = '';
    this.waiters = [];
    this.lineHandler = null;
    this.nodesTotal = 0;
    this.msTotal = 0;
    this.p.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (this.lineHandler) this.lineHandler(line);
      }
    });
    this.ready = (async () => {
      await this.cmdUntil('uci', (l) => l === 'uciok');
      this.send(`setoption name Threads value ${threads}`);
      this.send(`setoption name Hash value ${hash}`);
      await this.isready();
    })();
  }
  send(c) {
    this.p.stdin.write(c + '\n');
  }
  cmdUntil(c, done, onLine) {
    return new Promise((resolve) => {
      this.lineHandler = (l) => {
        if (onLine) onLine(l);
        if (done(l)) {
          this.lineHandler = null;
          resolve(l);
        }
      };
      this.send(c);
    });
  }
  isready() {
    return this.cmdUntil('isready', (l) => l === 'readyok');
  }
  async newGame() {
    await this.ready;
    this.send('ucinewgame');
    await this.isready();
  }
  /**
   * Analyse `fen`. Returns [{move, score, depth, nodes, pv}] best first.
   * opts: multipv, depth, nodes, searchmoves (array of uci).
   */
  async analyse(fen, { multipv = 2, depth = RULES.depth, nodes, searchmoves } = {}) {
    await this.ready;
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    const lines = new Map();
    let lastNodes = 0;
    const t0 = Date.now();
    // Stop at the depth or at the node cap, whichever comes first; the cap
    // (>= 3M nodes, see README) keeps pathological positions bounded.
    let go = `go depth ${depth} nodes ${nodes || nodeCap(depth)}`;
    if (searchmoves && searchmoves.length) go += ` searchmoves ${searchmoves.join(' ')}`;
    await this.cmdUntil(
      go,
      (l) => l.startsWith('bestmove'),
      (l) => {
        if (!l.startsWith('info ') || !l.includes(' pv ')) return;
        if (l.includes('lowerbound') || l.includes('upperbound')) return;
        const t = l.split(' ');
        const g = (k) => t[t.indexOf(k) + 1];
        const mpv = Number(t.includes('multipv') ? g('multipv') : 1);
        const si = t.indexOf('score');
        const score = t[si + 1] === 'mate' ? { mate: Number(t[si + 2]) } : { cp: Number(t[si + 2]) };
        const pv = t.slice(t.indexOf('pv') + 1);
        lastNodes = Number(g('nodes'));
        lines.set(mpv, { move: pv[0], score, depth: Number(g('depth')), nodes: lastNodes, pv });
      },
    );
    this.nodesTotal += lastNodes;
    this.msTotal += Date.now() - t0;
    return [...lines.keys()].sort((a, b) => a - b).map((k) => lines.get(k));
  }
  quit() {
    try {
      this.send('quit');
    } catch {}
  }
}

/** Fixed-size pool: pool.run(async (engine) => ...) */
export function enginePool(size = Math.max(1, os.cpus().length - 2), opts) {
  const engines = Array.from({ length: size }, () => new Engine(opts));
  const free = [...engines];
  const queue = [];
  const pump = () => {
    while (free.length && queue.length) {
      const e = free.pop();
      const { fn, resolve, reject } = queue.shift();
      fn(e)
        .then(resolve, reject)
        .finally(() => {
          free.push(e);
          pump();
        });
    }
  };
  return {
    size,
    run: (fn) =>
      new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        pump();
      }),
    stats: () => ({
      nodes: engines.reduce((a, e) => a + e.nodesTotal, 0),
      engineMs: engines.reduce((a, e) => a + e.msTotal, 0),
    }),
    close: () => engines.forEach((e) => e.quit()),
  };
}

// ------------------------------------------------------------- chess helpers
export function uciOf(m) {
  return m.from + m.to + (m.promotion || '');
}
export function playUci(chess, uci) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}
const PV = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** Material of `color` minus the other side, in pawns. */
export function material(chess, color) {
  let s = 0;
  for (const row of chess.board())
    for (const sq of row) if (sq) s += (sq.color === color ? 1 : -1) * PV[sq.type];
  return s;
}
export function pieceCount(chess) {
  let n = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type !== 'p' && sq.type !== 'k') n++;
  return n;
}
/**
 * Material won by `color` against the defender's best line: the minimum,
 * relative to `start`, after the PV's 1st and 3rd plies (defender moves), so
 * an in-between recapture does not count as "realized".
 */
export function realizedGain(fen, pv, color, start) {
  const c = new Chess(fen);
  let min = Infinity;
  for (let i = 0; i < Math.min(pv.length, 3); i++) {
    try {
      playUci(c, pv[i]);
    } catch {
      break;
    }
    if (i % 2 === 0) min = Math.min(min, material(c, color) - start);
  }
  return min === Infinity ? 0 : min;
}
/** FEN without the move counters (position identity). */
export const posKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

/** Whether the line's solver moves are unique, per RULES (shared by mine). */
export function solverVerdict(goal, lines, playedUci, isLast, isFirst) {
  const [b, s] = lines;
  if (!b) return { ok: false, why: 'no engine line' };
  if (b.move !== playedUci) return { ok: false, why: `not best (${b.move} ${fmt(b.score)})` };
  if (goal === 'mate') {
    if (!isMate(b.score)) return { ok: false, why: `best not mate ${fmt(b.score)}` };
    if (!isLast && s && isMate(s.score)) return { ok: false, why: `second also mates ${s.move} ${fmt(s.score)}` };
    if (isFirst && s && !isMate(s.score) && val(s.score) >= RULES.trivialSecond)
      return { ok: false, why: `trivial: second ${s.move} ${fmt(s.score)}` };
    return { ok: true };
  }
  if (isMate(b.score)) {
    if (s && (isMate(s.score) || val(s.score) > RULES.winSecondVsMate))
      return { ok: false, why: `second ${s.move} ${fmt(s.score)} vs mate` };
    return { ok: true };
  }
  if (val(b.score) < RULES.winBest) return { ok: false, why: `best only ${fmt(b.score)}` };
  if (s && val(s.score) > RULES.winSecond) return { ok: false, why: `second ${s.move} ${fmt(s.score)}` };
  return { ok: true };
}
/** Near a threshold -> worth a deeper search. */
export function borderline(goal, lines) {
  const [b, s] = lines;
  if (!b || !s) return false;
  const B = RULES.borderline;
  if (goal === 'mate') return !isMate(s.score) && Math.abs(val(s.score) - RULES.trivialSecond) < B * 2;
  if (isMate(b.score)) return !isMate(s.score) && Math.abs(val(s.score) - RULES.winSecondVsMate) < B;
  return (
    Math.abs(val(b.score) - RULES.winBest) < B || Math.abs(val(s.score) - RULES.winSecond) < B
  );
}

/** chess.js rejects tag names with digits (chessgames' "Source2"); drop such tags. */
export const cleanPgn = (pgn) =>
  pgn.split('\n').filter((l) => !/^\[\w*\d\w* "/.test(l)).join('\n');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
