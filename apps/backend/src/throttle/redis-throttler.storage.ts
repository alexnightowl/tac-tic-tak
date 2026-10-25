import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ThrottlerLimitDetail, ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

type ThrottlerStorageRecord = Pick<ThrottlerLimitDetail, 'totalHits' | 'timeToExpire' | 'isBlocked' | 'timeToBlockExpire'>;

/**
 * Fixed-window counter + block key, one atomic script per hit.
 * KEYS[1] hit counter, KEYS[2] block flag; ARGV ttlMs, limit, blockMs.
 * Returns {hits, windowTtlMs, blocked(0|1), blockTtlMs}.
 * When the limit is exceeded the counter is dropped and the block key set,
 * so the next window starts fresh once the block expires (same semantics
 * as the in-memory ThrottlerStorageService).
 */
const HIT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  return {tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('PTTL', KEYS[1]), 1, blockTtl}
end
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  redis.call('DEL', KEYS[1])
  return {hits, ttl, 1, tonumber(ARGV[3])}
end
return {hits, ttl, 0, 0}
`;

/** Gives one hit back (never below zero, never touches a block). */
const REFUND_SCRIPT = `
local v = tonumber(redis.call('GET', KEYS[1]) or '0')
if v > 0 then return redis.call('DECR', KEYS[1]) end
return 0
`;

type ThrottleRedis = Redis & {
  throttleHit(hits: string, block: string, ttlMs: number, limit: number, blockMs: number): Promise<[number, number, number, number]>;
  throttleRefund(hits: string): Promise<number>;
};

const OP_TIMEOUT_MS = 300;
const OPEN: ThrottlerStorageRecord = { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };

/**
 * @nestjs/throttler storage on the existing Redis (REDIS_URL), shared by
 * every backend instance and surviving restarts.
 *
 * It uses its own connection with the offline queue disabled: if Redis is
 * down or slow, a hit fails open (the request is allowed, a warning is
 * logged at most once a minute) instead of hanging every API request on
 * the shared client, which queues commands forever by design.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Throttle');
  private client!: ThrottleRedis;
  private lastWarnAt = 0;
  private closed = false;

  // Lifecycle hooks run twice: Nest calls them for this provider and again
  // for ThrottlerModule's storage provider, which returns this same
  // instance. Both hooks are idempotent so only one connection is opened.
  async onModuleInit() {
    if (this.client) return;
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectionName: 'throttler',
    });
    client.on('error', (e) => this.warn(`redis: ${e.message}`));
    client.defineCommand('throttleHit', { numberOfKeys: 2, lua: HIT_SCRIPT });
    client.defineCommand('throttleRefund', { numberOfKeys: 1, lua: REFUND_SCRIPT });
    this.client = client as ThrottleRedis;
    // Wait briefly for the connection so the first requests are counted;
    // never block boot on it (ioredis keeps reconnecting in the background).
    await Promise.race([client.connect().catch(() => undefined), sleep(2000)]);
  }

  async onModuleDestroy() {
    if (!this.client || this.closed) return;
    this.closed = true;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number): Promise<ThrottlerStorageRecord> {
    try {
      const [hits, ttlMs, blocked, blockMs] = await withTimeout(
        this.client.throttleHit(key, `${key}:block`, ttl, limit, blockDuration),
      );
      return {
        totalHits: hits,
        timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.max(0, Math.ceil(blockMs / 1000)),
      };
    } catch (e) {
      this.warn(`hit failed open: ${(e as Error).message}`);
      return OPEN;
    }
  }

  async refund(key: string): Promise<void> {
    try {
      await withTimeout(this.client.throttleRefund(key));
    } catch (e) {
      this.warn(`refund failed: ${(e as Error).message}`);
    }
  }

  private warn(msg: string) {
    const now = Date.now();
    if (now - this.lastWarnAt < 60_000) return;
    this.lastWarnAt = now;
    this.log.warn(msg);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms).unref());

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${OP_TIMEOUT_MS}ms`)), OP_TIMEOUT_MS);
    t.unref();
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
