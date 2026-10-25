/**
 * Legacy (web) contract smoke.
 *
 * Replays the web scenario (apps/backend/test/contract/web-scenario.ts:
 * every request shape apps/frontend sends) against one or two RUNNING
 * local backends over plain HTTP and diffs status codes, response shapes
 * and error messages step by step. Typical use on a backend PR: run
 * `main` and the branch side by side (different PORTs, same local DB),
 * then
 *
 *   pnpm --filter backend contract:smoke -- \
 *     --base http://localhost:4100/api --compare http://localhost:4101/api \
 *     --db postgresql://taktic:taktic@localhost:5433/taktic_test --redis redis://localhost:6380/1
 *
 * Options
 *   --base <url>       API root of the reference server (required)
 *   --compare <url>    API root of the candidate server; omit to just record
 *   --db <url>         Postgres the servers use; enables the DB-assisted steps
 *                      (full-duration finish, admin) and deletes the throwaway
 *                      users afterwards. Without it those steps are `skipped`.
 *   --redis <url>      Redis the servers use (with --db): primes each session's
 *                      puzzle queue with the same ~1200-rated puzzles (picked
 *                      by id, not at random) so both runs see identical data.
 *                      Without it, analytics/review shapes can differ run to
 *                      run (e.g. [] vs [row]) because the buffer picks randomly.
 *   --save <file>      write the base run's steps as JSON
 *   --against <file>   diff the base run against a saved JSON instead of --compare
 *
 * Safety: refuses any non-local host. It registers throwaway users
 * (`webA<rand>`, `webB<rand>`) and mutates data, so never point it at prod
 * and prefer the disposable taktic_test DB over the dev DB.
 *
 * The in-process golden test (test/e2e/web-contract.e2e-spec.ts) is the
 * snapshot of record; this smoke proves two live builds agree.
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  runWebScenario,
  ContractTransport,
  ScenarioHooks,
  StepRecord,
} from '../../apps/backend/test/contract/web-scenario';

const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const a = argv[i];
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1];
}

function assertLocal(url: string, what: string) {
  const host = new URL(url).hostname;
  if (!LOCAL.has(host)) {
    console.error(`legacy-smoke: refusing non-local ${what} host "${host}"`);
    process.exit(2);
  }
}

function fetchTransport(base: string): ContractTransport {
  const root = base.replace(/\/$/, '');
  return async ({ method, path, token, body }) => {
    // Same headers/body encoding as apps/frontend/src/lib/api.ts.
    const res = await fetch(`${root}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }
    return { status: res.status, body: parsed };
  };
}

type Prisma = {
  $queryRawUnsafe: <T>(sql: string, ...args: unknown[]) => Promise<T>;
  trainingSession: { update: (a: unknown) => Promise<unknown> };
  user: { update: (a: unknown) => Promise<unknown>; deleteMany: (a: unknown) => Promise<unknown> };
  $disconnect: () => Promise<void>;
};

type RedisLike = {
  del: (k: string) => Promise<unknown>;
  lpush: (k: string, ...v: string[]) => Promise<unknown>;
  quit: () => Promise<unknown>;
};

// @prisma/client and ioredis live in apps/backend's node_modules (pnpm does not hoist them).
const backendRequire = createRequire(join(__dirname, '../../apps/backend/package.json'));

function prismaFor(dbUrl: string): Prisma {
  const { PrismaClient } = backendRequire('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: dbUrl } } }) as Prisma;
}

function redisFor(url: string): RedisLike {
  const Redis = backendRequire('ioredis');
  return new Redis(url) as RedisLike;
}

/** Same filters as the buffer's pickIds, ordered by id instead of random(). */
async function loadQueues(prisma: Prisma) {
  const sql = (fork: boolean) => `
    SELECT p."id", p."fen", p."moves", p."rating", p."gameUrl",
      ARRAY(SELECT t2."slug" FROM "PuzzleTheme" pt2 JOIN "Theme" t2 ON t2."id" = pt2."themeId"
            WHERE pt2."puzzleId" = p."id" ORDER BY t2."slug") AS themes
    FROM "Puzzle" p
    WHERE p."rating" BETWEEN 1160 AND 1260 AND p."popularity" >= 95 AND p."nbPlays" >= 1000
      ${fork ? `AND EXISTS (SELECT 1 FROM "PuzzleTheme" pt JOIN "Theme" t ON t."id" = pt."themeId"
                            WHERE pt."puzzleId" = p."id" AND t."slug" = 'fork')` : ''}
    ORDER BY p."id" LIMIT 12`;
  type Row = { id: string; fen: string; moves: string; rating: number; gameUrl: string | null; themes: string[] };
  const toPayload = (r: Row) =>
    JSON.stringify({ id: r.id, fen: r.fen, moves: r.moves.split(' '), rating: r.rating, gameUrl: r.gameUrl, themes: r.themes });
  const mixed = (await prisma.$queryRawUnsafe<Row[]>(sql(false))).map(toPayload);
  const fork = (await prisma.$queryRawUnsafe<Row[]>(sql(true))).map(toPayload);
  if (mixed.length < 4 || fork.length < 2) throw new Error('legacy-smoke: not enough ~1200 puzzles in the DB to prime queues');
  return { mixed, fork };
}

async function runOnce(base: string, prisma: Prisma | null, redis: RedisLike | null) {
  const suffix = Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 4);
  const queues = prisma && redis ? await loadQueues(prisma) : null;
  const hooks: ScenarioHooks = prisma
    ? {
        ...(queues && redis
          ? {
              primeQueue: async (sid: string, kind: 'mixed' | 'fork') => {
                const key = `session:${sid}:queue`;
                await redis.del(key);
                // LPUSH a,b,c then RPOP serves a first (buffer semantics).
                await redis.lpush(key, ...(kind === 'fork' ? queues.fork : queues.mixed));
              },
            }
          : {}),
        backdateSession: async (id, s) => {
          await prisma.trainingSession.update({ where: { id }, data: { startedAt: new Date(Date.now() - s * 1000) } });
        },
        makeAdmin: async (id) => {
          await prisma.user.update({ where: { id }, data: { isAdmin: true } });
        },
      }
    : {};
  const { steps, ctx } = await runWebScenario(fetchTransport(base), hooks, { suffix });
  if (prisma) {
    const ids = [ctx.userA?.id, ctx.userB?.id].filter(Boolean);
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  return steps;
}

function diff(a: StepRecord[], b: StepRecord[]) {
  const out: string[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) { out.push(`#${i} ${x?.step ?? y?.step}: missing on ${x ? 'compare' : 'base'}`); continue; }
    if (x.step !== y.step) { out.push(`#${i} step order differs: "${x.step}" vs "${y.step}"`); continue; }
    if (x.status !== y.status) out.push(`#${i} ${x.step} [${x.method} ${x.route}]: status ${x.status} -> ${y.status}`);
    if (JSON.stringify(x.shape) !== JSON.stringify(y.shape)) {
      out.push(`#${i} ${x.step} [${x.method} ${x.route}]: shape\n    base:    ${JSON.stringify(x.shape)}\n    compare: ${JSON.stringify(y.shape)}`);
    }
    if (JSON.stringify(x.message) !== JSON.stringify(y.message)) {
      out.push(`#${i} ${x.step}: message ${JSON.stringify(x.message)} -> ${JSON.stringify(y.message)}`);
    }
  }
  return out;
}

async function main() {
  const base = arg('base');
  const compare = arg('compare');
  const db = arg('db');
  const redisUrl = arg('redis');
  const save = arg('save');
  const against = arg('against');
  if (!base) {
    console.error('usage: legacy-smoke --base <apiUrl> [--compare <apiUrl>] [--db <postgresUrl> [--redis <redisUrl>]] [--save f.json] [--against f.json]');
    process.exit(2);
  }
  assertLocal(base, 'base');
  if (compare) assertLocal(compare, 'compare');
  if (db) assertLocal(db, 'database');
  if (redisUrl) assertLocal(redisUrl, 'redis');
  if (redisUrl && !db) {
    console.error('legacy-smoke: --redis needs --db (the queue is primed from DB puzzles)');
    process.exit(2);
  }

  const prisma = db ? prismaFor(db) : null;
  const redis = redisUrl ? redisFor(redisUrl) : null;
  try {
    const a = await runOnce(base, prisma, redis);
    const skipped = a.filter((s) => s.status === 'skipped').length;
    console.log(`base ${base}: ${a.length} steps (${skipped} skipped)`);
    if (save) writeFileSync(save, JSON.stringify(a, null, 2) + '\n');

    let b: StepRecord[] | null = null;
    let label = '';
    if (compare) { b = await runOnce(compare, prisma, redis); label = compare; }
    else if (against) { b = JSON.parse(readFileSync(against, 'utf8')); label = against; }
    if (!b) return;

    const d = diff(a, b);
    if (d.length === 0) {
      console.log(`compare ${label}: identical status codes, shapes and messages (${b.length} steps)`);
    } else {
      console.error(`compare ${label}: ${d.length} difference(s)\n  ${d.join('\n  ')}`);
      process.exitCode = 1;
    }
  } finally {
    await prisma?.$disconnect();
    await redis?.quit();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
