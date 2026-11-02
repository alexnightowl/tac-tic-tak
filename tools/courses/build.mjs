#!/usr/bin/env node
// Selects the course puzzles from the local Postgres (Lichess puzzle table)
// and writes apps/backend/src/library/courses/<course>.json.
//
//   node tools/courses/build.mjs [course…]
//
// Every run selects all four courses in a fixed order (so a puzzle is never
// reused across them and a re-run gives the same files) and writes the ones
// named (all by default). Read-only queries; deterministic, no randomness.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHAPTER_SIZE, COURSES, ENDGAME_PHASE, EXAM_SIZE, FLOORS, PASS_MARK, SOFT, STRUCTURAL,
} from './defs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../..');
const OUT = path.join(REPO, 'apps/backend/src/library/courses');
const CONTAINER = process.env.COURSES_PG_CONTAINER || 'taktic_postgres';

const wanted = process.argv.slice(2);
for (const w of wanted) if (!COURSES.some((c) => c.id === w)) throw new Error(`unknown course ${w}`);

// ------------------------------------------------------------------ query
const loosest = FLOORS[FLOORS.length - 1];
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function psql(sql) {
  const out = execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F "\t" -v ON_ERROR_STOP=1'],
    { input: sql, maxBuffer: 1 << 30, encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean).map((l) => l.split('\t'));
}

/** Every candidate for a chapter at the loosest floor; stricter floors filter in JS. */
function candidates(slugs, [lo, hi], endgame) {
  const sql = `
    select p.id, p.fen, p.moves, p.rating, p."ratingDeviation", p.popularity, p."nbPlays", coalesce(p."gameUrl", ''),
      (select string_agg(t2.slug, ',' order by t2.slug) from "PuzzleTheme" pt2 join "Theme" t2 on t2.id = pt2."themeId" where pt2."puzzleId" = p.id)
    from "Puzzle" p
    where p.rating between ${lo} and ${hi}
      and p.popularity >= ${loosest.popularity} and p."nbPlays" >= ${loosest.nbPlays} and p."ratingDeviation" <= ${loosest.ratingDeviation}
      and p.id not like 'lib-%'
      and exists (select 1 from "PuzzleTheme" pt join "Theme" t on t.id = pt."themeId" where pt."puzzleId" = p.id and t.slug in (${slugs.map(lit).join(',')}))
      ${endgame ? `and exists (select 1 from "PuzzleTheme" pt join "Theme" t on t.id = pt."themeId" where pt."puzzleId" = p.id and t.slug = 'endgame')` : ''}
    order by p.id;`;
  return psql(sql).map(([id, fen, moves, rating, rd, pop, plays, gameUrl, themes]) => ({
    id, fen, moves, rating: +rating, ratingDeviation: +rd, popularity: +pop, nbPlays: +plays, gameUrl,
    themes: themes ? themes.split(',') : [],
    // Solver = the side NOT to move in the fen (the first move is the opponent's setup).
    side: fen.split(' ')[1] === 'w' ? 'b' : 'w',
    game: (gameUrl || id).split('#')[0],
  }));
}

// -------------------------------------------------------------- selection
const usedIds = new Set();
const usedGames = new Set();

function weight(p, ch, endgame) {
  const select = ch.select ?? [ch.theme];
  let w = 0;
  for (const t of p.themes) {
    if (STRUCTURAL.has(t) || select.includes(t) || (ch.free ?? []).includes(t)) continue;
    if (endgame && ENDGAME_PHASE.has(t)) continue;
    if ((ch.prefer ?? []).includes(t)) w -= 1;
    else w += SOFT.has(t) ? 0.5 : 1;
  }
  return w;
}

const floorOk = (p, f) => p.popularity >= f.popularity && p.nbPlays >= f.nbPlays && p.ratingDeviation <= f.ratingDeviation;

/**
 * Picks `n` puzzles spread over [lo, hi]: targets evenly spaced from lo+5% to
 * hi−5%; for each, the cleanest unused candidate within ±W (then ±2W) of it,
 * keeping the solver colours balanced, nearest first, then popularity, plays, id.
 * Returns null when a target finds nobody (the caller relaxes the floor).
 */
function pick(pool, n, [lo, hi], ch, endgame, sides, force = false) {
  const a = lo + 0.05 * (hi - lo);
  const b = hi - 0.05 * (hi - lo);
  const targets = n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const W = Math.max(25, n > 1 ? (b - a) / (n - 1) / 2 : (b - a) / 2);
  const picked = [];
  const ids = new Set();
  const games = new Set();
  const variety = new Map();
  const select = ch.select ?? [ch.theme];
  const patternOf = (p) => select.find((s) => p.themes.includes(s));
  for (const t of targets) {
    const free = pool.filter((p) => !ids.has(p.id) && !games.has(p.game) && p.rating >= lo && p.rating <= hi);
    let win = free.filter((p) => Math.abs(p.rating - t) <= W);
    if (!win.length) win = free.filter((p) => Math.abs(p.rating - t) <= 2 * W);
    if (!win.length && force) win = free;
    if (!win.length) return null;
    const diff = sides.w - sides.b;
    const key = (p) => [
      ch.variety ? variety.get(patternOf(p)) ?? 0 : 0,
      p.w,
      Math.abs(diff + (p.side === 'w' ? 1 : -1)) > 1 ? 1 : 0,
      Math.floor(Math.abs(p.rating - t) / (W / 2)),
      -p.popularity,
      -p.nbPlays,
    ];
    const cmp = (x, y) => {
      const kx = key(x), ky = key(y);
      for (let i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return kx[i] - ky[i];
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
    };
    const best = win.reduce((m, p) => (cmp(p, m) < 0 ? p : m));
    picked.push(best);
    ids.add(best.id);
    games.add(best.game);
    sides[best.side]++;
    if (ch.variety) variety.set(patternOf(best), (variety.get(patternOf(best)) ?? 0) + 1);
  }
  return picked;
}

/** Tries each floor in turn; returns { picks, level, forced }. */
function pickWithFloors(all, n, band, ch, endgame, sides) {
  for (let level = 0; level < FLOORS.length; level++) {
    const pool = all.filter((p) => floorOk(p, FLOORS[level]) && !usedIds.has(p.id) && !usedGames.has(p.game));
    const trial = { ...sides };
    const picks = pick(pool, n, band, ch, endgame, trial);
    if (picks) {
      Object.assign(sides, trial);
      return { picks, level, forced: false };
    }
  }
  const pool = all.filter((p) => floorOk(p, loosest) && !usedIds.has(p.id) && !usedGames.has(p.game));
  const picks = pick(pool, n, band, ch, endgame, sides, true);
  if (!picks || picks.length < n) throw new Error(`${ch.id}: not enough candidates even at the loosest floor`);
  return { picks, level: FLOORS.length - 1, forced: true };
}

/**
 * Lichess has almost no well-measured puzzles at the very bottom of some
 * bands (nothing under ~500, trapped piece and remove-the-defender start
 * near 800). Rather than relaxing the floor for puzzles that do not exist,
 * the targets span only the part of the band where the strict floor has
 * supply: from the 10th-lowest to the 10th-highest strict candidate.
 */
function effectiveBand(all, [lo, hi]) {
  const r = all.filter((p) => floorOk(p, FLOORS[0])).map((p) => p.rating).sort((x, y) => x - y);
  if (r.length < 20) return [lo, hi];
  return [Math.max(lo, r[9]), Math.min(hi, r[r.length - 10])];
}

function claim(picks) {
  for (const p of picks) {
    usedIds.add(p.id);
    usedGames.add(p.game);
  }
}

function output(p, theme) {
  const mateTag = p.themes.find((t) => /^mateIn\d$/.test(t));
  const goal = mateTag ? 'mate' : p.themes.includes('equality') ? 'equal' : 'win';
  const mateIn = mateTag ? p.moves.split(' ').length / 2 : null;
  const o = {
    id: p.id, fen: p.fen, moves: p.moves, rating: p.rating, ratingDeviation: p.ratingDeviation,
    popularity: p.popularity, nbPlays: p.nbPlays, themes: p.themes, gameUrl: p.gameUrl || null, goal, mateIn,
  };
  if (theme) o.theme = theme;
  return o;
}

const byRating = (x, y) => x.rating - y.rating || (x.id < y.id ? -1 : 1);

// ------------------------------------------------------------------- run
const report = [];
const pools = new Map();
const results = new Map();

for (const course of COURSES) {
  const endgame = !!course.endgame;
  const chapters = [];
  for (const ch of course.chapters) {
    const t0 = Date.now();
    const all = candidates(ch.select ?? [ch.theme], ch.band, endgame);
    for (const p of all) p.w = weight(p, ch, endgame);
    pools.set(ch.id, all);
    const sides = { w: 0, b: 0 };
    const band = effectiveBand(all, ch.band);
    const { picks, level, forced } = pickWithFloors(all, CHAPTER_SIZE, band, ch, endgame, sides);
    claim(picks);
    picks.sort(byRating);
    chapters.push({ ch, picks });
    report.push({
      course: course.id, chapter: ch.id, n: picks.length, min: picks[0].rating, max: picks.at(-1).rating,
      band: band.join('–'), sides: `${sides.w}w/${sides.b}b`, clean: picks.filter((p) => p.w <= 0).length, pool: all.length,
      relax: level === 0 && !forced ? '' : `floor ${level}${forced ? ' + widened window' : ''}`,
      ms: Date.now() - t0,
    });
    process.stderr.write(`${ch.id}: ${all.length} candidates, ${Date.now() - t0} ms\n`);
  }
  results.set(course.id, { course, chapters });
}

// Exams after every chapter of every course, so chapters get first pick.
for (const course of COURSES) {
  const endgame = !!course.endgame;
  const res = results.get(course.id);
  const n = course.chapters.length;
  const base = Math.floor(EXAM_SIZE / n);
  const extra = EXAM_SIZE - base * n;
  const sides = { w: 0, b: 0 };
  const exam = [];
  const levels = [];
  const bands = [];
  course.chapters.forEach((ch, i) => {
    const k = base + (i < extra ? 1 : 0);
    const [lo, hi] = ch.band;
    const band = [Math.round(lo + 0.4 * (hi - lo)), hi];
    bands.push(band.join('–'));
    const { picks, level, forced } = pickWithFloors(pools.get(ch.id), k, band, ch, endgame, sides);
    claim(picks);
    if (level || forced) levels.push(`${ch.theme}: floor ${level}${forced ? ' + widened' : ''}`);
    for (const p of picks) exam.push({ p, theme: ch.theme });
  });
  exam.sort((x, y) => byRating(x.p, y.p));
  res.exam = exam;
  report.push({
    course: course.id, chapter: `${course.id}-exam`, band: [...new Set(bands)].join(','), n: exam.length, min: exam[0].p.rating, max: exam.at(-1).p.rating,
    sides: `${sides.w}w/${sides.b}b`, clean: exam.filter((e) => e.p.w <= 0).length, pool: '',
    relax: levels.join('; '),
  });
}

// ----------------------------------------------------------------- write
fs.mkdirSync(OUT, { recursive: true });
for (const course of COURSES) {
  if (wanted.length && !wanted.includes(course.id)) continue;
  const { chapters, exam } = results.get(course.id);
  const doc = {
    id: course.id,
    version: 1,
    chapters: chapters.map(({ ch, picks }) => ({
      id: ch.id,
      theme: ch.theme,
      title: ch.title,
      tip: ch.tip,
      intro: ch.intro,
      puzzles: picks.map((p) => output(p)),
    })),
    exam: { id: `${course.id}-exam`, passMark: PASS_MARK, puzzles: exam.map(({ p, theme }) => output(p, theme)) },
  };
  const file = path.join(OUT, `${course.id}.json`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  process.stderr.write(`wrote ${path.relative(REPO, file)}\n`);
}

// ---------------------------------------------------------------- report
const cols = ['course', 'chapter', 'band', 'n', 'min', 'max', 'sides', 'clean', 'pool', 'relax'];
const rows = report.map((r) => cols.map((c) => String(r[c] ?? '')));
const width = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i].length)));
const line = (r) => r.map((v, i) => v.padEnd(width[i])).join('  ').trimEnd();
console.log(line(cols));
for (const r of rows) console.log(line(r));
