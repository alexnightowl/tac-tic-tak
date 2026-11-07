import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client!: Redis;

  onModuleInit() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    // Fail fast instead of queueing forever: with maxRetriesPerRequest null a
    // dead Redis made POST /sessions hang until the client gave up
    // (2026-11-07). Callers fall back to Postgres or skip the cache.
    this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, commandTimeout: 2_000 });
    this.client.on('error', () => undefined);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // Presence ("online" on the mobile friends list): refreshed by every
  // authenticated request, at most once a minute per user and process.
  private readonly touched = new Map<string, number>();

  touchPresence(userId: string) {
    const now = Date.now();
    if (now - (this.touched.get(userId) ?? 0) < PRESENCE_REFRESH_MS) return;
    this.touched.set(userId, now);
    if (this.touched.size > 10_000) this.touched.clear();
    this.client.set(presenceKey(userId), '1', 'EX', PRESENCE_TTL_SEC).catch(() => undefined);
  }

  /** Online flags for these users, in order (all false when Redis is down). */
  async online(userIds: string[]): Promise<boolean[]> {
    if (userIds.length === 0) return [];
    const seen = await this.client.mget(...userIds.map(presenceKey)).catch(() => userIds.map(() => null));
    return seen.map((v) => v != null);
  }
}

const PRESENCE_TTL_SEC = 120;
const PRESENCE_REFRESH_MS = 60_000;
const presenceKey = (userId: string) => `seen:${userId}`;
