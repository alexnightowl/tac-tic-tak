import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { xpStanding, XpStanding } from '../sessions/progress';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type XpAward = {
  gained: number;
  before: XpStanding;
  after: XpStanding;
};

@Injectable()
export class ExperienceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adds XP (and the training time / cleared mistakes it was earned for)
   * and logs it for the weekly figures. Pass `tx` to stay inside the
   * caller's transaction.
   */
  async award(
    userId: string,
    award: { source: 'session' | 'review' | 'offline' | 'library'; xp: number; trainingSec?: number; reviews?: number },
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<XpAward> {
    const before = await tx.userExperience.findUnique({ where: { userId } });
    const xpBefore = before?.xp ?? 0;
    const trainingSec = Math.max(0, Math.round(award.trainingSec ?? 0));
    const reviews = award.reviews ?? 0;
    const row = await tx.userExperience.upsert({
      where: { userId },
      create: { userId, xp: award.xp, trainingSec, reviewsResolved: reviews },
      update: {
        xp: { increment: award.xp },
        trainingSec: { increment: trainingSec },
        reviewsResolved: { increment: reviews },
      },
    });
    if (award.xp > 0) {
      await tx.xpEvent.create({ data: { userId, source: award.source, amount: award.xp } });
    }
    return { gained: award.xp, before: xpStanding(xpBefore), after: xpStanding(row.xp) };
  }

  async summary(userId: string) {
    const since = new Date(Date.now() - WEEK_MS);
    const [row, week] = await Promise.all([
      this.prisma.userExperience.findUnique({ where: { userId } }),
      this.prisma.xpEvent.groupBy({
        by: ['source'],
        where: { userId, createdAt: { gte: since } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    const weekXp = week.reduce((s, w) => s + (w._sum.amount ?? 0), 0);
    const weekReviews = week.find((w) => w.source === 'review')?._count._all ?? 0;
    return {
      ...xpStanding(row?.xp ?? 0),
      trainingSec: row?.trainingSec ?? 0,
      reviewsResolved: row?.reviewsResolved ?? 0,
      weekXp,
      weekReviews,
    };
  }
}
