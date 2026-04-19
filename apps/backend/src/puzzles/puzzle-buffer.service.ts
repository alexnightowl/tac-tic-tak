import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Redis-backed puzzle selector.
 *
 * Keys:
 *   session:{sid}:queue   — List of puzzle IDs pre-fetched for a session (RPOP)
 *   session:{sid}:seen    — Set of puzzle IDs already shown in this session
 *   user:{uid}:recent     — Sorted set (score=timestamp) of recent puzzle IDs
 */
@Injectable()
export class PuzzleBufferService {
  private readonly BUFFER_SIZE = 12;
  private readonly REFILL_BELOW = 4;
  private readonly RECENT_TTL_S = 60 * 60 * 24 * 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private queueKey(sid: string) { return `session:${sid}:queue`; }
  private seenKey(sid: string) { return `session:${sid}:seen`; }
  private recentKey(uid: string) { return `user:${uid}:recent`; }

  async getNext(opts: {
    sessionId: string;
    userId: string;
    rating: number;
    theme?: string | null;
  }): Promise<string | null> {
    const { sessionId } = opts;
    const len = await this.redis.client.llen(this.queueKey(sessionId));
    if (len <= this.REFILL_BELOW) await this.preload(opts);
    const id = await this.redis.client.rpop(this.queueKey(sessionId));
    if (id) {
      await this.redis.client.sadd(this.seenKey(sessionId), id);
      await this.redis.client.zadd(this.recentKey(opts.userId), Date.now(), id);
      await this.redis.client.expire(this.recentKey(opts.userId), this.RECENT_TTL_S);
    }
    return id;
  }

  async markSeen(sessionId: string, userId: string, puzzleId: string) {
    await this.redis.client.sadd(this.seenKey(sessionId), puzzleId);
    await this.redis.client.zadd(this.recentKey(userId), Date.now(), puzzleId);
  }

  async clearSession(sessionId: string) {
    await this.redis.client.del(this.queueKey(sessionId), this.seenKey(sessionId));
  }

  /**
   * Fetches a fresh bucket of puzzle IDs into the session queue.
   *
   * Distribution follows the spec:
   *   60% normal (rating±40)
   *   25% easier (rating-40..rating+60 shifted down)
   *   15% harder
   */
  private async preload(opts: {
    sessionId: string;
    userId: string;
    rating: number;
    theme?: string | null;
  }) {
    const { sessionId, userId, rating, theme } = opts;
    const normal = Math.round(this.BUFFER_SIZE * 0.6);
    const easier = Math.round(this.BUFFER_SIZE * 0.25);
    const harder = this.BUFFER_SIZE - normal - easier;

    const [sessionSeen, recent] = await Promise.all([
      this.redis.client.smembers(this.seenKey(sessionId)),
      this.redis.client.zrange(this.recentKey(userId), 0, -1),
    ]);
    const exclude = new Set<string>([...sessionSeen, ...recent]);

    const picks = await Promise.all([
      this.pick({ min: rating - 40, max: rating + 60, count: normal, theme, exclude }),
      this.pick({ min: rating - 120, max: rating - 40, count: easier, theme, exclude }),
      this.pick({ min: rating + 60, max: rating + 180, count: harder, theme, exclude }),
    ]);
    const ids = picks.flat();
    if (ids.length === 0) return;
    // LPUSH so RPOP drains in insertion order.
    await this.redis.client.lpush(this.queueKey(sessionId), ...ids);
  }

  private async pick(opts: {
    min: number;
    max: number;
    count: number;
    theme?: string | null;
    exclude: Set<string>;
  }): Promise<string[]> {
    if (opts.count <= 0) return [];
    // Over-fetch to tolerate exclusions, then filter locally.
    const take = opts.count * 4;

    const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      opts.theme
        ? `
          SELECT p."id"
          FROM "Puzzle" p
          JOIN "PuzzleTheme" pt ON pt."puzzleId" = p."id"
          JOIN "Theme" t ON t."id" = pt."themeId"
          WHERE p."rating" BETWEEN $1 AND $2
            AND t."slug" = $3
          ORDER BY random()
          LIMIT $4
        `
        : `
          SELECT p."id"
          FROM "Puzzle" p
          WHERE p."rating" BETWEEN $1 AND $2
          ORDER BY random()
          LIMIT $3
        `,
      opts.min,
      opts.max,
      ...(opts.theme ? [opts.theme, take] : [take]),
    );

    const picked: string[] = [];
    for (const r of rows) {
      if (opts.exclude.has(r.id)) continue;
      opts.exclude.add(r.id); // prevent duplicates across buckets
      picked.push(r.id);
      if (picked.length >= opts.count) break;
    }
    return picked;
  }
}
