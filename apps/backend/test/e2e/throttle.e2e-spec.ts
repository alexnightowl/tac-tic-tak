/**
 * B11 rate limiting (@nestjs/throttler on Redis).
 *
 * Limits are read from the environment when the app boots, so each block
 * boots its own app with the THROTTLE_* overrides it needs (a low limit
 * proves a throttler without hundreds of requests) and restores the env
 * afterwards. The default-limit cases (6th login, 4th register) run with
 * no overrides at all; the golden web-contract spec also runs under the
 * defaults and must stay green.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { bootTestApp, bearer, TestApp } from '../helpers/app';
import { resetDatabase } from '../helpers/db';
import { createUser, DEFAULT_PASSWORD, tokenFor } from '../helpers/seed';
import { RedisThrottlerStorage } from '../../src/throttle/redis-throttler.storage';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function bootWithEnv(env: Record<string, string>): Promise<TestApp & { restoreEnv: () => void }> {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  const t = await bootTestApp();
  return {
    ...t,
    restoreEnv: () => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    },
  };
}

function expect429(res: { status: number; headers: Record<string, string>; body: any }, maxRetry: number) {
  expect(res.status).toBe(429);
  const retry = Number(res.headers['retry-after']);
  expect(Number.isInteger(retry)).toBe(true);
  expect(retry).toBeGreaterThanOrEqual(1);
  expect(retry).toBeLessThanOrEqual(maxRetry);
  expect(res.body).toEqual({
    statusCode: 429,
    message: `Too many requests, try again in ${retry} s`,
    error: 'Too Many Requests',
    retryAfter: retry,
  });
}

describe('throttling with the default limits', () => {
  let t: Awaited<ReturnType<typeof bootWithEnv>>;
  const login = (nickname: string, password: string, xff?: string) => {
    const r = t.http().post('/api/auth/login').set('Content-Type', 'application/json');
    if (xff) r.set('X-Forwarded-For', xff);
    return r.send({ nickname, password });
  };

  beforeAll(async () => {
    t = await bootWithEnv({});
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma, t.redis);
  });
  afterAll(async () => {
    await t?.close();
    t?.restoreEnv();
  });

  it('the 6th login attempt from one IP within a minute gets 429 with Retry-After', async () => {
    const u = await createUser(t.prisma, { nickname: 'thrA' });
    for (let i = 1; i <= 5; i++) {
      const res = await login(u.nickname, `wrong-${i}`);
      expect(res.status).toBe(401);
    }
    const sixth = await login(u.nickname, `wrong-6`);
    expect429(sixth, 60);
    // Blocked means blocked: even the right password waits out the block.
    expect((await login(u.nickname, DEFAULT_PASSWORD)).status).toBe(429);
  });

  it('successful logins give their hit back (a web user logging in repeatedly is never blocked)', async () => {
    const u = await createUser(t.prisma, { nickname: 'thrB' });
    for (let i = 0; i < 8; i++) {
      const res = await login(u.nickname, DEFAULT_PASSWORD);
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(['token', 'user']);
    }
    for (let i = 0; i < 5; i++) expect((await login(u.nickname, 'wrong')).status).toBe(401);
    expect((await login(u.nickname, 'wrong')).status).toBe(429);
  });

  it('a 4th created account from one IP within an hour gets 429; failed registrations do not count', async () => {
    const reg = (nickname: string, password = 'Passw0rd1', repeat = password) =>
      t.http().post('/api/auth/register').send({ nickname, password, repeatPassword: repeat });
    expect((await reg('x')).status).toBe(400);
    expect((await reg('regDiff', 'Passw0rd1', 'Passw0rd9')).status).toBe(400);
    for (const n of ['reg1', 'reg2']) expect((await reg(n)).status).toBe(201);
    expect((await reg('reg1')).status).toBe(400); // nickname taken: refunded
    expect((await reg('reg3')).status).toBe(201);
    // Three accounts created: any further attempt in the window is blocked.
    expect429(await reg('reg4'), 3600);
  });

  it('normal responses carry no X-RateLimit-* headers', async () => {
    const u = await createUser(t.prisma, { nickname: 'thrH' });
    const res = await t.http().get('/api/users/me').set(bearer(tokenFor(t.jwt, u)));
    expect(res.status).toBe(200);
    expect(Object.keys(res.headers).filter((h) => /ratelimit|retry-after/i.test(h))).toEqual([]);
  });

  it("with 'trust proxy' 1 (B2), each forwarded client IP behind nginx gets its own bucket", async () => {
    for (let i = 0; i < 5; i++) expect((await login(`a${i}`, 'wrong', '198.51.100.7')).status).toBe(401);
    expect429(await login('a5', 'wrong', '198.51.100.7'), 60);
    // Another client behind the same proxy is unaffected.
    expect((await login('b0', 'wrong', '198.51.100.8')).status).toBe(401);
    // nginx appends the peer address: only the last hop counts, a spoofed first entry does not.
    expect((await login('b1', 'wrong', '198.51.100.7, 198.51.100.9')).status).toBe(401);
  });

  it("if 'trust proxy' were off, a proxied request skips per-IP limits instead of sharing the proxy's bucket", async () => {
    // Defence in depth for a misconfigured deploy: without `trust proxy`,
    // req.ip is nginx's address, so per-IP limits would throttle the whole
    // site as one client. They are skipped instead (with a warning).
    const express = t.app as NestExpressApplication;
    express.set('trust proxy', false);
    try {
      for (let i = 0; i < 8; i++) {
        expect((await login(`ghost${i}`, 'wrong', `203.0.113.${i}`)).status).toBe(401);
      }
      // The per-nickname limit still applies (10/h).
      for (let i = 0; i < 10; i++) expect((await login('victim', 'wrong', '203.0.113.50')).status).toBe(401);
      expect429(await login('victim', 'wrong', '203.0.113.51'), 3600);
    } finally {
      express.set('trust proxy', 1);
    }
  });
});

describe('throttling with low limits from the environment', () => {
  let t: Awaited<ReturnType<typeof bootWithEnv>>;

  beforeAll(async () => {
    t = await bootWithEnv({
      THROTTLE_GLOBAL_LIMIT: '6',
      THROTTLE_LOGIN_IP_LIMIT: '100',
      THROTTLE_LOGIN_NICKNAME_LIMIT: '2',
      THROTTLE_SEARCH_LIMIT: '2',
      THROTTLE_AVATAR_LIMIT: '1',
      THROTTLE_FRIEND_REQUEST_LIMIT: '1',
    });
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma, t.redis);
  });
  afterAll(async () => {
    await t?.close();
    t?.restoreEnv();
  });

  it('global: per user when authenticated, per IP when anonymous, invalid tokens count as anonymous', async () => {
    const a = await createUser(t.prisma, { nickname: 'globA' });
    const b = await createUser(t.prisma, { nickname: 'globB' });
    const ta = tokenFor(t.jwt, a);
    for (let i = 0; i < 6; i++) expect((await t.http().get('/api/users/me').set(bearer(ta))).status).toBe(200);
    // Counted across routes, not per route.
    expect429(await t.http().get('/api/achievements').set(bearer(ta)), 60);
    // Another user from the same IP is unaffected...
    expect((await t.http().get('/api/users/me').set(bearer(tokenFor(t.jwt, b)))).status).toBe(200);
    // ...and so is the anonymous bucket of that IP.
    for (let i = 0; i < 6; i++) {
      expect((await t.http().get('/api/users/by-nickname/globB')).status).toBe(200);
    }
    // A forged/garbage token is keyed by IP, so it cannot drain another user's bucket.
    expect429(await t.http().get('/api/users/me').set(bearer('garbage.token.value')), 60);
  });

  it('health is never throttled', async () => {
    for (let i = 0; i < 8; i++) expect((await t.http().get('/api/health')).status).toBe(200);
  });

  it('/api/v1/* shares the counters of /api/* (same handler, same limit)', async () => {
    const u = await createUser(t.prisma, { nickname: 'verA' });
    const tok = tokenFor(t.jwt, u);
    expect((await t.http().get('/api/users/search?q=ve').set(bearer(tok))).status).toBe(200);
    expect((await t.http().get('/api/v1/users/search?q=ve').set(bearer(tok))).status).toBe(200);
    expect429(await t.http().get('/api/users/search?q=ve').set(bearer(tok)), 60);
  });

  it('login per nickname (case-insensitive)', async () => {
    await createUser(t.prisma, { nickname: 'nickA' });
    const login = (nickname: string) => t.http().post('/api/auth/login').send({ nickname, password: 'wrong' });
    expect((await login('nickA')).status).toBe(401);
    expect((await login('NICKA')).status).toBe(401);
    expect429(await login('nicka'), 3600);
    expect((await login('nickB')).status).toBe(401);
  });

  it('users/search', async () => {
    const u = await createUser(t.prisma, { nickname: 'searchA' });
    const tok = tokenFor(t.jwt, u);
    for (let i = 0; i < 2; i++) expect((await t.http().get('/api/users/search?q=se').set(bearer(tok))).status).toBe(200);
    expect429(await t.http().get('/api/users/search?q=se').set(bearer(tok)), 60);
  });

  it('users/me/avatar', async () => {
    const u = await createUser(t.prisma, { nickname: 'avatarA' });
    const tok = tokenFor(t.jwt, u);
    const up = () => t.http().post('/api/users/me/avatar').set(bearer(tok)).send({ dataUrl: TINY_PNG });
    try {
      expect((await up()).status).toBe(201);
      expect429(await up(), 3600);
    } finally {
      const { promises: fs } = await import('fs');
      const { join } = await import('path');
      await fs.rm(join(process.cwd(), 'uploads', 'avatars', `${u.id}.png`), { force: true });
    }
  });

  it('friends/request', async () => {
    const a = await createUser(t.prisma, { nickname: 'frA' });
    await createUser(t.prisma, { nickname: 'frB' });
    await createUser(t.prisma, { nickname: 'frC' });
    const tok = tokenFor(t.jwt, a);
    expect((await t.http().post('/api/friends/request').set(bearer(tok)).send({ nickname: 'frB' })).status).toBe(201);
    expect429(await t.http().post('/api/friends/request').set(bearer(tok)).send({ nickname: 'frC' }), 3600);
  });
});

describe('THROTTLE_ENABLED=false', () => {
  let t: Awaited<ReturnType<typeof bootWithEnv>>;
  beforeAll(async () => {
    t = await bootWithEnv({ THROTTLE_ENABLED: 'false', THROTTLE_LOGIN_IP_LIMIT: '1' });
    await resetDatabase(t.prisma, t.redis);
  });
  afterAll(async () => {
    await t?.close();
    t?.restoreEnv();
  });

  it('turns every limit off', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await t.http().post('/api/auth/login').send({ nickname: 'off', password: 'wrong' })).status).toBe(401);
    }
  });
});

describe('RedisThrottlerStorage on the test Redis', () => {
  let t: Awaited<ReturnType<typeof bootWithEnv>>;
  let storage: RedisThrottlerStorage;
  beforeAll(async () => {
    t = await bootWithEnv({});
    await resetDatabase(t.prisma, t.redis);
    storage = t.app.get(RedisThrottlerStorage);
  });
  afterAll(async () => {
    await t?.close();
    t?.restoreEnv();
  });

  it('fixed window, block after the limit, fresh window after the block, refunds never go negative', async () => {
    const key = 'throttle:test:window';
    const hit = () => storage.increment(key, 400, 2, 400);
    expect(await hit()).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(await hit()).toMatchObject({ totalHits: 2, isBlocked: false });
    const third = await hit();
    expect(third).toMatchObject({ isBlocked: true, timeToBlockExpire: 1 });
    expect((await hit()).isBlocked).toBe(true);
    expect(await t.redis.pttl(`${key}:block`)).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 450));
    expect(await hit()).toMatchObject({ totalHits: 1, isBlocked: false });
    await storage.refund(key);
    await storage.refund(key);
    expect(await t.redis.get(key)).toBe('0');
    // Every throttle key expires on its own.
    expect(await t.redis.pttl(key)).toBeGreaterThan(0);
  });
});
