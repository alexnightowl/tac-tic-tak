#!/usr/bin/env node
// Turn mined candidates + a hand-curated selection into a book file.
//
//   LIBRARY_CACHE=… node tools/library/assemble.mjs <book> --list      # browse candidates
//   LIBRARY_CACHE=… node tools/library/assemble.mjs <book>             # write the book
//
// Selection: tools/library/books/<book>.json
//   { id, version, out, chapters: [{ title, subtitle, picks: [{ key: "<gid>:<ply>",
//     note: {en, uk}, themes?: [...], rating?: n }] }] }
// Themes and rating are computed here (heuristics in README.md) unless the
// pick overrides them. Puzzles are sorted by rating inside each chapter and
// numbered lib-<chapter>-NN.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, Chess, REPO, cleanPgn, material, pieceCount, playUci } from './lib.mjs';

const [book, ...rest] = process.argv.slice(2);
// candidates-<book>.json plus any tagged runs (candidates-<book>-<tag>.json; later files win).
const cands = fs
  .readdirSync(CACHE_DIR)
  .filter((f) => f === `candidates-${book}.json` || f.startsWith(`candidates-${book}-`))
  .sort((a, b) => (a.length - b.length) || a.localeCompare(b))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8')));
// Plus whatever an interrupted mine.mjs run already appended to progress-<book>*.jsonl.
for (const f of fs.readdirSync(CACHE_DIR))
  if (f === `progress-${book}.jsonl` || (f.startsWith(`progress-${book}-`) && f.endsWith('.jsonl')))
    for (const line of fs.readFileSync(path.join(CACHE_DIR, f), 'utf8').split('\n'))
      if (line.trim()) cands.push(...(JSON.parse(line).found || []));
// The game's own moves, to (re)derive `deviates` for the final line.
const gamesFile = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, `games-${book}.json`), 'utf8'));
const gameMoves = new Map(
  gamesFile.map((g) => {
    const c = new Chess();
    try {
      c.loadPgn(cleanPgn(g.pgn));
    } catch {
      return [g.gid, null]; // unparseable game: it has no candidates anyway
    }
    return [g.gid, c.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''))];
  }),
);
const gameHeaders = new Map(gamesFile.map((g) => [g.gid, g.headers]));
for (const c of cands) {
  c.headers = gameHeaders.get(c.gid) || c.headers; // freshest decoding of the page
  const gm = gameMoves.get(c.gid);
  const line = c.moves.split(' ').slice(1);
  c.deviates = line.some((m, i) => gm[c.ply + i] !== undefined && gm[c.ply + i] !== m);
  c.beyondGame = c.ply + line.length > gm.length;
}
const byKey = new Map(cands.map((c) => [`${c.gid}:${c.ply}`, c]));
// one entry per key (later sources win)
cands.splice(0, cands.length, ...byKey.values());

// Headers that carry no information (chessgames placeholders).
const VAGUE = new Set(['?', 'Unknown', 'Miscellaneous Game', 'Italy?', 'Europe', '']);
// One spelling per player.
const NAMES = {
  'Gioacchino Greco': 'Gioachino Greco',
  'Lionel Adalbert Bagration Felix Kieseritzky': 'Lionel Kieseritzky',
  'Karl Ernst Adolf Anderssen': 'Adolf Anderssen',
  'Morphy, Paul Charles': 'Paul Morphy',
  'Ignatz von Kolisch': 'Ignatz Kolisch',
  'Ignaz Kolisch': 'Ignatz Kolisch',
};

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

function analyseLine(c) {
  const chess = new Chess(c.fen);
  const mv = c.moves.split(' ');
  playUci(chess, mv[0]);
  const solver = chess.turn();
  const defender = solver === 'w' ? 'b' : 'w';
  const kingSq = (ch, col) => {
    for (const row of ch.board()) for (const s of row) if (s && s.type === 'k' && s.color === col) return s.square;
  };
  const start = new Chess(chess.fen());
  const dk = kingSq(start, defender);
  const info = {
    solver, hanging: false, anyCheck: false, quietFirst: false, checkFirst: false, captureFirst: false, sacrifice: false,
    queenSac: false, doubleCheck: false, discovered: false, fork: false, attraction: false,
    promotion: false, f7: false, smothered: false, backRank: false,
    moveNo: start.moveNumber(), pieces: pieceCount(start),
    dkFile: dk[0], dkRank: Number(dk[1]),
  };
  for (let j = 1; j < mv.length; j += 2) {
    const before = material(chess, solver);
    const pre = new Chess(chess.fen());
    const m = playUci(chess, mv[j]);
    if (j === 1) {
      // a capture of a piece nobody defended
      info.hanging = !!m.captured && m.captured !== 'p' && pre.attackers(m.to, defender).length === 0;
      info.checkFirst = chess.inCheck();
      info.captureFirst = !!m.captured;
      info.quietFirst = !m.captured && !chess.inCheck() && !m.promotion;
    }
    if (m.promotion) info.promotion = true;
    const target = solver === 'w' ? 'f7' : 'f2';
    if (m.to === target) info.f7 = true;
    if (chess.inCheck()) {
      const k = kingSq(chess, defender);
      const att = chess.attackers(k, solver);
      if (att.length >= 2) info.doubleCheck = true;
      else if (!att.includes(m.to)) info.discovered = true;
    }
    // fork: the moved piece hits two targets worth more than itself (or the king)
    const hits = [];
    for (const row of chess.board())
      for (const s of row)
        if (s && s.color === defender && s.type !== 'p' && (s.type === 'k' || VAL[s.type] > VAL[m.piece]) &&
            chess.attackers(s.square, solver).includes(m.to))
          hits.push(s.square);
    const next = mv[j + 2];
    if (hits.length >= 2 && next && next.slice(0, 2) === m.to && hits.includes(next.slice(2, 4))) info.fork = true;
    // fork, broader: two targets hit by the moved piece and one of them taken later in the line
    if (hits.length >= 2 && mv.slice(j + 2).some((u, k) => k % 2 === 0 && hits.includes(u.slice(2, 4)))) info.fork = true;
    if (chess.inCheck()) info.anyCheck = true;
    if (chess.isCheckmate()) {
      const k = kingSq(chess, defender);
      const att = chess.attackers(k, solver);
      if (m.piece === 'n' && att.length === 1) {
        // smothered: every neighbour of the king is its own piece
        const f = k.charCodeAt(0), r = Number(k[1]);
        let smothered = true;
        for (let df = -1; df <= 1; df++)
          for (let dr = -1; dr <= 1; dr++) {
            if (!df && !dr) continue;
            const ff = f + df, rr = r + dr;
            if (ff < 97 || ff > 104 || rr < 1 || rr > 8) continue;
            const s = chess.get(String.fromCharCode(ff) + rr);
            if (!s || s.color !== defender) smothered = false;
          }
        info.smothered = smothered;
      }
      const back = defender === 'w' ? '1' : '8';
      if (k[1] === back && ['r', 'q'].includes(m.piece) && m.to[1] === back) info.backRank = true;
      break;
    }
    const d = mv[j + 1];
    if (!d) break;
    const dm = playUci(chess, d);
    const net = material(chess, solver) - before;
    if (net <= -2) {
      info.sacrifice = true;
      if (dm.captured === 'q') info.queenSac = true;
      if (dm.piece === 'k' && dm.to === m.to) info.attraction = true;
    }
  }
  return info;
}

export function annotate(c) {
  const i = analyseLine(c);
  const n = Math.ceil((c.moves.split(' ').length - 1) / 2);
  const themes = [];
  if (c.goal === 'mate') themes.push(`mateIn${Math.min(n, 5)}`);
  themes.push(i.pieces <= 6 ? 'endgame' : i.moveNo <= 12 ? 'opening' : 'middlegame');
  const motifs = [];
  if (i.smothered) motifs.push('smotheredMate');
  if (i.backRank) motifs.push('backRankMate');
  if (i.doubleCheck) motifs.push('doubleCheck');
  if (i.discovered) motifs.push('discoveredAttack');
  if (i.fork) motifs.push('fork');
  if (i.attraction) motifs.push('attraction');
  if (i.sacrifice) motifs.push('sacrifice');
  if (i.promotion) motifs.push('promotion');
  if (c.goal === 'win' && i.hanging) motifs.push('hangingPiece');
  if (i.quietFirst) motifs.push('quietMove');
  if (i.f7) motifs.push('attackingF2F7');
  const kingHome = i.solver === 'w' ? [8, 7] : [1, 2];
  if (!kingHome.includes(i.dkRank)) motifs.push('exposedKing');
  else if (c.goal === 'mate' && 'fgh'.includes(i.dkFile)) motifs.push('kingsideAttack');
  else if (c.goal === 'mate' && 'abc'.includes(i.dkFile)) motifs.push('queensideAttack');
  // last resort for a line with checks: where the attack lands
  if (!motifs.length && i.anyCheck)
    motifs.push('fgh'.includes(i.dkFile) ? 'kingsideAttack' : 'abc'.includes(i.dkFile) ? 'queensideAttack' : 'exposedKing');
  if (!motifs.length && c.goal === 'mate') motifs.push('exposedKing'); // a mate on a central king
  themes.push(...motifs.slice(0, 3));
  // rating
  const base = c.goal === 'mate' ? [1000, 1400, 1750, 1950, 2100] : [1250, 1500, 1750, 1900, 2000];
  let r = base[Math.min(n, 5) - 1];
  if (i.quietFirst) r += 150;
  if (i.sacrifice) r += 100;
  if (i.queenSac) r += 50;
  if (i.checkFirst && i.captureFirst) r -= 75;
  r = Math.max(900, Math.min(2300, Math.round(r / 25) * 25));
  return { themes, rating: r, info: i };
}

function san(c) {
  const ch = new Chess(c.fen);
  const out = [];
  for (const [j, u] of c.moves.split(' ').entries()) {
    const no = ch.moveNumber();
    const w = ch.turn() === 'w';
    const m = playUci(ch, u);
    out.push((w ? `${no}.` : j === 0 || j === 1 ? `${no}...` : '') + m.san + (j === 0 ? ' |' : ''));
  }
  return out.join(' ');
}

if (rest.includes('--list')) {
  for (const c of cands) {
    const a = annotate(c);
    const h = c.headers;
    console.log(
      `${c.gid}:${c.ply}\t${(h.Date || '').slice(0, 4)}\t${h.White} - ${h.Black}\t${h.Event || ''}/${h.Site || ''}\t` +
        `${c.goal}${c.mateIn ? c.mateIn : ''}\t${a.rating}\t${c.deviates ? 'DEV ' : ''}${c.beyondGame ? 'BEYOND ' : ''}` +
        `${a.themes.join(',')}\t${san(c)}`,
    );
  }
  process.exit(0);
}

const selFile = process.env.LIBRARY_SELECTION || new URL(`./books/${book}.json`, import.meta.url);
const sel = JSON.parse(fs.readFileSync(selFile, 'utf8'));
const out = { id: sel.id, version: sel.version, chapters: [] };
sel.chapters.forEach((ch, ci) => {
  const chId = `${sel.id}-${ci + 1}`;
  const puzzles = ch.picks.map((pk) => {
    const c = byKey.get(pk.key);
    if (!c) throw new Error(`no candidate ${pk.key}`);
    const a = annotate(c);
    const h = c.headers;
    const year = Number((h.Date || '').slice(0, 4));
    const name = (n) => (NAMES[n] || n);
    const game = { white: pk.white || name(h.White), black: pk.black || name(h.Black) };
    const ev = pk.event ?? h.Event;
    const site = pk.site ?? h.Site;
    if (ev && !VAGUE.has(ev)) game.event = ev;
    if (site && !VAGUE.has(site)) game.site = site;
    game.year = year;
    if (h.Date) game.date = h.Date;
    game.result = h.Result;
    game.source = c.source;
    return {
      id: '',
      fen: c.fen,
      moves: c.moves,
      goal: c.goal,
      mateIn: c.goal === 'mate' ? c.mateIn : null,
      rating: pk.rating ?? a.rating,
      themes: pk.themes ?? a.themes,
      deviates: !!c.deviates,
      game,
      note: pk.note,
    };
  });
  puzzles.sort((a, b) => a.rating - b.rating);
  puzzles.forEach((p, i) => (p.id = `lib-${chId}-${String(i + 1).padStart(2, '0')}`));
  out.chapters.push({ id: chId, title: ch.title, subtitle: ch.subtitle, ...(ch.exam ? { exam: true } : {}), puzzles });
});
const dest = path.resolve(REPO, process.env.LIBRARY_OUT || sel.out);
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${dest}: ${out.chapters.map((c) => c.puzzles.length).join(' + ')} puzzles`);
