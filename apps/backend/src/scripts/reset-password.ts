/**
 * One-off password reset for a known user. Useful while we don't have
 * a proper email-based reset flow yet.
 *
 * Usage (inside the backend container):
 *   pnpm --filter backend exec tsx src/scripts/reset-password.ts <nickname> <new-password>
 *
 * Or on the prod VPS:
 *   docker exec -it taktic_backend \
 *     node dist/scripts/reset-password.js <nickname> <new-password>
 * ...but since the image strips scripts/, easier path is:
 *   docker exec -it taktic_backend \
 *     sh -c 'npx tsx src/scripts/reset-password.ts <nickname> <pass>'
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const [nickname, password] = process.argv.slice(2);
  if (!nickname || !password) {
    console.error('Usage: reset-password <nickname> <new-password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash(password, 10);
    const u = await prisma.user.update({
      where: { nickname },
      data: { passwordHash: hash },
      select: { id: true, nickname: true },
    });
    console.log(`Password reset for @${u.nickname} (id=${u.id}).`);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('Record to update not found')) {
      console.error(`No user with nickname "${nickname}".`);
      process.exit(2);
    }
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
