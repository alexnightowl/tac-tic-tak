import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const MAX_LIMIT = 100;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(q: string | undefined, limit: number, offset: number) {
    const safeLimit = Math.min(Math.max(limit | 0, 1), MAX_LIMIT);
    const safeOffset = Math.max(offset | 0, 0);
    const search = (q ?? '').trim().toLowerCase();

    const where = search
      ? {
          OR: [
            { nickname: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip: safeOffset,
        select: {
          id: true,
          nickname: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
          isAdmin: true,
          verified: true,
          country: true,
          _count: { select: { sessions: true, attempts: true } },
        },
      }),
    ]);

    const ids = users.map((u) => u.id);
    // Last finished session per user — one round-trip via groupBy
    // instead of N findFirst calls.
    const lastByUser = ids.length
      ? await this.prisma.trainingSession.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, endedAt: { not: null } },
          _max: { startedAt: true },
        })
      : [];
    const lastByUserMap = new Map(lastByUser.map((r) => [r.userId, r._max.startedAt]));

    return {
      total,
      limit: safeLimit,
      offset: safeOffset,
      users: users.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        country: u.country,
        createdAt: u.createdAt,
        isAdmin: u.isAdmin,
        verified: u.verified,
        sessionCount: u._count.sessions,
        attemptCount: u._count.attempts,
        lastSessionAt: lastByUserMap.get(u.id) ?? null,
      })),
    };
  }

  async deleteUser(adminUserId: string, targetUserId: string) {
    if (adminUserId === targetUserId) {
      // No self-delete — would lock the operator out of /admin instantly
      // and leave no path back without DB access.
      throw new ForbiddenException('cannot delete your own account from /admin');
    }
    try {
      await this.prisma.user.delete({ where: { id: targetUserId } });
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Record to delete does not exist')) {
        throw new NotFoundException();
      }
      throw e;
    }
    return { ok: true };
  }

  async setPassword(targetUserId: string, password: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException('password must be at least 8 characters');
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      const u = await this.prisma.user.update({
        where: { id: targetUserId },
        data: { passwordHash: hash },
        select: { id: true, nickname: true },
      });
      return { ok: true, nickname: u.nickname };
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Record to update not found')) {
        throw new NotFoundException();
      }
      throw e;
    }
  }

  async activity(daysParam: number) {
    // Clamp to a sane window — 1 to 365 days, default 30. Anything
    // wider would be slow without an index dedicated to this query.
    const days = Math.min(Math.max(daysParam | 0 || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Per-day series: signups, sessions started, distinct active users.
    // The CTE walks the date window so days with no activity still
    // render in the chart instead of leaving gaps.
    type DailyRow = {
      day: Date;
      signups: bigint;
      sessions: bigint;
      active_users: bigint;
    };
    const daily = await this.prisma.$queryRaw<DailyRow[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${since}::timestamp),
          date_trunc('day', NOW()),
          interval '1 day'
        ) AS day
      ),
      signups AS (
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS n
        FROM "User"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
      ),
      sess AS (
        SELECT date_trunc('day', "startedAt") AS day,
               COUNT(*)::bigint AS n,
               COUNT(DISTINCT "userId")::bigint AS u
        FROM "TrainingSession"
        WHERE "startedAt" >= ${since}
        GROUP BY 1
      )
      SELECT d.day AS day,
             COALESCE(signups.n, 0)::bigint AS signups,
             COALESCE(sess.n, 0)::bigint AS sessions,
             COALESCE(sess.u, 0)::bigint AS active_users
      FROM days d
      LEFT JOIN signups ON signups.day = d.day
      LEFT JOIN sess ON sess.day = d.day
      ORDER BY d.day ASC
    `;

    const totalUsers = await this.prisma.user.count();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [sessionsToday, activeToday7, active30] = await Promise.all([
      this.prisma.trainingSession.count({ where: { startedAt: { gte: todayStart } } }),
      this.prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(DISTINCT "userId")::bigint AS n
        FROM "TrainingSession"
        WHERE "startedAt" >= NOW() - interval '7 days'
      `,
      this.prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(DISTINCT "userId")::bigint AS n
        FROM "TrainingSession"
        WHERE "startedAt" >= NOW() - interval '30 days'
      `,
    ]);

    // Last-active leaderboard: top 20 users by most-recent session.
    type RecentRow = {
      id: string;
      nickname: string;
      displayName: string | null;
      avatarUrl: string | null;
      last_session: Date;
      sessions_7d: bigint;
    };
    const recent = await this.prisma.$queryRaw<RecentRow[]>`
      SELECT u."id",
             u."nickname",
             u."displayName",
             u."avatarUrl",
             MAX(s."startedAt") AS last_session,
             COUNT(*) FILTER (WHERE s."startedAt" >= NOW() - interval '7 days')::bigint AS sessions_7d
      FROM "TrainingSession" s
      JOIN "User" u ON u."id" = s."userId"
      WHERE s."startedAt" >= NOW() - interval '30 days'
      GROUP BY u."id"
      ORDER BY last_session DESC
      LIMIT 20
    `;

    return {
      days,
      totals: {
        totalUsers,
        sessionsToday,
        dau7: Number(activeToday7[0]?.n ?? 0n),
        mau30: Number(active30[0]?.n ?? 0n),
      },
      daily: daily.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        signups: Number(d.signups),
        sessions: Number(d.sessions),
        activeUsers: Number(d.active_users),
      })),
      recent: recent.map((r) => ({
        id: r.id,
        nickname: r.nickname,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        lastSessionAt: r.last_session.toISOString(),
        sessions7d: Number(r.sessions_7d),
      })),
    };
  }
}
