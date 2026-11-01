#!/usr/bin/env node
// The gate for a Library book file. Re-checks everything from scratch:
//
//   node tools/library/verify.mjs apps/backend/src/library/content/greco.json [--depth 22] [--workers 8]
//
// 1. Schema: exact keys, ids, localized strings, note length, theme slugs
//    (from packages/core/src/themes/index.ts), year < 1930, source URL.
// 2. Replay with chess.js: fen valid, every move legal, the line ends on a
//    solver move, mate puzzles end in checkmate with mateIn = solver moves.
// 3. Stockfish (MultiPV 2, depth >= 22, depth 28 near a threshold) on every
//    position of the line: each solver move is the engine's best and an only
//    move, each defender move is a best defence, win lines end >= +300 with
//    the material actually won. Rules: README.md.
// 4. If the game page is cached ($LIBRARY_CACHE/game-<gid>.html), the setup
//    and first solver move are the game's moves, and a puzzle without
//    `deviates` follows the game for as long as the game lasts.
// Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, Chess, REPO, cleanPgn, enginePool, fmt, material, posKey, realizedGain } from './lib.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => a.endsWith('.json'));
const opt = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const DEPTH = Math.max(22, opt('--depth', 22));
const DEEP = Math.max(DEPTH + 6, 28);
const WORKERS = opt('--workers', 8);
if (!file) {
  console.error('usage: verify.mjs <book.json> [--depth 22] [--workers 8]');
  process.exit(2);
}

// Thresholds, restated here on purpose (independent of mine.mjs).
const WIN_BEST = 300, WIN_SECOND = 120, WIN_SECOND_VS_MATE = 300, TRIVIAL = 500, DEF_TOL = 60;
const M = 100000;
const v = (s) => (!s ? -Infinity : s.mate !== undefined ? (s.mate > 0 ? M - s.mate : -M - s.mate) : s.cp);
const mates = (s) => s && s.mate !== undefined && s.mate > 0;

const book = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

// ---------------------------------------------------------------- schema
const themeSrc = fs.readFileSync(path.join(REPO, 'packages/core/src/themes/index.ts'), 'utf8');
const KNOWN = new Set();
for (const block of themeSrc.matchAll(/const (EN|EN_EXTRA): Record<string, string> = \{([\s\S]*?)\n\};/g))
  for (const m of block[2].matchAll(/^\s+(\w+):/gm)) KNOWN.add(m[1]);
for (const m of /META_THEME_SLUGS = new Set<string>\(\[([\s\S]*?)\]\)/.exec(themeSrc)[1].matchAll(/"(\w+)"/g))
  KNOWN.add(m[1]);
KNOWN.delete('puzzle');

const exact = (obj, keys, where, optional = []) => {
  if (!obj || typeof obj !== 'object') return fail(where, 'not an object');
  for (const k of keys) if (!(k in obj)) fail(where, `missing key ${k}`);
  for (const k of Object.keys(obj)) if (!keys.includes(k) && !optional.includes(k)) fail(where, `unexpected key ${k}`);
};
const loc = (o, where, max) => {
  exact(o, ['en', 'uk'], where);
  for (const l of ['en', 'uk']) {
    if (typeof o?.[l] !== 'string' || !o[l].trim()) fail(where, `empty ${l}`);
    else if (max && [...o[l]].length > max) fail(where, `${l} is ${[...o[l]].length} chars (> ${max})`);
  }
  if (o?.uk && /[ыэъё]/i.test(o.uk)) fail(where, 'uk text has Russian letters');
};

exact(book, ['id', 'version', 'chapters'], 'book');
if (!Number.isInteger(book.version) || book.version < 1) fail('book', 'version must be an integer >= 1');
const ids = new Set();
const positions = new Map();
const puzzles = [];
(book.chapters || []).forEach((ch, ci) => {
  const cw = `chapter ${ch.id}`;
  exact(ch, ['id', 'title', 'subtitle', 'puzzles'], cw, ['exam']);
  if ('exam' in ch && ch.exam !== true) fail(cw, 'exam, when present, must be true');
  if (ch.id !== `${book.id}-${ci + 1}`) fail(cw, `id should be ${book.id}-${ci + 1}`);
  loc(ch.title, `${cw} title`, 28);
  loc(ch.subtitle, `${cw} subtitle`, 40);
  let prevRating = 0;
  (ch.puzzles || []).forEach((p, pi) => {
    const w = p.id || `${cw}#${pi}`;
    exact(p, ['id', 'fen', 'moves', 'goal', 'mateIn', 'rating', 'themes', 'deviates', 'game', 'note'], w);
    const want = `lib-${ch.id}-${String(pi + 1).padStart(2, '0')}`;
    if (p.id !== want) fail(w, `id should be ${want}`);
    if (ids.has(p.id)) fail(w, 'duplicate id');
    ids.add(p.id);
    if (!['mate', 'win'].includes(p.goal)) fail(w, `bad goal ${p.goal}`);
    if (p.goal === 'mate' && !(Number.isInteger(p.mateIn) && p.mateIn >= 1)) fail(w, 'mateIn missing');
    if (p.goal === 'win' && p.mateIn !== null) fail(w, 'mateIn must be null for goal win');
    if (!Number.isInteger(p.rating) || p.rating < 600 || p.rating > 3000) fail(w, `bad rating ${p.rating}`);
    if (p.rating < prevRating) fail(w, `rating ${p.rating} below the previous puzzle's ${prevRating} (order by difficulty)`);
    prevRating = p.rating;
    if (typeof p.deviates !== 'boolean') fail(w, 'deviates must be boolean');
    if (!Array.isArray(p.themes) || !p.themes.length) fail(w, 'themes empty');
    for (const t of p.themes || []) if (!KNOWN.has(t)) fail(w, `unknown theme ${t}`);
    if (new Set(p.themes).size !== p.themes.length) fail(w, 'duplicate theme');
    const mateTags = (p.themes || []).filter((t) => /^mateIn\d$/.test(t));
    if (p.goal === 'mate') {
      const tag = `mateIn${Math.min(p.mateIn, 5)}`;
      if (mateTags.length !== 1 || mateTags[0] !== tag) fail(w, `themes need exactly ${tag}`);
    } else if (mateTags.length || p.themes?.includes('mate')) fail(w, 'win puzzle tagged as mate');
    if (!['opening', 'middlegame', 'endgame'].some((t) => p.themes?.includes(t))) fail(w, 'no phase theme');
    exact(p.game, ['white', 'black', 'year'], `${w} game`, ['event', 'site', 'date', 'result', 'source']);
    if (!(p.game?.year < 1930)) fail(w, `year ${p.game?.year} not before 1930`);
    if (!/^https:\/\//.test(p.game?.source || '')) fail(w, 'no source URL');
    loc(p.note, `${w} note`, 140);
    puzzles.push({ p, w });
  });
});

// ------------------------------------------------------- replay + engine
function gameMovesFromCache(src) {
  const gid = /gid=(\d+)/.exec(src || '')?.[1];
  const f = gid && path.join(CACHE_DIR, `game-${gid}.html`);
  if (!f || !fs.existsSync(f)) return null;
  const m = /<div id="olga-data"[^>]*pgn='([\s\S]*?)'/.exec(fs.readFileSync(f, 'utf8'));
  if (!m) return null;
  const pgn = m[1].replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  const c = new Chess();
  try {
    c.loadPgn(cleanPgn(pgn));
  } catch {
    return null;
  }
  return c.history({ verbose: true }).map((h) => ({ key: posKey(h.before), uci: h.from + h.to + (h.promotion || '') }));
}

async function analyse(e, fen, opts, borderFn) {
  let lines = await e.analyse(fen, { multipv: 2, depth: DEPTH, ...opts });
  if (borderFn && borderFn(lines)) lines = await e.analyse(fen, { multipv: 2, depth: DEEP, ...opts });
  return lines;
}

async function checkPuzzle(e, { p, w }) {
  const out = [];
  const bad = (m) => out.push(`${w}: ${m}`);
  let c;
  try {
    c = new Chess(p.fen);
  } catch (err) {
    return [`${w}: bad fen (${err.message})`];
  }
  const mv = p.moves.trim().split(/\s+/);
  if (mv.length < 2 || mv.length % 2) bad(`line must be setup + odd number of moves (has ${mv.length})`);
  const fens = [];
  for (const u of mv) {
    fens.push(c.fen());
    try {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    } catch {
      bad(`illegal move ${u}`);
      return out;
    }
  }
  const finalFen = c.fen();
  const solverN = (mv.length) / 2;
  if (p.goal === 'mate') {
    if (!c.isCheckmate()) bad('does not end in checkmate');
    if (p.mateIn !== solverN) bad(`mateIn ${p.mateIn} but ${solverN} solver moves`);
  } else if (c.isCheckmate()) bad('win puzzle ends in mate');
  const key = posKey(fens[1]);
  if (positions.has(key)) bad(`same position as ${positions.get(key)}`);
  positions.set(key, w);

  // game check (cached page)
  const gm = gameMovesFromCache(p.game.source);
  if (gm) {
    const i = gm.findIndex((h) => h.key === posKey(p.fen));
    if (i < 0) bad('fen not found in the cached game');
    else {
      if (gm[i].uci !== mv[0]) bad(`setup ${mv[0]} is not the game move ${gm[i].uci}`);
      if (gm[i + 1]?.uci !== mv[1]) bad(`first solver move ${mv[1]} is not the game move ${gm[i + 1]?.uci}`);
      if (!p.deviates)
        for (let j = 2; j < mv.length && gm[i + j]; j++)
          if (gm[i + j].uci !== mv[j]) {
            bad(`move ${j} ${mv[j]} differs from the game (${gm[i + j].uci}) but deviates=false`);
            break;
          }
    }
  }

  await e.newGame();
  const startMat = material(new Chess(fens[1]), new Chess(fens[1]).turn());
  const solverColor = new Chess(fens[1]).turn();
  const notes = [];
  for (let j = 1; j < mv.length; j++) {
    const fen = fens[j];
    const isSolver = j % 2 === 1;
    const sIdx = (j + 1) / 2; // 1-based solver move number
    if (isSolver) {
      const last = j === mv.length - 1;
      const lines = await analyse(e, fen, {}, (ls) => {
        const [b, s] = ls;
        if (!b || !s || mates(s.score)) return false;
        if (p.goal === 'mate') return Math.abs(v(s.score) - TRIVIAL) < 80;
        if (mates(b.score)) return Math.abs(v(s.score) - WIN_SECOND_VS_MATE) < 40;
        return Math.abs(v(b.score) - WIN_BEST) < 40 || Math.abs(v(s.score) - WIN_SECOND) < 40;
      });
      const [b, s] = lines;
      notes.push(`${mv[j]} best ${b.move} ${fmt(b.score)} d${b.depth} | 2nd ${s ? s.move + ' ' + fmt(s.score) : '—'}`);
      if (j === 1 && s && !mates(s.score) && v(s.score) >= TRIVIAL)
        bad(`first move: second-best ${s.move} ${fmt(s.score)} already wins (trivial position)`);
      if (p.goal === 'mate') {
        const remaining = p.mateIn - sIdx + 1;
        if (!mates(b.score) || b.score.mate !== remaining)
          bad(`solver move ${sIdx}: engine says ${fmt(b.score)}, line needs #${remaining}`);
        if (last) {
          // any mate is accepted by the app on the last move; the line's must mate
        } else {
          if (b.move !== mv[j]) bad(`solver move ${sIdx}: ${mv[j]} is not the best ${b.move}`);
          if (s && mates(s.score)) bad(`solver move ${sIdx}: second-best ${s.move} also mates (${fmt(s.score)})`);
        }
      } else {
        if (b.move !== mv[j]) bad(`solver move ${sIdx}: ${mv[j]} is not the best ${b.move} ${fmt(b.score)}`);
        if (mates(b.score)) {
          if (s && (mates(s.score) || v(s.score) > WIN_SECOND_VS_MATE))
            bad(`solver move ${sIdx}: best mates but second ${s.move} ${fmt(s.score)} also wins`);
        } else {
          if (v(b.score) < WIN_BEST) bad(`solver move ${sIdx}: best only ${fmt(b.score)}`);
          if (s && v(s.score) > WIN_SECOND) bad(`solver move ${sIdx}: second ${s.move} ${fmt(s.score)} > +${WIN_SECOND}`);
        }
      }
    } else {
      const [best] = await e.analyse(fen, { multipv: 1, depth: DEPTH });
      if (best.move !== mv[j]) {
        const [g] = await e.analyse(fen, { multipv: 1, depth: DEPTH, searchmoves: [mv[j]] });
        const same = best.score.mate !== undefined ? g.score.mate === best.score.mate
          : g.score.mate === undefined && v(best.score) - v(g.score) <= DEF_TOL;
        if (!same) bad(`defender move ${mv[j]} ${fmt(g.score)} is not a best defence (${best.move} ${fmt(best.score)})`);
      }
    }
  }
  if (p.goal === 'win') {
    const [d] = await e.analyse(finalFen, { multipv: 1, depth: DEPTH });
    const solverView = d.score.mate !== undefined ? (d.score.mate < 0 ? Infinity : -Infinity) : -d.score.cp;
    if (solverView < WIN_BEST) bad(`final eval ${fmt(d.score)} (defender view) is not >= +${WIN_BEST} for the solver`);
    // Realized: >= 2 points of material won against the best defence (after its
    // 1st and 3rd plies, so an in-between recapture does not count), or a forced mate.
    const gain = realizedGain(finalFen, d.pv, solverColor, startMat);
    const forcedMate = d.score.mate !== undefined && d.score.mate < 0;
    if (gain < 2 && !forcedMate) bad(`material gain after the best reply is only ${gain} and no forced mate`);
  }
  return { errs: out, notes };
}

// Soft target: at most 30% mate-in-1 per book (a warning, not a failure).
const m1 = puzzles.filter(({ p }) => p.goal === 'mate' && p.mateIn === 1).length;
if (puzzles.length && m1 / puzzles.length > 0.3)
  console.log(`warning: ${m1}/${puzzles.length} puzzles are mate in 1 (> 30%)`);

const pool = enginePool(WORKERS, { threads: 1, hash: 128 });
const t0 = Date.now();
const results = await Promise.all(
  puzzles.map((x) =>
    pool.run(async (e) => {
      const r = await checkPuzzle(e, x);
      const errs = Array.isArray(r) ? r : r.errs;
      process.stderr.write(`${errs.length ? 'FAIL' : 'ok  '} ${x.w}${errs.length ? '\n  ' + errs.join('\n  ') : ''}\n`);
      return errs;
    }),
  ),
);
pool.close();
for (const r of results) errors.push(...r);
const st = pool.stats();
const per = (book.chapters || []).map((c) => `${c.id}: ${c.puzzles.length}`).join(', ');
console.log(
  `${path.basename(file)}: ${puzzles.length} puzzles (${per}); depth ${DEPTH}; ` +
    `${Math.round((Date.now() - t0) / 1000)} s wall, ${Math.round(st.engineMs / 1000)} s engine, ${Math.round(st.nodes / 1e6)}M nodes`,
);
if (errors.length) {
  console.log(`FAILED: ${errors.length} problem(s)`);
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log('PASS');
