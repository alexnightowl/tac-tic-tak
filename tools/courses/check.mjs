#!/usr/bin/env node
// The gate for the course files. Re-checks everything from the JSON alone:
//
//   node tools/courses/check.mjs [file.json …]   (default: every course in defs.mjs)
//
// Counts, ids unique across all files, every line legal with chess.js and
// ending on a solver move, mates really mate, chapter themes present, ratings
// non-decreasing, intro diagrams legal with the caption SAN matching the
// arrowed move, all en/uk strings present. Exits 1 on any failure.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTER_SIZE, COURSES, EXAM_SIZE, PASS_MARK } from './defs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../..');
const require = createRequire(path.join(REPO, 'packages/core/package.json'));
const { Chess, validateFen } = require('chess.js');

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : COURSES.map((c) => path.join(REPO, 'apps/backend/src/library/courses', `${c.id}.json`));

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const seen = new Map(); // puzzle id -> where

const SQUARE = /^[a-h][1-8]$/;
// A SAN token in prose: a piece move, a capture, a check/mate, a promotion or castling.
const SAN_TOKEN = /(?<![\w])(O-O(?:-O)?[+#]?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8][+#]?|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8]=[QRBN][+#]?|[a-h][1-8][+#])(?![\w])/g;

function loc(o, where) {
  if (!o || typeof o !== 'object') return fail(where, 'missing');
  for (const l of ['en', 'uk']) if (typeof o[l] !== 'string' || !o[l].trim()) fail(where, `empty ${l}`);
  for (const k of Object.keys(o)) if (k !== 'en' && k !== 'uk') fail(where, `unexpected key ${k}`);
}

function kingsOk(game, where) {
  const board = game.board().flat().filter(Boolean);
  for (const color of ['w', 'b']) {
    const kings = board.filter((p) => p.type === 'k' && p.color === color);
    if (kings.length !== 1) fail(where, `${color} has ${kings.length} kings`);
  }
  // The side not to move must not be in check.
  const other = game.turn() === 'w' ? 'b' : 'w';
  const k = board.find((p) => p.type === 'k' && p.color === other);
  if (k && game.isAttacked(k.square, game.turn())) fail(where, 'side not to move is in check');
}

function checkIntro(intro, where) {
  if (!intro) return fail(where, 'no intro');
  loc(intro.text, `${where}.text`);
  loc(intro.caption, `${where}.caption`);
  const v = validateFen(intro.fen ?? '');
  if (!v.ok) return fail(where, `bad fen: ${v.error}`);
  const game = new Chess(intro.fen);
  kingsOk(game, `${where}.fen`);
  const mover = game.turn();
  const arrows = intro.arrows ?? [];
  if (!arrows.length) fail(where, 'no arrows');
  for (const a of arrows) {
    if (!SQUARE.test(a.from) || !SQUARE.test(a.to) || a.from === a.to) fail(where, `bad arrow ${JSON.stringify(a)}`);
    if (a.kind !== 'move' && a.kind !== 'threat') fail(where, `bad arrow kind ${a.kind}`);
  }
  const moves = arrows.filter((a) => a.kind === 'move');
  if (moves.length !== 1) return fail(where, `expected one move arrow, got ${moves.length}`);
  const m = moves[0];
  let san;
  try {
    const piece = game.get(m.from);
    const promo = piece?.type === 'p' && (m.to[1] === '8' || m.to[1] === '1') ? 'q' : undefined;
    san = game.move({ from: m.from, to: m.to, promotion: promo }).san;
  } catch {
    return fail(where, `move arrow ${m.from}-${m.to} is illegal`);
  }
  for (const l of ['en', 'uk']) {
    const text = intro.caption?.[l] ?? '';
    const tokens = [...text.matchAll(SAN_TOKEN)].map((x) => x[1]);
    const bare = new RegExp(`(?<![\\w])${san.replace(/[+#=]/g, (c) => `\\${c}`)}(?![\\w])`);
    if (!bare.test(text)) fail(`${where}.caption.${l}`, `does not name the move ${san}`);
    for (const t of tokens) if (t !== san) fail(`${where}.caption.${l}`, `SAN ${t} does not match the arrowed move ${san}`);
  }
  // Threats start at the moved piece's square or at another piece of the mover.
  for (const a of arrows.filter((x) => x.kind === 'threat')) {
    const p = game.get(a.from);
    if (a.from !== m.to && !(p && p.color === mover)) fail(where, `threat ${a.from}-${a.to} does not start at a piece of the mover`);
  }
}

function checkPuzzle(p, where, wantThemes, endgame) {
  const keys = ['id', 'fen', 'moves', 'rating', 'ratingDeviation', 'popularity', 'nbPlays', 'themes', 'gameUrl', 'goal', 'mateIn'];
  for (const k of keys) if (!(k in p)) fail(where, `missing ${k}`);
  if (typeof p.id !== 'string' || !p.id || p.id.startsWith('lib-')) fail(where, `bad id ${p.id}`);
  if (seen.has(p.id)) fail(where, `puzzle ${p.id} already used in ${seen.get(p.id)}`);
  seen.set(p.id, where);
  if (!Array.isArray(p.themes)) return fail(where, 'themes not an array');
  if (!wantThemes.some((t) => p.themes.includes(t))) fail(where, `${p.id} lacks theme ${wantThemes.join('|')}`);
  if (endgame && !p.themes.includes('endgame')) fail(where, `${p.id} not tagged endgame`);
  const v = validateFen(p.fen ?? '');
  if (!v.ok) return fail(where, `${p.id} bad fen: ${v.error}`);
  const moves = String(p.moves).split(' ');
  if (moves.length < 2 || moves.length % 2) fail(where, `${p.id} line does not end on a solver move (${moves.length} plies)`);
  const game = new Chess(p.fen);
  for (const [i, u] of moves.entries()) {
    try {
      game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    } catch {
      return fail(where, `${p.id} illegal move ${i}: ${u}`);
    }
  }
  const mateTag = p.themes.find((t) => /^mateIn\d$/.test(t));
  const goal = mateTag ? 'mate' : p.themes.includes('equality') ? 'equal' : 'win';
  if (p.goal !== goal) fail(where, `${p.id} goal ${p.goal}, expected ${goal}`);
  if (goal === 'mate') {
    if (!game.isCheckmate()) fail(where, `${p.id} is a mate puzzle but the line does not end in mate`);
    const n = moves.length / 2;
    if (p.mateIn !== n) fail(where, `${p.id} mateIn ${p.mateIn}, line has ${n} solver moves`);
    const tagN = Number(mateTag.slice(6));
    if (tagN < 5 ? tagN !== n : n < 5) fail(where, `${p.id} tagged ${mateTag} but mates in ${n}`);
  } else if (p.mateIn !== null) fail(where, `${p.id} mateIn should be null`);
  for (const k of ['rating', 'ratingDeviation', 'popularity', 'nbPlays']) if (!Number.isInteger(p[k])) fail(where, `${p.id} ${k} not an integer`);
}

for (const file of files) {
  const course = JSON.parse(fs.readFileSync(file, 'utf8'));
  const def = COURSES.find((c) => c.id === course.id);
  const where = path.basename(file);
  if (!def) {
    fail(where, `unknown course ${course.id}`);
    continue;
  }
  if (!Number.isInteger(course.version) || course.version < 1) fail(where, 'bad version');
  if ((course.chapters ?? []).length !== def.chapters.length) fail(where, `expected ${def.chapters.length} chapters`);
  for (const [i, ch] of (course.chapters ?? []).entries()) {
    const cd = def.chapters[i];
    const w = `${where} ${ch.id}`;
    if (!cd || ch.id !== cd.id || ch.theme !== cd.theme) fail(w, 'id/theme do not match defs.mjs');
    loc(ch.title, `${w}.title`);
    loc(ch.tip, `${w}.tip`);
    checkIntro(ch.intro, `${w}.intro`);
    const puzzles = ch.puzzles ?? [];
    if (puzzles.length !== CHAPTER_SIZE) fail(w, `${puzzles.length} puzzles, expected ${CHAPTER_SIZE}`);
    const games = new Set();
    puzzles.forEach((p, j) => {
      checkPuzzle(p, w, cd?.select ?? [ch.theme], !!def.endgame);
      if (j && p.rating < puzzles[j - 1].rating) fail(w, `ratings decrease at ${p.id}`);
      if ('theme' in p) fail(w, `${p.id} chapter puzzle carries a theme`);
      const g = (p.gameUrl || p.id).split('#')[0];
      if (games.has(g)) fail(w, `${p.id} repeats a game`);
      games.add(g);
    });
  }
  const exam = course.exam ?? {};
  const w = `${where} exam`;
  if (exam.id !== `${course.id}-exam`) fail(w, `id ${exam.id}`);
  if (exam.passMark !== PASS_MARK) fail(w, `passMark ${exam.passMark}`);
  const ep = exam.puzzles ?? [];
  if (ep.length !== EXAM_SIZE) fail(w, `${ep.length} puzzles, expected ${EXAM_SIZE}`);
  const themes = new Map(def.chapters.map((c) => [c.theme, c.select ?? [c.theme]]));
  ep.forEach((p, j) => {
    if (!themes.has(p.theme)) return fail(w, `${p.id} theme ${p.theme} is not a chapter theme`);
    checkPuzzle(p, w, themes.get(p.theme), !!def.endgame);
    if (j && p.rating < ep[j - 1].rating) fail(w, `ratings decrease at ${p.id}`);
  });
  const per = {};
  for (const p of ep) per[p.theme] = (per[p.theme] ?? 0) + 1;
  const counts = Object.values(per);
  if (Object.keys(per).length !== def.chapters.length || Math.max(...counts) - Math.min(...counts) > 1)
    fail(w, `uneven theme spread ${JSON.stringify(per)}`);
}

if (errors.length) {
  for (const e of errors) console.error('FAIL', e);
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log(`ok: ${files.length} file(s), ${seen.size} puzzles, all checks passed`);
