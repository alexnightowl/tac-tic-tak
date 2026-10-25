import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import puzzles from '../fixtures/puzzles.json';
import { assertSafeTestTargets } from '../test-env';

export type FixturePuzzle = (typeof puzzles)[number];
export const FIXTURE_PUZZLES: FixturePuzzle[] = puzzles;

/** Fixture puzzle by id (throws on a typo so tests fail loudly). */
export function fixturePuzzle(id: string): FixturePuzzle {
  const p = FIXTURE_PUZZLES.find((x) => x.id === id);
  if (!p) throw new Error(`fixture puzzle ${id} not found`);
  return p;
}

/**
 * Empties every application table (keeps `_prisma_migrations`) and the
 * test Redis index, then re-inserts the puzzle fixture. Called before
 * each test file so files never see each other's rows.
 */
export async function resetDatabase(prisma: PrismaClient, redis?: Redis) {
  assertSafeTestTargets(process.env.DATABASE_URL, process.env.REDIS_URL);
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length > 0) {
    const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  if (redis) await redis.flushdb(); // only the test index (guarded above)
  await seedPuzzles(prisma);
}

/** Inserts the committed real-puzzle fixture (30 Lichess rows + their themes). */
export async function seedPuzzles(prisma: PrismaClient) {
  const slugs = [...new Set(FIXTURE_PUZZLES.flatMap((p) => p.themes))].sort();
  await prisma.theme.createMany({ data: slugs.map((slug) => ({ slug })), skipDuplicates: true });
  const themes = await prisma.theme.findMany();
  const themeId = new Map(themes.map((t) => [t.slug, t.id]));
  await prisma.puzzle.createMany({
    data: FIXTURE_PUZZLES.map(({ themes: _t, ...p }) => p),
    skipDuplicates: true,
  });
  await prisma.puzzleTheme.createMany({
    data: FIXTURE_PUZZLES.flatMap((p) => p.themes.map((slug) => ({ puzzleId: p.id, themeId: themeId.get(slug)! }))),
    skipDuplicates: true,
  });
}
