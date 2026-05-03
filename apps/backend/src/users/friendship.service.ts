import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';

export type FriendshipView = 'none' | 'self' | 'outgoing' | 'incoming' | 'friends';

const USER_CARD_SELECT = {
  id: true, nickname: true, displayName: true, avatarUrl: true, country: true,
  verified: true,
} as const;

@Injectable()
export class FriendshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievements: AchievementsService,
  ) {}

  /** List accepted friends (as lightweight user cards). */
  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: USER_CARD_SELECT },
        addressee: { select: USER_CARD_SELECT },
      },
      orderBy: { acceptedAt: 'desc' },
    });
    return rows.map((r) => ({
      friendshipId: r.id,
      since: r.acceptedAt,
      user: r.requesterId === userId ? r.addressee : r.requester,
    }));
  }

  /** List pending requests split into incoming and outgoing. */
  async listPending(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { status: 'pending', addresseeId: userId },
        include: { requester: { select: USER_CARD_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendship.findMany({
        where: { status: 'pending', requesterId: userId },
        include: { addressee: { select: USER_CARD_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      incoming: incoming.map((r) => ({ id: r.id, createdAt: r.createdAt, user: r.requester })),
      outgoing: outgoing.map((r) => ({ id: r.id, createdAt: r.createdAt, user: r.addressee })),
    };
  }

  /** Sends a friend request to the user identified by nickname. */
  async sendRequest(requesterId: string, nickname: string) {
    const target = await this.prisma.user.findUnique({ where: { nickname } });
    if (!target) throw new NotFoundException('user not found');
    if (target.id === requesterId) throw new BadRequestException('cannot friend yourself');

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: requesterId },
        ],
      },
    });
    if (existing) {
      if (existing.status === 'accepted') throw new ConflictException('already friends');
      if (existing.status === 'pending') {
        // If the target already sent us a request, accept it instead.
        if (existing.addresseeId === requesterId) {
          return this.accept(requesterId, existing.id);
        }
        throw new ConflictException('request already pending');
      }
    }

    const row = await this.prisma.friendship.create({
      data: { requesterId, addresseeId: target.id, status: 'pending' },
      include: { addressee: { select: USER_CARD_SELECT } },
    });
    return { id: row.id, status: row.status, user: row.addressee };
  }

  async accept(userId: string, friendshipId: string) {
    const row = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!row || row.addresseeId !== userId) throw new NotFoundException('request not found');
    if (row.status !== 'pending') throw new BadRequestException('not pending');
    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'accepted', acceptedAt: new Date() },
      include: { requester: { select: USER_CARD_SELECT } },
    });
    // Both sides may have just hit "first friend" / "five friends".
    // Evaluate for both to surface toasts on either client when they
    // refresh.
    const [acceptingUserNew, requesterNew] = await Promise.all([
      this.achievements.evaluate(userId).catch(() => []),
      this.achievements.evaluate(row.requesterId).catch(() => []),
    ]);
    return {
      id: updated.id,
      status: updated.status,
      user: updated.requester,
      achievementsUnlocked: acceptingUserNew,
      // requesterNew is intentionally not returned — that user fetches
      // their own /achievements list separately. Persisted, so they'll
      // see toasts on next page load.
      _requesterAchievements: requesterNew.length,
    };
  }

  /** Decline incoming, cancel outgoing — same mechanic: delete the row. */
  async reject(userId: string, friendshipId: string) {
    const row = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!row || (row.addresseeId !== userId && row.requesterId !== userId)) {
      throw new NotFoundException('request not found');
    }
    if (row.status !== 'pending') throw new BadRequestException('not pending');
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { ok: true };
  }

  /** Removes an accepted friendship in either direction. */
  async removeByUserId(userId: string, otherUserId: string) {
    const row = await this.prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: userId },
        ],
      },
    });
    if (!row) throw new NotFoundException('friendship not found');
    await this.prisma.friendship.delete({ where: { id: row.id } });
    return { ok: true };
  }

  /**
   * Compute the relationship state between two users and return the
   * friendship row id so the frontend can call the right mutation.
   */
  async statusWith(viewerId: string | null, targetId: string):
    Promise<{ state: FriendshipView; friendshipId: string | null }>
  {
    if (!viewerId) return { state: 'none', friendshipId: null };
    if (viewerId === targetId) return { state: 'self', friendshipId: null };
    const row = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: viewerId },
        ],
      },
    });
    if (!row) return { state: 'none', friendshipId: null };
    if (row.status === 'accepted') return { state: 'friends', friendshipId: row.id };
    if (row.status === 'pending') {
      return {
        state: row.requesterId === viewerId ? 'outgoing' : 'incoming',
        friendshipId: row.id,
      };
    }
    return { state: 'none', friendshipId: null };
  }

  /** Prefix search by nickname (case-insensitive), excluding the viewer. */
  async search(viewerId: string | null, q: string, limit = 10) {
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];
    const rows = await this.prisma.user.findMany({
      where: {
        nickname: { startsWith: trimmed, mode: 'insensitive' },
        ...(viewerId ? { NOT: { id: viewerId } } : {}),
      },
      take: Math.min(limit, 25),
      orderBy: { nickname: 'asc' },
      select: USER_CARD_SELECT,
    });
    return rows;
  }
}
