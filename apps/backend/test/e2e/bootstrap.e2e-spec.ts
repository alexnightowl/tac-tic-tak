/**
 * B2 bootstrap hardening + B3 app-config / min-build gate.
 *
 * - /api/x (what the web calls) and /api/v1/x (mobile) hit the same handler
 * - GET /api/health, helmet headers, trust proxy, shutdown hooks
 * - Prisma P2025 → 404 (was an unhandled 500)
 * - JWT_SECRET fail-fast
 * - GET /api/v1/app-config from env, 426 only with X-App-Build below the minimum
 *
 * The web-contract golden (web-contract.e2e-spec.ts) proves the unversioned
 * paths still answer byte-for-byte as before; this file covers what is new.
 */
import { bootTestApp, bearer, TestApp } from '../helpers/app';
import { resetDatabase } from '../helpers/db';
import { createReviewItem, createUser, primeQueue, tokenFor, SeededUser } from '../helpers/seed';
import { createApp } from '../../src/app.setup';

const APP_CONFIG_ENV = {
  MIN_SUPPORTED_BUILD_IOS: '100',
  MIN_SUPPORTED_BUILD_ANDROID: '50',
  LATEST_BUILD_IOS: '120',
  LATEST_BUILD_ANDROID: '61',
  APP_STORE_URL: 'https://apps.apple.com/app/id000000000',
  PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=online.tactictak.app',
  FEATURE_FLAGS: 'pushOptIn,-newReview',
  MAINTENANCE_MESSAGE: '',
};

describe('bootstrap (B2) + app-config (B3)', () => {
  let t: TestApp;
  let user: SeededUser;
  let admin: SeededUser;
  let token: string;
  let adminToken: string;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const [k, v] of Object.entries(APP_CONFIG_ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    t = await bootTestApp();
    await resetDatabase(t.prisma, t.redis);
    user = await createUser(t.prisma, { nickname: 'boot_user' });
    admin = await createUser(t.prisma, { nickname: 'boot_admin', isAdmin: true });
    token = tokenFor(t.jwt, user);
    adminToken = tokenFor(t.jwt, admin);
    await createReviewItem(t.prisma, user.id, '00BJm');
  });

  afterAll(async () => {
    await t?.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  describe('URI versioning: /api/x and /api/v1/x are the same handler', () => {
    const authedGets = [
      '/auth/me',
      '/users/me',
      '/users/by-nickname/boot_user',
      '/users/search?q=boot',
      '/review',
      '/review/themes',
      '/analytics',
      '/analytics/timeline?days=30',
      '/achievements',
      '/leaderboard',
      '/friends',
      '/friends/pending',
    ];

    it.each(authedGets)('GET %s → 200 on both paths with identical bodies', async (path) => {
      const legacy = await t.http().get(`/api${path}`).set(bearer(token));
      const v1 = await t.http().get(`/api/v1${path}`).set(bearer(token));
      expect(legacy.status).toBe(200);
      expect(v1.status).toBe(200);
      expect(v1.body).toEqual(legacy.body);
    });

    it('admin routes work on both paths (web admin keeps the unversioned path)', async () => {
      for (const prefix of ['/api', '/api/v1']) {
        const res = await t.http().get(`${prefix}/admin/users`).set(bearer(adminToken));
        expect(res.status).toBe(200);
      }
    });

    it('POST /auth/login → 201 {token, user} on both paths', async () => {
      for (const prefix of ['/api', '/api/v1']) {
        const res = await t.http().post(`${prefix}/auth/login`).send({ nickname: user.nickname, password: user.password });
        expect(res.status).toBe(201);
        expect(Object.keys(res.body).sort()).toEqual(['token', 'user']);
      }
    });

    it('a full session round-trip works on /api/v1 (create → next → attempt → finish)', async () => {
      const created = await t.http().post('/api/v1/sessions').set(bearer(token))
        .send({ startRating: 1200, durationSec: 60, mode: 'mixed', style: 'blitz' });
      expect(created.status).toBe(201);
      const sid = created.body.sessionId;
      expect(typeof sid).toBe('string');
      await primeQueue(t.redis, sid, ['004Lu', '00BJm']);
      const next = await t.http().post(`/api/v1/sessions/${sid}/next`).set(bearer(token));
      expect(next.status).toBe(201);
      const attempt = await t.http().post(`/api/v1/sessions/${sid}/attempt`).set(bearer(token))
        .send({ puzzleId: next.body.puzzle.id, correct: true, responseMs: 4000 });
      expect(attempt.status).toBe(201);
      const finish = await t.http().post(`/api/v1/sessions/${sid}/finish?save=false`).set(bearer(token));
      expect(finish.status).toBe(201);
    });

    it('validation and auth errors are identical on both paths', async () => {
      const bad = { startRating: 1, durationSec: 1, mode: 'x', style: 'y' };
      const a = await t.http().post('/api/sessions').set(bearer(token)).send(bad);
      const b = await t.http().post('/api/v1/sessions').set(bearer(token)).send(bad);
      expect(a.status).toBe(400);
      expect(b.status).toBe(400);
      expect(b.body).toEqual(a.body);
      const u1 = await t.http().get('/api/users/me');
      const u2 = await t.http().get('/api/v1/users/me');
      expect(u1.status).toBe(401);
      expect(u2.body).toEqual(u1.body);
    });

    it('unknown versions and unknown routes are 404 with the default Nest message', async () => {
      const v2 = await t.http().get('/api/v2/users/me').set(bearer(token));
      expect(v2.status).toBe(404);
      const nope = await t.http().get('/api/nope');
      expect(nope.status).toBe(404);
      expect(nope.body).toEqual({ statusCode: 404, message: 'Cannot GET /api/nope', error: 'Not Found' });
    });
  });

  describe('GET /api/health', () => {
    it.each(['/api/health', '/api/v1/health'])('%s → 200 {status, db, redis}, no auth', async (path) => {
      const res = await t.http().get(path);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', db: 'up', redis: 'up' });
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('hardening', () => {
    it('helmet headers are set; HSTS is left to nginx; CORP allows cross-origin avatars', async () => {
      const res = await t.http().get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['strict-transport-security']).toBeUndefined();
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it("trust proxy is 1 (nginx is the single hop), so req.ip is the client's address", () => {
      const express = t.app.getHttpAdapter().getInstance();
      expect(express.get('trust proxy')).toBe(1);
    });

    it('shutdown hooks are registered and released on close', async () => {
      const before = process.listenerCount('SIGTERM');
      const app = await createApp({ logger: false });
      await app.init();
      expect(process.listenerCount('SIGTERM')).toBe(before + 1);
      await app.close();
      expect(process.listenerCount('SIGTERM')).toBe(before);
    });
  });

  describe('Prisma P2025 → 404', () => {
    it.each(['/api', '/api/v1'])('%s/review/:id/resolve for a puzzle not in the queue → 404 (was 500)', async (prefix) => {
      const res = await t.http().post(`${prefix}/review/004Lu/resolve`).set(bearer(token));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ statusCode: 404, message: 'not found', error: 'Not Found' });
    });

    it('resolving a queued item still returns {ok:true}', async () => {
      const res = await t.http().post('/api/review/00BJm/resolve').set(bearer(token));
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('JWT_SECRET fail-fast', () => {
    it.each([undefined, '', '   '])('createApp() refuses to boot with JWT_SECRET=%p', async (value) => {
      const prev = process.env.JWT_SECRET;
      if (value === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = value;
      try {
        await expect(createApp({ logger: false })).rejects.toThrow(/JWT_SECRET is not set/);
      } finally {
        process.env.JWT_SECRET = prev;
      }
    });
  });

  describe('GET /api/v1/app-config', () => {
    const expected = {
      minSupportedBuild: { ios: 100, android: 50 },
      latestBuild: { ios: 120, android: 61 },
      storeUrls: {
        ios: 'https://apps.apple.com/app/id000000000',
        android: 'https://play.google.com/store/apps/details?id=online.tactictak.app',
      },
      featureFlags: { pushOptIn: true, newReview: false },
      maintenance: null,
    };

    it('returns the env-derived config, public, no-store', async () => {
      const res = await t.http().get('/api/v1/app-config');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual(expected);
    });

    it('is reachable by an outdated build (exempt from the 426 gate)', async () => {
      for (const path of ['/api/v1/app-config', '/api/app-config', '/api/v1/health', '/api/health']) {
        const res = await t.http().get(path).set({ 'X-App-Build': '1', 'X-Platform': 'ios' });
        expect(res.status).toBe(200);
      }
    });
  });

  describe('426 min-build gate', () => {
    const me = (prefix: string, headers: Record<string, string>) =>
      t.http().get(`${prefix}/users/me`).set(bearer(token)).set(headers);

    it.each([
      ['no X-App-Build header (the web)', {}, 200],
      ['ios build below the minimum', { 'X-App-Build': '99', 'X-Platform': 'ios' }, 426],
      ['ios build at the minimum', { 'X-App-Build': '100', 'X-Platform': 'ios' }, 200],
      ['ios build above the minimum', { 'X-App-Build': '101', 'X-Platform': 'ios' }, 200],
      ['android build below the minimum', { 'X-App-Build': '49', 'X-Platform': 'android' }, 426],
      ['android build that only passes the android minimum', { 'X-App-Build': '60', 'X-Platform': 'android' }, 200],
      ['platform header case-insensitive', { 'X-App-Build': '99', 'X-Platform': 'iOS' }, 426],
      ['build without X-Platform', { 'X-App-Build': '1' }, 200],
      ['unknown platform', { 'X-App-Build': '1', 'X-Platform': 'web' }, 200],
      ['malformed build', { 'X-App-Build': '1.2.3', 'X-Platform': 'ios' }, 200],
      ['only X-Platform / X-App-Version', { 'X-Platform': 'ios', 'X-App-Version': '0.0.1' }, 200],
    ] as const)('%s → %i', async (_label, headers, status) => {
      for (const prefix of ['/api', '/api/v1']) {
        const res = await me(prefix, headers);
        expect(res.status).toBe(status);
      }
    });

    it('426 body carries the minimum and the store link, before auth runs', async () => {
      const res = await t.http().post('/api/v1/auth/login')
        .set({ 'X-App-Build': '10', 'X-Platform': 'android' })
        .send({ nickname: user.nickname, password: 'wrong' });
      expect(res.status).toBe(426);
      expect(res.body).toEqual({
        statusCode: 426,
        message: 'app update required',
        error: 'Upgrade Required',
        minSupportedBuild: 50,
        storeUrl: 'https://play.google.com/store/apps/details?id=online.tactictak.app',
      });
    });

    it('CORS preflight is never gated', async () => {
      const res = await t.http().options('/api/users/me')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('X-App-Build', '1')
        .set('X-Platform', 'ios');
      expect(res.status).toBe(204);
    });

    it('static uploads are never gated', async () => {
      const res = await t.http().get('/uploads/avatars/missing.png').set({ 'X-App-Build': '1', 'X-Platform': 'ios' });
      expect(res.status).toBe(404);
    });
  });
});

describe('app-config defaults (no env)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootTestApp();
  });
  afterAll(async () => {
    await t?.close();
  });

  it('GET /api/v1/app-config → zero minimums, nulls, no flags, no maintenance', async () => {
    const res = await t.http().get('/api/v1/app-config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      minSupportedBuild: { ios: 0, android: 0 },
      latestBuild: { ios: null, android: null },
      storeUrls: { ios: null, android: null },
      featureFlags: {},
      maintenance: null,
    });
  });

  it('with no minimum configured, even build 0 passes', async () => {
    const res = await t.http().get('/api/v1/health').set({ 'X-App-Build': '0', 'X-Platform': 'ios' });
    expect(res.status).toBe(200);
    const login = await t.http().post('/api/v1/auth/login').set({ 'X-App-Build': '0', 'X-Platform': 'ios' })
      .send({ nickname: 'nobody', password: 'x' });
    expect(login.status).not.toBe(426);
  });
});
