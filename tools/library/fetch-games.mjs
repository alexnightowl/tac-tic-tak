#!/usr/bin/env node
// Fetch game PGNs from chessgames.com for one Library book.
//
//   LIBRARY_CACHE=/path/to/cache node tools/library/fetch-games.mjs <book> [--max-pages N]
//
// Reads tools/library/sources.json[<book>]: player pids, a year range,
// `winnerOnly` (keep only games the listed player won), optional `maxMoves`
// (skip longer games) and extra gids.
// Every raw page is cached under $LIBRARY_CACHE (never in the repo), so a
// re-run makes no requests for pages it already has. Requests are spaced
// >= 1.2 s apart with a browser User-Agent. Writes
// $LIBRARY_CACHE/games-<book>.json: [{gid, source, headers, pgn}].
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, cleanPgn, sleep } from './lib.mjs';

const BASE = 'https://www.chessgames.com';
const book = process.argv[2];
const maxPagesArg = process.argv.indexOf('--max-pages');
const MAX_PAGES = maxPagesArg > 0 ? Number(process.argv[maxPagesArg + 1]) : 100;
const sources = JSON.parse(fs.readFileSync(new URL('./sources.json', import.meta.url)));
if (!sources[book]) {
  console.error(`usage: fetch-games.mjs <${Object.keys(sources).join('|')}>`);
  process.exit(2);
}
const cfg = sources[book];
fs.mkdirSync(CACHE_DIR, { recursive: true });

let last = 0;
async function get(url, file) {
  const f = path.join(CACHE_DIR, file);
  if (fs.existsSync(f) && fs.statSync(f).size > 2000) return fs.readFileSync(f, 'utf8');
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = 1200 + attempt * 5000 - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buf = Buffer.from(await res.arrayBuffer());
    const text = buf.toString('utf8');
    // chessgames answers an "overloaded" stub (~350 bytes) when it throttles.
    if (res.ok && text.length > 2000 && !text.includes('overloaded.gif')) {
      fs.writeFileSync(f, buf);
      return text;
    }
    process.stderr.write(`  retry ${url} (${res.status}, ${text.length} bytes)\n`);
  }
  throw new Error(`failed: ${url}`);
}

// Pages are UTF-8 with HTML entities.
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[lr]squo;/g, "'")
    .replace(/&[lr]dquo;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&');
}

/** Rows of a player's game list: gid, title, result, moves, year, event. */
function parseList(html) {
  const rows = [];
  const re =
    /<a href="\/perl\/chessgame\?gid=(\d+)">([^<]*)<\/a><\/font><\/td>[\s\S]*?size=-1>([^<]*)<\/font><\/td><td align=RIGHT><font[^>]*>(\d+)<\/font><\/td><td align=RIGHT><font[^>]*>(\d{4})<\/font><\/td><td><font[^>]*><font size=-2>([\s\S]*?)<\/font>/g;
  let m;
  while ((m = re.exec(html))) {
    rows.push({
      gid: Number(m[1]),
      title: decode(m[2]),
      result: m[3].trim(),
      moves: Number(m[4]),
      year: Number(m[5]),
      event: decode(m[6].replace(/<[^>]+>/g, '')).trim(),
    });
  }
  const pages = /page \d+ of (\d+)/.exec(html);
  return { rows, pages: pages ? Number(pages[1]) : 1 };
}

function parseGame(html) {
  const m = /<div id="olga-data"[^>]*pgn='([\s\S]*?)'/.exec(html);
  if (!m) return null;
  const pgn = cleanPgn(decode(m[1]).replace(/\r/g, ''));
  const headers = {};
  for (const h of pgn.matchAll(/^\[(\w+) "(.*)"\]$/gm)) headers[h[1]] = h[2];
  return { headers, pgn };
}

const [y0, y1] = cfg.years;
const wanted = new Map(); // gid -> list row (or null for extra gids)
for (const { pid, name } of cfg.players) {
  const surname = name.split(' ').pop();
  let pages = 1;
  for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
    const html = await get(
      `${BASE}/perl/chess.pl?page=${page}&pid=${pid}`,
      `list-${pid}-p${page}.html`,
    );
    const r = parseList(html);
    pages = r.pages;
    let kept = 0;
    for (const row of r.rows) {
      if (row.year < y0 || row.year > y1) continue;
      if (!['1-0', '0-1'].includes(row.result)) continue;
      if (cfg.maxMoves && row.moves > cfg.maxMoves) continue; // optional: short games only
      if (cfg.winnerOnly) {
        const [w, b] = row.title.split(' vs ');
        const won = row.result === '1-0' ? w : b;
        if (!won || !won.includes(surname)) continue;
      }
      wanted.set(row.gid, row);
      kept++;
    }
    process.stderr.write(`${name} p${page}/${pages}: ${r.rows.length} rows, kept ${kept}\n`);
  }
}
for (const gid of cfg.gids) if (!wanted.has(gid)) wanted.set(gid, null);

const out = [];
for (const [gid] of wanted) {
  const html = await get(`${BASE}/perl/chessgame?gid=${gid}`, `game-${gid}.html`);
  const g = parseGame(html);
  if (!g) {
    process.stderr.write(`  no PGN in gid ${gid}\n`);
    continue;
  }
  out.push({ gid, source: `${BASE}/perl/chessgame?gid=${gid}`, ...g });
}
const file = path.join(CACHE_DIR, `games-${book}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`${out.length} games -> ${file}`);
