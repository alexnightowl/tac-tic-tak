import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TRAINING_STYLES, TrainingStyle } from '../sessions/unlock';
import { initialLevel } from '../sessions/progress';

const DEFAULT_LIMIT = 100;
/** The weekly league's clock: weeks start Monday 00:00 Kyiv time ('Europe/Kiev' is in every tzdata). */
const LEAGUE_TZ = 'Europe/Kiev';

const USER_SELECT = {
  id: true, nickname: true, displayName: true, avatarUrl: true, country: true,
  streakDays: true, streakLastDay: true, verified: true,
} as const;

type BoardUser = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

function publicUser(u: BoardUser) {
  return {
    id: u.id,
    nickname: u.nickname,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    country: u.country,
    verified: u.verified,
  };
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async topByStyle(style: TrainingStyle, opts: { viewerId?: string; scope?: 'global' | 'friends'; limit?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), 200);
    if (!TRAINING_STYLES.includes(style)) return [];

    const userIds = opts.scope === 'friends' && opts.viewerId ? await this.friendIds(opts.viewerId) : null;

    const rows = await this.prisma.userStyleProgression.findMany({
      where: {
        style,
        ...(userIds ? { userId: { in: userIds } } : {}),
      },
      // D39: players are ranked by their level; a progression that never
      // finished a v2 session has none yet and sorts by its rating after.
      orderBy: [{ level: { sort: 'desc', nulls: 'last' } }, { currentPuzzleRating: 'desc' }, { updatedAt: 'asc' }],
      take: limit,
      include: { user: { select: USER_SELECT } },
    });

    return rows.map((r, i) => ({
      rank: i + 1,
      // The level (D39); the field keeps its name for the clients.
      rating: r.level ?? initialLevel(r.currentPuzzleRating, r.unlockedStartRating),
      level: r.level ?? initialLevel(r.currentPuzzleRating, r.unlockedStartRating),
      unlocked: r.unlockedStartRating,
      isSelf: r.userId === opts.viewerId,
      streakDays: r.user.streakDays,
      streakLastDay: r.user.streakLastDay,
      user: publicUser(r.user),
    }));
  }

  /**
   * The weekly league (mobile Rivals, 2026-11-04): XP earned since Monday
   * 00:00 Kyiv time, every XpEvent source counted. Ties go to whoever got
   * there first. `self` is the viewer's own row when it is outside `rows`
   * (null rank: no XP yet this week).
   */
  async weekly(viewerId: string, opts: { scope?: 'global' | 'friends'; limit?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), 200);
    const ids = opts.scope === 'friends' ? await this.friendIds(viewerId) : null;
    const [week] = await this.prisma.$queryRaw<Array<{ start: Date; end: Date }>>`
      SELECT (date_trunc('week', now() AT TIME ZONE ${LEAGUE_TZ}) AT TIME ZONE ${LEAGUE_TZ}) AS start,
             ((date_trunc('week', now() AT TIME ZONE ${LEAGUE_TZ}) + interval '7 days') AT TIME ZONE ${LEAGUE_TZ}) AS "end"
    `;
    const inScope = ids ? Prisma.sql`AND "userId" IN (${Prisma.join(ids)})` : Prisma.empty;
    const totals = await this.prisma.$queryRaw<Array<{ userId: string; xp: number }>>`
      SELECT "userId", SUM(amount)::int AS xp
      FROM "XpEvent"
      WHERE "createdAt" >= ${week.start} ${inScope}
      GROUP BY "userId"
      HAVING SUM(amount) > 0
      ORDER BY xp DESC, MAX("createdAt") ASC
      LIMIT ${limit}
    `;

    let self: { userId: string; xp: number; rank: number | null } | null = null;
    if (!totals.some((r) => r.userId === viewerId)) {
      const [mine] = await this.prisma.$queryRaw<Array<{ xp: number }>>`
        SELECT COALESCE(SUM(amount), 0)::int AS xp FROM "XpEvent"
        WHERE "userId" = ${viewerId} AND "createdAt" >= ${week.start}
      `;
      let rank: number | null = null;
      if (mine.xp > 0) {
        const [ahead] = await this.prisma.$queryRaw<Array<{ n: number }>>`
          SELECT COUNT(*)::int AS n FROM (
            SELECT "userId" FROM "XpEvent"
            WHERE "createdAt" >= ${week.start} ${inScope}
            GROUP BY "userId" HAVING SUM(amount) > ${mine.xp}
          ) t
        `;
        rank = ahead.n + 1;
      }
      self = { userId: viewerId, xp: mine.xp, rank };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...totals.map((r) => r.userId), ...(self ? [viewerId] : [])] } },
      select: USER_SELECT,
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const row = (userId: string, xp: number, rank: number | null) => {
      const u = byId.get(userId)!;
      return {
        rank,
        xp,
        isSelf: userId === viewerId,
        streakDays: u.streakDays,
        streakLastDay: u.streakLastDay,
        user: publicUser(u),
      };
    };
    return {
      weekStart: week.start.toISOString(),
      weekEnd: week.end.toISOString(),
      rows: totals.filter((r) => byId.has(r.userId)).map((r, i) => row(r.userId, r.xp, i + 1)),
      self: self && byId.has(viewerId) ? row(viewerId, self.xp, self.rank) : null,
    };
  }

  /** The viewer and their accepted friends. */
  private async friendIds(viewerId: string): Promise<string[]> {
    const friends = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const ids = new Set<string>([viewerId]); // include viewer on friends board
    for (const f of friends) {
      ids.add(f.requesterId === viewerId ? f.addresseeId : f.requesterId);
    }
    return Array.from(ids);
  }
}
