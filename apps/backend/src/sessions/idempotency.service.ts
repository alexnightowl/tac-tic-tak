import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';

/** How long a lock holder may run before another caller may take over. */
const LOCK_MS = 15_000;
/** How long a concurrent duplicate waits for the first caller's body. */
const WAIT_MS = 10_000;
const POLL_MS = 25;

// Deletes the lock only if we still own it (a slow holder whose lock
// expired must not delete the next holder's lock).
const RELEASE_LUA = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Response cache for client-keyed retries (attempt `clientAttemptId`,
 * next `requestId`). The first caller runs `fn` under a short Redis lock
 * and stores its JSON body for `ttlSec`; every later or concurrent caller
 * with the same key gets that body back verbatim (byte-identical once
 * serialised again, because JSON.parse keeps key order).
 *
 * Errors are not cached: a 400/404 from `fn` propagates and a retry runs
 * `fn` again. The DB-level guard for attempts (the unique
 * clientAttemptId column) is in SessionsService; this cache is the fast
 * path and the "same body" guarantee.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisService) {}

  async run(key: string, ttlSec: number, fn: () => Promise<unknown>): Promise<unknown> {
    const r = this.redis.client;
    const hit = await r.get(key);
    if (hit !== null) return JSON.parse(hit);

    const lockKey = `${key}:lock`;
    const token = randomUUID();
    const deadline = Date.now() + WAIT_MS;
    while ((await r.set(lockKey, token, 'PX', LOCK_MS, 'NX')) !== 'OK') {
      if (Date.now() > deadline) throw new ConflictException('duplicate request still in progress');
      await sleep(POLL_MS);
      const cached = await r.get(key);
      if (cached !== null) return JSON.parse(cached);
    }

    try {
      // A previous holder may have stored the body between our GET and SET NX.
      const cached = await r.get(key);
      if (cached !== null) return JSON.parse(cached);
      const json = JSON.stringify(await fn());
      // The work is done; a failed cache write must not turn it into a 500.
      // A later replay then falls back to the caller's DB-level check.
      await r.set(key, json, 'EX', ttlSec).catch(() => undefined);
      return JSON.parse(json);
    } finally {
      await r.eval(RELEASE_LUA, 1, lockKey, token).catch(() => undefined);
    }
  }
}
