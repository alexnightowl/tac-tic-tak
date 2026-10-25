import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** How long a user's tokenVersion is cached in Redis. */
export const TOKEN_VERSION_CACHE_SEC = 60;
/** A Redis call slower than this falls back to Postgres (Redis down must not hang every authed route). */
const REDIS_TIMEOUT_MS = 250;

export const tokenVersionKey = (userId: string) => `auth:tv:${userId}`;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('redis timeout')), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * User.tokenVersion lookups for JwtStrategy (B4). One Redis GET per
 * authenticated request; Postgres at most once per user per 60 s.
 */
@Injectable()
export class TokenVersionService {
  private readonly log = new Logger(TokenVersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** The user's current tokenVersion, or null when the user row does not exist. */
  async current(userId: string): Promise<number | null> {
    const key = tokenVersionKey(userId);
    try {
      const cached = await withTimeout(this.redis.client.get(key), REDIS_TIMEOUT_MS);
      if (cached !== null) {
        const n = Number(cached);
        if (Number.isInteger(n)) return n;
      }
    } catch (e) {
      this.log.warn(`tokenVersion cache read failed, using Postgres: ${(e as Error).message}`);
    }
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
    // A missing user is not cached and not rejected here: today a deleted
    // user's token still reaches the handlers (404 on /users/me), and the
    // web contract freezes that.
    if (!row) return null;
    void this.cache(key, row.tokenVersion);
    return row.tokenVersion;
  }

  /** Increments tokenVersion (invalidates every access token issued before) and refreshes the cache. */
  async bump(userId: string): Promise<number> {
    const { tokenVersion } = await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    // Awaited so the very next request already sees the new version.
    await this.cache(tokenVersionKey(userId), tokenVersion);
    return tokenVersion;
  }

  /** Best effort, never rejects: on a Redis failure the next request reads Postgres again. */
  private cache(key: string, value: number): Promise<void> {
    return withTimeout(this.redis.client.set(key, String(value), 'EX', TOKEN_VERSION_CACHE_SEC), REDIS_TIMEOUT_MS).then(
      () => undefined,
      () => undefined,
    );
  }
}
