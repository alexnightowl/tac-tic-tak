import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TRAINING_STYLES, TrainingStyle } from '../sessions/unlock';

const DEFAULT_LIMIT = 100;

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async topByStyle(style: TrainingStyle, opts: { viewerId?: string; scope?: 'global' | 'friends'; limit?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), 200);
    if (!TRAINING_STYLES.includes(style)) return [];

    let userIds: string[] | null = null;
    if (opts.scope === 'friends' && opts.viewerId) {
      const friends = await this.prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ requesterId: opts.viewerId }, { addresseeId: opts.viewerId }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const ids = new Set<string>();
      ids.add(opts.viewerId); // include viewer on friends board
      for (const f of friends) {
        ids.add(f.requesterId === opts.viewerId ? f.addresseeId : f.requesterId);
      }
      userIds = Array.from(ids);
      if (userIds.length === 0) return [];
    }

    const rows = await this.prisma.userStyleProgression.findMany({
      where: {
        style,
        ...(userIds ? { userId: { in: userIds } } : {}),
      },
      orderBy: [{ currentPuzzleRating: 'desc' }, { updatedAt: 'asc' }],
      take: limit,
      include: {
        user: {
          select: {
            id: true, nickname: true, displayName: true, avatarUrl: true, country: true,
            streakDays: true, verified: true,
          },
        },
      },
    });

    return rows.map((r, i) => ({
      rank: i + 1,
      rating: r.currentPuzzleRating,
      unlocked: r.unlockedStartRating,
      isSelf: r.userId === opts.viewerId,
      streakDays: r.user.streakDays,
      user: {
        id: r.user.id,
        nickname: r.user.nickname,
        displayName: r.user.displayName,
        avatarUrl: r.user.avatarUrl,
        country: r.user.country,
        verified: r.user.verified,
      },
    }));
  }
}
