import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const NICKNAME = 'lazynightowl';
const SESSION_COUNT = 20;

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

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const user = await prisma.user.findUnique({ where: { nickname: NICKNAME } });
  if (!user) throw new Error(`User ${NICKNAME} not found`);

  console.log(`Seeding ${SESSION_COUNT} sessions for ${NICKNAME} (${user.id})`);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < SESSION_COUNT; i++) {
    const isTheme = Math.random() < 0.4;
    const mode = isTheme ? 'theme' : 'mixed';
    const theme = isTheme ? pick(THEMES) : null;

    const durationMin = pick([5, 10, 15, 20, 30]);
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
      `  [${i + 1}/${SESSION_COUNT}] ${startedAt.toISOString().slice(0, 16)} ${mode}${theme ? `/${theme}` : ''} ` +
        `${durationMin}min solved=${solvedCount} failed=${failedCount} acc=${(accuracy * 100).toFixed(0)}%`,
    );
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
