#!/usr/bin/env node
// Find puzzle moments in fetched games and build verified lines.
//
//   LIBRARY_CACHE=… node tools/library/mine.mjs <book> [--workers 8] [--limit N] [--all]
//                                                 [--gids a,b,c] [--tag name] [--first gid,gid]
//                                                 [--back N] [--max-moves N] [--target N] [--endgame] [--depth N]
//
// Input  $LIBRARY_CACHE/games-<book>.json   (fetch-games.mjs)
// Output $LIBRARY_CACHE/candidates-<book>.json, rejects-<book>.json
//
// Pass 1 (cheap, depth 14, MultiPV 2): positions where the game's winner is
// to move, scanned backward from the end of the game (the first moment found
// is extended back move by move while it still verifies; one per game), or
// forward over every move with --all; keep moments where the game move is the engine's best
// and looks like an only move (mate <= 6, or best >= +250 with the second
// <= +150).
// Pass 2 (depth >= 22, MultiPV 2, depth 28 near a threshold): build the
// line from the moment, following the game while the game's moves pass the
// rules in lib.mjs (RULES + solverVerdict), substituting the engine's best
// defence (deviates) otherwise. See README.md for the rules.
import fs from 'node:fs';
import path from 'node:path';
import {
  CACHE_DIR, Chess, RULES, cleanPgn, borderline, enginePool, fmt, isMate, material, playUci, realizedGain,
  solverVerdict, uciOf, val,
} from './lib.mjs';

const args = process.argv.slice(2);
const book = args[0];
const opt = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const WORKERS = opt('--workers', 8);
const LIMIT = opt('--limit', Infinity);
const ALL = args.includes('--all'); // every moment, not one per game
// --gids a,b,c: only these games; --tag x: write candidates-<book>-x.json
const TAG = args.includes('--tag') ? `-${args[args.indexOf('--tag') + 1]}` : '';
const MAX_MATE = 5;
const MAX_WIN_MOVES = 5;
// backward mode scans at most the winner's last N moves (--back N)
const MAX_BACK = opt('--back', 40);
const MAX_MOVES = opt('--max-moves', Infinity); // skip games longer than this
const TARGET = opt('--target', Infinity); // stop once this many candidates exist
// --endgame: only consider positions with the queens off or <= 6 pieces
// (kings and pawns not counted). Thresholds are unchanged.
const ENDGAME = args.includes('--endgame');
// --depth N: search depth while mining (default RULES.depth = 22). A lower
// depth is only a cheaper pre-filter: verify.mjs re-checks at >= 22 and is the gate.
const DEPTH = opt('--depth', RULES.depth);
function isEndgamePos(fen) {
  const board = fen.split(' ')[0];
  const queens = (board.match(/[qQ]/g) || []).length;
  const pieces = (board.match(/[nbrqNBRQ]/g) || []).length;
  return queens === 0 || pieces <= 6;
}
const FIRST = args.includes('--first') ? args[args.indexOf('--first') + 1].split(',').map(Number) : [];

const games = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, `games-${book}.json`), 'utf8'));
const pool = enginePool(WORKERS, { threads: 1, hash: 128 });
const t0 = Date.now();

async function deep(engine, fen, goal) {
  let lines = await engine.analyse(fen, { multipv: 2, depth: DEPTH });
  if (borderline(goal, lines)) lines = await engine.analyse(fen, { multipv: 2, depth: DEPTH + 6 });
  return lines;
}

/** Defender reply: the game's move if it is a best defence, else the engine's. */
async function defend(engine, fen, gameMove) {
  const [best] = await engine.analyse(fen, { multipv: 1, depth: DEPTH });
  if (!gameMove) return { move: best.move, best, source: 'engine-after-game' };
  if (gameMove === best.move) return { move: gameMove, best, source: 'game' };
  const [g] = await engine.analyse(fen, { multipv: 1, depth: DEPTH, searchmoves: [gameMove] });
  const okMate = best.score.mate !== undefined && g.score.mate === best.score.mate;
  const okCp =
    best.score.mate === undefined && g.score.mate === undefined &&
    val(best.score) - val(g.score) <= RULES.defenderTolerance;
  if (okMate || okCp) return { move: gameMove, best, source: 'game' };
  return { move: best.move, best, source: 'engine', gameMove, gameScore: g.score };
}

async function buildLine(engine, game, history, ply, firstLines) {
  // history: verbose moves of the game; ply: index of the solver's first move.
  const start = new Chess(history[ply].before);
  const solver = start.turn();
  const setup = history[ply - 1];
  const goal = isMate(firstLines[0].score) && firstLines[0].score.mate <= MAX_MATE ? 'mate' : 'win';
  const chess = new Chess(history[ply].before);
  const mat0 = material(chess, solver);
  const moves = [];
  const log = [];
  let following = true;
  let deviates = false;
  let beyondGame = false;
  const snaps = []; // win goal: after each solver move (+ defender reply)
  let k = ply;
  for (let n = 0; ; n++) {
    const fen = chess.fen();
    const lines = n === 0 ? firstLines : await deep(engine, fen, goal);
    const gameMove = following && history[k] ? uciOf(history[k]) : null;
    if (!gameMove && following) beyondGame = true;
    let played = gameMove || lines[0]?.move;
    const isLast = goal === 'mate' && isMate(lines[0]?.score) && lines[0].score.mate === 1;
    let verdict;
    if (isLast) {
      const c = new Chess(fen);
      playUci(c, played);
      if (!c.isCheckmate()) {
        if (n === 0) return { reject: 'first move does not mate' };
        played = lines[0].move;
        deviates = true;
        following = false;
      }
      const s = lines[1];
      verdict =
        n === 0 && s && !isMate(s.score) && val(s.score) >= RULES.trivialSecond
          ? { ok: false, why: `trivial: second ${s.move} ${fmt(s.score)}` }
          : { ok: true };
    } else {
      verdict = solverVerdict(goal, lines, played, false, n === 0);
      if (!verdict.ok && n > 0 && played !== lines[0]?.move && gameMove) {
        // The game took another road; the engine's best may still be unique.
        const v2 = solverVerdict(goal, lines, lines[0].move, false, false);
        if (v2.ok) {
          played = lines[0].move;
          deviates = true;
          following = false;
          verdict = v2;
        }
      }
    }
    log.push({ fen, best: lines[0] && `${lines[0].move} ${fmt(lines[0].score)} d${lines[0].depth}`,
      second: lines[1] && `${lines[1].move} ${fmt(lines[1].score)}`, played });
    if (!verdict.ok) {
      if (goal === 'mate' || n === 0) return { reject: verdict.why, goal, at: n, log };
      break; // win goal: line ends before the first non-unique move
    }
    playUci(chess, played);
    moves.push(played);
    k++;
    if (chess.isCheckmate()) break;
    if (chess.isGameOver()) return { reject: 'draw by rule in line', log };
    if (goal === 'mate' && moves.length / 2 > MAX_MATE) return { reject: 'mate too long', log };
    // defender
    const gm = following && history[k] ? uciOf(history[k]) : null;
    if (following && !history[k]) beyondGame = true;
    const d = await defend(engine, chess.fen(), gm);
    if (d.source !== 'game') {
      following = false;
      if (d.source === 'engine') deviates = true;
    }
    const gain = goal === 'win' ? realizedGain(chess.fen(), d.best.pv, solver, mat0) : 0;
    playUci(chess, d.move);
    moves.push(d.move);
    k++;
    if (goal === 'win') {
      snaps.push({
        len: moves.length - 1, // line length ending on this solver move
        gain,
        evalAfter: -val(d.best.score), // solver view
        mateAfter: d.best.score.mate,
      });
      if (snaps.length >= MAX_WIN_MOVES) break;
    }
  }
  if (goal === 'mate') {
    if (!chess.isCheckmate()) return { reject: 'mate line did not end in mate', log };
  } else {
    if (chess.isCheckmate()) return { reject: 'win line ended in mate', log };
    let end = -1;
    for (let i = snaps.length - 1; i >= 0; i--) {
      const s = snaps[i];
      const won = s.mateAfter !== undefined ? s.mateAfter < 0 : s.evalAfter >= RULES.finalWin;
      // realized: material won (>= 2) and still winning, or a forced mate on the board
      if ((s.gain >= 2 && won) || (s.mateAfter !== undefined && s.mateAfter < 0)) { end = i; break; }
    }
    if (end < 0) return { reject: 'gain not realized', goal, log, snaps };
    moves.length = snaps[end].len;
    if (moves.length === 1 && setup.captured && moves[0].slice(2, 4) === setup.to)
      return { reject: 'plain recapture', log };
  }
  const solverMoves = Math.ceil(moves.length / 2);
  // Flags for the final (possibly trimmed) line.
  deviates = moves.some((m, i) => history[ply + i] && uciOf(history[ply + i]) !== m);
  beyondGame = ply + moves.length > history.length;
  return {
    goal,
    mateIn: goal === 'mate' ? solverMoves : undefined,
    fen: setup.before,
    moves: [uciOf(setup), ...moves].join(' '),
    deviates,
    beyondGame,
    ply,
    moveNo: Math.floor(ply / 2) + 1,
    log,
  };
}

async function mineGame(engine, game) {
  const c = new Chess();
  try {
    c.loadPgn(cleanPgn(game.pgn));
  } catch (e) {
    return { gid: game.gid, error: `pgn: ${e.message}` };
  }
  const history = c.history({ verbose: true });
  const result = game.headers.Result;
  const winner = result === '1-0' ? 'w' : result === '0-1' ? 'b' : null;
  if (!winner) return { gid: game.gid, error: 'no winner' };
  await engine.newGame();
  const found = [];
  const rejects = [];
  const tryPly = async (ply, extending = false) => {
    const mv = history[ply];
    if (ENDGAME && !isEndgamePos(mv.before)) return null;
    const quick = await engine.analyse(mv.before, { multipv: 2, depth: 14 });
    const [b, s] = quick;
    if (!b || b.move !== uciOf(mv) || !s) return null;
    // Loose versions of the pass-2 rules, so pass 2 sees few hopeless moments.
    const sMate = isMate(s.score);
    const mateCand =
      isMate(b.score) && b.score.mate <= MAX_MATE &&
      (b.score.mate === 1 ? sMate || val(s.score) < 600 : !sMate && val(s.score) < 600);
    const winCand = !mateCand && val(b.score) >= 250 && !sMate && val(s.score) <= 150;
    if (!mateCand && !winCand) return null;
    const firstLines = await deep(engine, mv.before, mateCand ? 'mate' : 'win');
    const r = await buildLine(engine, game, history, ply, firstLines);
    if (r.reject) {
      if (!extending) rejects.push({ gid: game.gid, ply, moveNo: Math.floor(ply / 2) + 1, reason: r.reject });
      return null;
    }
    return { gid: game.gid, source: game.source, headers: game.headers, ...r };
  };
  const winnerPlies = [];
  for (let ply = 1; ply < history.length; ply++) if (history[ply].color === winner) winnerPlies.push(ply);
  if (ALL) {
    // Forward over the whole game, skipping plies inside a found line.
    let coveredTo = -1;
    for (const ply of winnerPlies) {
      if (ply <= coveredTo) continue;
      const r = await tryPly(ply);
      if (r) {
        found.push(r);
        coveredTo = ply + r.moves.split(' ').length - 2;
      }
    }
  } else {
    // Backward from the end: the first moment found, extended back to the
    // earliest move from which the line still verifies; one per game.
    const stop = Math.max(0, winnerPlies.length - MAX_BACK);
    for (let i = winnerPlies.length - 1; i >= stop; i--) {
      let r = await tryPly(winnerPlies[i]);
      if (!r) continue;
      for (let j = i - 1; j >= 0; j--) {
        const earlier = await tryPly(winnerPlies[j], true);
        if (!earlier) break;
        r = earlier;
      }
      found.push(r);
      break;
    }
  }
  return { gid: game.gid, found, rejects };
}

const gidsArg = args.includes('--gids') ? args[args.indexOf('--gids') + 1].split(',').map(Number) : null;
// Round-robin over years, so a partial run already spans the whole era.
const byYear = new Map();
for (const g of games.filter((g) => !gidsArg || gidsArg.includes(g.gid))) {
  const y = (g.headers.Date || '').slice(0, 4);
  if (!byYear.has(y)) byYear.set(y, []);
  byYear.get(y).push(g);
}
const ordered = [];
for (let i = 0; ordered.length < [...byYear.values()].flat().length; i++)
  for (const list of byYear.values()) if (list[i]) ordered.push(list[i]);
const fullMoves = (g) => Math.ceil(Number(g.headers.PlyCount || 999) / 2);
const todoAll = [
  ...FIRST.map((id) => ordered.find((g) => g.gid === id)).filter(Boolean),
  ...ordered.filter((g) => !FIRST.includes(g.gid) && fullMoves(g) <= MAX_MOVES),
].slice(0, LIMIT);
// Progress is appended per game, so an interrupted run resumes where it stopped.
const progressFile = path.join(CACHE_DIR, `progress-${book}${TAG}.jsonl`);
const prior = fs.existsSync(progressFile)
  ? fs.readFileSync(progressFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : [];
const doneGids = new Set(prior.map((r) => r.gid));
const todo = todoAll.filter((g) => !doneGids.has(g.gid));
let done = 0;
let found = prior.reduce((a, r) => a + (r.found?.length || 0), 0);
const fresh = await Promise.all(
  todo.map((g) =>
    pool.run(async (e) => {
      if (found >= TARGET) return { gid: g.gid, skipped: true };
      const r = await mineGame(e, g);
      found += r.found?.length || 0;
      done++;
      fs.appendFileSync(progressFile, JSON.stringify(r) + '\n');
      process.stderr.write(
        `[${done}/${todo.length}] gid ${g.gid}: ${r.error || `${r.found.length} found, ${r.rejects.length} rejected`}\n`,
      );
      return r;
    }),
  ),
);
const results = [...prior, ...fresh.filter((r) => !r.skipped)];
pool.close();
const cands = results.flatMap((r) => r.found || []);
const rejects = results.flatMap((r) => r.rejects || (r.error ? [{ gid: r.gid, reason: r.error }] : []));
fs.writeFileSync(path.join(CACHE_DIR, `candidates-${book}${TAG}.json`), JSON.stringify(cands, null, 1));
fs.writeFileSync(path.join(CACHE_DIR, `rejects-${book}${TAG}.json`), JSON.stringify(rejects, null, 1));
const st = pool.stats();
const reasons = {};
for (const r of rejects) {
  const key = r.reason.replace(/\(.*|[a-h][1-8][a-h][1-8]\w?.*|[+-]?\d+.*$/, '').trim();
  reasons[key] = (reasons[key] || 0) + 1;
}
console.log(
  JSON.stringify(
    {
      book, games: results.length, candidates: cands.length,
      mate: cands.filter((c) => c.goal === 'mate').length,
      win: cands.filter((c) => c.goal === 'win').length,
      deviates: cands.filter((c) => c.deviates).length,
      rejected: rejects.length, reasons,
      wallSec: Math.round((Date.now() - t0) / 1000),
      engineSec: Math.round(st.engineMs / 1000), nodesM: Math.round(st.nodes / 1e6),
    },
    null, 1,
  ),
);
