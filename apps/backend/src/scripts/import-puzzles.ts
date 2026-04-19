/**
 * Stream-import the Lichess puzzle dataset into Postgres.
 *
 * Pipeline: download (if missing) -> `zstd -dc` child process -> csv-parse ->
 * filter (ratingDeviation<=90, nbPlays>=50) -> batch upsert via raw SQL.
 *
 * Requires the `zstd` CLI available on PATH. On macOS: `brew install zstd`.
 */
import 'dotenv/config';
import { createWriteStream, existsSync, mkdirSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse';
import { PrismaClient, Prisma } from '@prisma/client';

const PUZZLE_URL = process.env.LICHESS_PUZZLE_URL ?? 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const DATA_DIR = process.env.DATA_DIR ?? './data';
const BATCH_SIZE = 2000;
const MIN_NB_PLAYS = 50;
const MAX_RATING_DEVIATION = 90;

type Row = {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  gameUrl: string | null;
  themes: string[];
};

async function ensureFile(url: string, dest: string) {
  if (existsSync(dest)) {
    const s = await stat(dest);
    if (s.size > 0) {
      console.log(`[puzzles] using cached file ${dest} (${(s.size / 1e6).toFixed(1)} MB)`);
      return;
    }
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  console.log(`[puzzles] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
  await pipeline(res.body as any, createWriteStream(dest));
  console.log(`[puzzles] downloaded to ${dest}`);
}

function parseRow(cols: string[]): Row | null {
  const [id, fen, moves, ratingStr, rdStr, popStr, nbStr, themesStr, gameUrl] = cols;
  if (!id || id === 'PuzzleId') return null;
  const rating = Number(ratingStr);
  const ratingDeviation = Number(rdStr);
  const popularity = Number(popStr);
  const nbPlays = Number(nbStr);
  if (!Number.isFinite(rating) || !Number.isFinite(nbPlays)) return null;
  if (ratingDeviation > MAX_RATING_DEVIATION) return null;
  if (nbPlays < MIN_NB_PLAYS) return null;
  return {
    id,
    fen,
    moves,
    rating,
    ratingDeviation,
    popularity,
    nbPlays,
    gameUrl: gameUrl || null,
    themes: (themesStr ?? '').split(' ').map((t) => t.trim()).filter(Boolean),
  };
}

async function upsertThemes(prisma: PrismaClient, slugs: Set<string>, cache: Map<string, number>) {
  const missing = [...slugs].filter((s) => !cache.has(s));
  if (missing.length === 0) return;
  await prisma.$transaction(
    missing.map((slug) =>
      prisma.theme.upsert({
        where: { slug },
        create: { slug },
        update: {},
      }),
    ),
  );
  const rows = await prisma.theme.findMany({ where: { slug: { in: missing } } });
  for (const t of rows) cache.set(t.slug, t.id);
}

async function flushBatch(prisma: PrismaClient, batch: Row[], themeCache: Map<string, number>) {
  if (batch.length === 0) return;

  // Gather unknown themes and upsert them first.
  const unknown = new Set<string>();
  for (const r of batch) for (const t of r.themes) if (!themeCache.has(t)) unknown.add(t);
  if (unknown.size > 0) await upsertThemes(prisma, unknown, themeCache);

  // Bulk-upsert puzzles via COPY-like INSERT ... ON CONFLICT DO UPDATE.
  const values: Prisma.Sql[] = batch.map(
    (r) => Prisma.sql`(${r.id}, ${r.fen}, ${r.moves}, ${r.rating}, ${r.ratingDeviation}, ${r.popularity}, ${r.nbPlays}, ${r.gameUrl})`,
  );
  await prisma.$executeRaw`
    INSERT INTO "Puzzle" ("id","fen","moves","rating","ratingDeviation","popularity","nbPlays","gameUrl")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("id") DO UPDATE SET
      "rating" = EXCLUDED."rating",
      "ratingDeviation" = EXCLUDED."ratingDeviation",
      "popularity" = EXCLUDED."popularity",
      "nbPlays" = EXCLUDED."nbPlays",
      "gameUrl" = EXCLUDED."gameUrl"
  `;

  // Bulk-insert puzzle_themes.
  const ptValues: Prisma.Sql[] = [];
  for (const r of batch) {
    for (const t of r.themes) {
      const themeId = themeCache.get(t);
      if (themeId != null) ptValues.push(Prisma.sql`(${r.id}, ${themeId})`);
    }
  }
  if (ptValues.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO "PuzzleTheme" ("puzzleId","themeId")
      VALUES ${Prisma.join(ptValues)}
      ON CONFLICT DO NOTHING
    `;
  }
}

async function run() {
  const zstPath = path.resolve(DATA_DIR, 'lichess_db_puzzle.csv.zst');
  await ensureFile(PUZZLE_URL, zstPath);

  const prisma = new PrismaClient();
  await prisma.$connect();

  // `zstd -dc` streams decompressed bytes to stdout.
  const zstd = spawn('zstd', ['-dcq', zstPath], { stdio: ['ignore', 'pipe', 'inherit'] });

  const parser = parse({
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  zstd.stdout.pipe(parser);

  const themeCache = new Map<string, number>();
  // Pre-warm cache from existing themes.
  for (const t of await prisma.theme.findMany()) themeCache.set(t.slug, t.id);

  let batch: Row[] = [];
  let totalIn = 0;
  let totalKept = 0;
  let lastLog = Date.now();

  parser.on('data', async (cols: string[]) => {
    totalIn++;
    const row = parseRow(cols);
    if (!row) return;
    totalKept++;
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      parser.pause();
      const toFlush = batch;
      batch = [];
      try {
        await flushBatch(prisma, toFlush, themeCache);
      } catch (e) {
        console.error('[puzzles] batch failed', e);
        process.exitCode = 1;
      }
      if (Date.now() - lastLog > 2000) {
        console.log(`[puzzles] read=${totalIn} kept=${totalKept}`);
        lastLog = Date.now();
      }
      parser.resume();
    }
  });

  await new Promise<void>((resolve, reject) => {
    parser.on('end', resolve);
    parser.on('error', reject);
    zstd.on('error', reject);
    zstd.on('exit', (code) => {
      if (code !== 0 && code !== null) reject(new Error(`zstd exited ${code}`));
    });
  });

  if (batch.length > 0) await flushBatch(prisma, batch, themeCache);

  console.log(`[puzzles] done. read=${totalIn} kept=${totalKept}`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
