import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

/**
 * Seeds finished training sessions (with attempts) for an existing user,
 * spread over the past weeks, so history / analytics / heatmaps have data.
 * Local development only.
 *
 *   pnpm --filter backend seed:test-sessions <nickname> [count] [--style bullet|blitz|rapid|any]
 *
 *   nickname  required; the user must already exist
 *   count     number of sessions (default 20)
 *   --style   training style written on every session; `any` (default)
 *             picks one at random per session
 */

const STYLES = ['bullet', 'blitz', 'rapid'] as const;
type Style = (typeof STYLES)[number];

const THEMES = [
  'fork',
  'pin',
  'skewer',
  'mateIn1',
  'mateIn2',
  'discoveredAttack',
  'sacrifice',
  'endgame',
  'middlegame',
  'advantage',
];

// Duration presets per style (minutes), matching the play setup presets.
const DURATIONS_MIN: Record<Style, number[]> = {
  bullet: [1, 2, 3],
  blitz: [5, 10, 15],
  rapid: [10, 20, 30],
};

function usage(msg?: string): never {
  if (msg) console.error(`error: ${msg}`);
  console.error('usage: seed-test-sessions <nickname> [count] [--style bullet|blitz|rapid|any]');
  process.exit(1);
}

export function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let style: Style | 'any' = 'any';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--style' || a.startsWith('--style=')) {
      const v = a.includes('=') ? a.split('=')[1] : argv[++i];
      if (v !== 'any' && !STYLES.includes(v as Style)) usage(`invalid --style "${v}"`);
      style = v as Style | 'any';
    } else if (a === '--help' || a === '-h') {
      usage();
    } else if (a.startsWith('--')) {
      usage(`unknown flag ${a}`);
    } else {
      positional.push(a);
    }
  }
  const [nickname, countRaw] = positional;
  if (!nickname) usage('nickname is required');
  const count = countRaw === undefined ? 20 : Number(countRaw);
  if (!Number.isInteger(count) || count < 1 || count > 1000) usage(`invalid count "${countRaw}"`);
  return { nickname, count, style };
}

/** Seeding writes rows; refuse anything that is not a local database. */
function assertLocalDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) usage('DATABASE_URL is not set');
  const host = new URL(raw).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(host)) {
    console.error(`refusing to seed a non-local database (host "${host}")`);
    process.exit(1);
  }
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const { nickname, count, style: styleArg } = parseArgs(process.argv.slice(2));
  assertLocalDatabase();
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { nickname } });
    if (!user) throw new Error(`User ${nickname} not found`);

    console.log(`Seeding ${count} sessions (style: ${styleArg}) for ${nickname} (${user.id})`);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const style: Style = styleArg === 'any' ? pick(STYLES) : styleArg;
      const isTheme = Math.random() < 0.4;
      const mode = isTheme ? 'theme' : 'mixed';
      const theme = isTheme ? pick(THEMES) : null;

      const durationMin = pick(DURATIONS_MIN[style]);
      const durationSec = durationMin * 60;

      const startRating = randInt(1100, 1700);
      const solvedCount = randInt(3, 25);
      const failedCount = randInt(0, 8);
      const total = solvedCount + failedCount;
      const accuracy = total === 0 ? 0 : solvedCount / total;
      const peakRating = startRating + randInt(20, 180);
      const avgResponseMs = randInt(3500, 22000);

      const daysAgo = i * 1.3 + Math.random();
      const startedAt = new Date(now - daysAgo * dayMs - randInt(0, 12) * 3600_000);
      const endedAt = new Date(startedAt.getTime() + durationSec * 1000);

      const puzzles = await prisma.puzzle.findMany({
        where: { rating: { gte: startRating - 150, lte: startRating + 200 } },
        take: total,
        orderBy: { popularity: 'desc' },
        skip: randInt(0, 500),
      });

      if (puzzles.length < total) {
        console.warn(`session ${i}: only found ${puzzles.length}/${total} puzzles, continuing`);
      }

      const session = await prisma.trainingSession.create({
        data: {
          userId: user.id,
          mode,
          style,
          theme,
          startRating,
          durationSec,
          startedAt,
          endedAt,
          solvedCount,
          failedCount,
          peakRating,
          accuracy,
          avgResponseMs,
        },
      });

      const attempts = puzzles.slice(0, total).map((p, idx) => {
        const correct = idx < solvedCount;
        return {
          sessionId: session.id,
          userId: user.id,
          puzzleId: p.id,
          puzzleRating: p.rating,
          correct,
          responseMs: randInt(1500, 30000),
          createdAt: new Date(startedAt.getTime() + idx * (durationSec / Math.max(total, 1)) * 1000),
        };
      });

      if (attempts.length > 0) {
        await prisma.trainingAttempt.createMany({ data: attempts });
      }

      console.log(
        `  [${i + 1}/${count}] ${startedAt.toISOString().slice(0, 16)} ${style} ${mode}${theme ? `/${theme}` : ''} ` +
          `${durationMin}min solved=${solvedCount} failed=${failedCount} acc=${(accuracy * 100).toFixed(0)}%`,
      );
    }

    console.log('Done.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
