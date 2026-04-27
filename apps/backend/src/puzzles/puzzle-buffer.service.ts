import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type CachedPuzzle = {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  gameUrl: string | null;
};

/**
 * Redis-backed puzzle selector.
 *
 * Queue entries now hold FULL puzzle JSON — the /next hot path is a single
 * RPOP with zero Postgres round-trips after the queue is warmed.
 *
 * Keys:
 *   session:{sid}:queue   — List of pre-serialised puzzles for a session
 *   session:{sid}:seen    — Set of puzzle IDs already shown in this session
 *   user:{uid}:recent     — Sorted set (score=timestamp) of recent puzzle IDs
 */
@Injectable()
export class PuzzleBufferService {
  private readonly log = new Logger(PuzzleBufferService.name);

  private readonly TARGET_SIZE = 12;
  private readonly REFILL_BELOW = 6;
  private readonly RECENT_TTL_S = 60 * 60 * 24 * 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private queueKey(sid: string) { return `session:${sid}:queue`; }
  private seenKey(sid: string) { return `session:${sid}:seen`; }
  private recentKey(uid: string) { return `user:${uid}:recent`; }

  /** Returns the next puzzle, pre-parsed. Triggers a background refill when low. */
  async getNext(opts: {
    sessionId: string;
    userId: string;
    rating: number;
    theme?: string | null;
  }): Promise<CachedPuzzle | null> {
    const { sessionId } = opts;
    let len = await this.redis.client.llen(this.queueKey(sessionId));
    if (len === 0) {
      // Queue cold — must wait for a refill.
      await this.preload(opts);
      len = await this.redis.client.llen(this.queueKey(sessionId));
    }
    const json = await this.redis.client.rpop(this.queueKey(sessionId));
    if (!json) return null;
    const puzzle = JSON.parse(json) as CachedPuzzle;
    await this.redis.client.sadd(this.seenKey(sessionId), puzzle.id);
    await this.redis.client.zadd(this.recentKey(opts.userId), Date.now(), puzzle.id);
    await this.redis.client.expire(this.recentKey(opts.userId), this.RECENT_TTL_S);

    // After serving, check depth and kick off a background refill if needed.
    if (len - 1 <= this.REFILL_BELOW) {
      this.preload(opts).catch((e) => this.log.error(`background preload failed: ${e?.message}`));
    }
    return puzzle;
  }

  /** Public entry-point used on session creation to warm the queue ahead of the first /next. */
  async warmSession(opts: {
    sessionId: string;
    userId: string;
    rating: number;
    theme?: string | null;
  }): Promise<void> {
    await this.preload(opts);
  }

  async clearSession(sessionId: string) {
    await this.redis.client.del(this.queueKey(sessionId), this.seenKey(sessionId));
  }

  /**
   * Picks IDs by rating windows, loads the full puzzle data in one Postgres
   * round-trip, then stores serialised JSON in the session queue.
   *
   * Distribution matches the spec:
   *   60% normal (rating±40)
   *   25% easier (rating-120..rating-40)
   *   15% harder (rating+60..rating+180)
   */
  private async preload(opts: {
    sessionId: string;
    userId: string;
    rating: number;
    theme?: string | null;
  }) {
    const { sessionId, userId, rating, theme } = opts;
    const normal = Math.round(this.TARGET_SIZE * 0.6);
    const easier = Math.round(this.TARGET_SIZE * 0.25);
    const harder = this.TARGET_SIZE - normal - easier;

    const [sessionSeen, recent] = await Promise.all([
      this.redis.client.smembers(this.seenKey(sessionId)),
      this.redis.client.zrange(this.recentKey(userId), 0, -1),
    ]);
    const exclude = new Set<string>([...sessionSeen, ...recent]);

    const idGroups = await Promise.all([
      this.pickIds({ min: rating - 40, max: rating + 60, count: normal, theme, exclude }),
      this.pickIds({ min: rating - 120, max: rating - 40, count: easier, theme, exclude }),
      this.pickIds({ min: rating + 60, max: rating + 180, count: harder, theme, exclude }),
    ]);
    const ids = idGroups.flat();
    if (ids.length === 0) return;

    // One Postgres query to hydrate them all.
    const rows = await this.prisma.puzzle.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, fen: true, moves: true, rating: true, gameUrl: true,
        themes: { include: { theme: true } },
      },
    });

    // Preserve the picked ordering so difficulty buckets interleave by natural order.
    const byId = new Map(rows.map((r) => [r.id, r]));
    const payloads: string[] = [];
    for (const id of ids) {
      const r = byId.get(id);
      if (!r) continue;
      const cached: CachedPuzzle = {
        id: r.id,
        fen: r.fen,
        moves: r.moves.split(' '),
        rating: r.rating,
        gameUrl: r.gameUrl,
        themes: r.themes.map((pt) => pt.theme.slug),
      };
      payloads.push(JSON.stringify(cached));
    }
    if (payloads.length === 0) return;
    await this.redis.client.lpush(this.queueKey(sessionId), ...payloads);
  }

  private async pickIds(opts: {
    min: number;
    max: number;
    count: number;
    theme?: string | null;
    exclude: Set<string>;
  }): Promise<string[]> {
    if (opts.count <= 0) return [];
    const take = opts.count * 4;

    // Quality filters — drop puzzles that the Lichess community has
    // down-voted or that don't have enough plays to be trustworthy.
    // `popularity` is on [-100, 100] (net thumbs up/down ratio); 95
    // means almost-universal acceptance. 200+ plays guarantees the
    // rating has settled and there's been enough exposure to surface
    // any "multiple solutions" / "wrong line" reports.
    //
    // This keeps ~20% of the imported dataset (~880k of 4.4M). For
    // ratings 2000+ the per-band pool shrinks to ~50k; if heavy users
    // start seeing repeats we can relax to 92/200 which roughly
    // doubles the pool.
    const MIN_POPULARITY = 95;
    const MIN_PLAYS = 200;

    const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      opts.theme
        ? `
          SELECT p."id"
          FROM "Puzzle" p
          JOIN "PuzzleTheme" pt ON pt."puzzleId" = p."id"
          JOIN "Theme" t ON t."id" = pt."themeId"
          WHERE p."rating" BETWEEN $1 AND $2
            AND p."popularity" >= ${MIN_POPULARITY}
            AND p."nbPlays" >= ${MIN_PLAYS}
            AND t."slug" = $3
          ORDER BY random()
          LIMIT $4
        `
        : `
          SELECT p."id"
          FROM "Puzzle" p
          WHERE p."rating" BETWEEN $1 AND $2
            AND p."popularity" >= ${MIN_POPULARITY}
            AND p."nbPlays" >= ${MIN_PLAYS}
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
      opts.exclude.add(r.id);
      picked.push(r.id);
      if (picked.length >= opts.count) break;
    }
    return picked;
  }
}
