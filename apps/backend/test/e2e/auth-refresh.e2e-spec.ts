/**
 * B4 (refresh tokens, tokenVersion) and B5 (change-password 403 + family
 * revocation). PLAN §5 Phase 3 exit criteria covered here:
 *   - web login keys and 7 d exp unchanged (also frozen in web-contract)
 *   - mobile login returns refreshToken
 *   - refresh rotates, and reusing an old token revokes the family
 *   - a tv bump invalidates access tokens
 *   - a wrong current password on change-password gets 403
 */
import { createHash } from 'crypto';
import { bootTestApp, bearer, TestApp } from '../helpers/app';
import { resetDatabase } from '../helpers/db';
import { createUser, DEFAULT_PASSWORD, SeededUser } from '../helpers/seed';
import { keysOf } from '../helpers/shape';
import { tokenVersionKey } from '../../src/auth/token-version.service';

const DAY = 24 * 60 * 60;

function jwtPayload(token: string): Record<string, unknown> & { exp: number; iat: number } {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('auth refresh (B4) and change-password (B5)', () => {
  let t: TestApp;
  let n = 0;

  beforeAll(async () => {
    t = await bootTestApp();
    await resetDatabase(t.prisma, t.redis);
  });
  afterAll(async () => {
    await t?.close();
  });

  const newUser = (): Promise<SeededUser> => createUser(t.prisma, { nickname: `auth_${++n}` });

  const login = (u: SeededUser, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
    t.http().post('/api/auth/login').set(headers).send({ nickname: u.nickname, password: u.password, ...extra });

  const mobileLogin = async (u: SeededUser, deviceId?: string) => {
    const res = await login(u, { client: 'mobile', ...(deviceId ? { deviceId } : {}) });
    expect(res.status).toBe(201);
    return res.body as { token: string; refreshToken: string; expiresIn: number; user: { id: string; nickname: string } };
  };

  const refresh = (refreshToken: unknown) => t.http().post('/api/auth/refresh').send({ refreshToken });
  const me = (token: string) => t.http().get('/api/users/me').set(bearer(token));

  describe('web path is unchanged', () => {
    it('login without client: exactly {token, user}, 7-day JWT {sub, nickname}, no refresh row', async () => {
      const u = await newUser();
      for (const extra of [{}, { client: 'web' }]) {
        const res = await login(u, extra);
        expect(res.status).toBe(201);
        expect(keysOf(res.body)).toEqual(['token', 'user']);
        expect(res.body.user).toEqual({ id: u.id, nickname: u.nickname });
        const p = jwtPayload(res.body.token);
        expect(keysOf(p)).toEqual(['exp', 'iat', 'nickname', 'sub']);
        expect(p.exp - p.iat).toBe(7 * DAY);
      }
      // deviceId/platform without client:'mobile' change nothing either.
      const res = await login(u, { deviceId: 'dev-x', platform: 'ios' }, { 'X-Device-Id': 'dev-x', 'X-Platform': 'ios' });
      expect(keysOf(res.body)).toEqual(['token', 'user']);
      expect(await t.prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);
    });

    it('register without client: exactly {token, user} and a 7-day token', async () => {
      const res = await t.http().post('/api/auth/register').send({
        nickname: `auth_reg_${++n}`, password: DEFAULT_PASSWORD, repeatPassword: DEFAULT_PASSWORD,
      });
      expect(res.status).toBe(201);
      expect(keysOf(res.body)).toEqual(['token', 'user']);
      const p = jwtPayload(res.body.token);
      expect(p.exp - p.iat).toBe(7 * DAY);
      expect(await t.prisma.refreshToken.count({ where: { userId: res.body.user.id } })).toBe(0);
    });

    it('/auth/me returns exactly {id, nickname} for web and mobile tokens', async () => {
      const u = await newUser();
      const web = (await login(u)).body.token as string;
      const mobile = (await mobileLogin(u)).token;
      for (const token of [web, mobile]) {
        const res = await t.http().get('/api/auth/me').set(bearer(token));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: u.id, nickname: u.nickname });
      }
    });

    it('rejects an unknown client value and an oversized deviceId (new optional fields only)', async () => {
      const u = await newUser();
      expect((await login(u, { client: 'desktop' })).status).toBe(400);
      expect((await login(u, { client: 'mobile', deviceId: 'x'.repeat(129) })).status).toBe(400);
      expect((await login(u, { client: 'mobile', platform: 'windows' })).status).toBe(400);
    });
  });

  describe('mobile login / register', () => {
    it('login with client:mobile returns {token, refreshToken, expiresIn, user} and a 30-min tv token', async () => {
      const u = await newUser();
      const res = await login(u, { client: 'mobile', deviceId: 'device-A', platform: 'ios' });
      expect(res.status).toBe(201);
      expect(keysOf(res.body)).toEqual(['expiresIn', 'refreshToken', 'token', 'user']);
      expect(res.body.user).toEqual({ id: u.id, nickname: u.nickname });
      expect(res.body.expiresIn).toBe(30 * 60);
      expect(res.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/); // 256 bits, base64url

      const p = jwtPayload(res.body.token);
      expect(keysOf(p)).toEqual(['exp', 'fid', 'iat', 'nickname', 'sub', 'tv']);
      expect(p.exp - p.iat).toBe(30 * 60);
      expect(p.tv).toBe(0);
      expect(p.sub).toBe(u.id);

      const rows = await t.prisma.refreshToken.findMany({ where: { userId: u.id } });
      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect(row.tokenHash).toBe(sha256(res.body.refreshToken)); // only the hash is stored
      expect(row.tokenHash).not.toContain(res.body.refreshToken);
      expect(row.familyId).toBe(p.fid);
      expect(row.deviceId).toBe('device-A');
      expect(row.platform).toBe('ios');
      expect(row.revokedAt).toBeNull();
      const ttlDays = (row.expiresAt.getTime() - row.createdAt.getTime()) / (DAY * 1000);
      expect(ttlDays).toBeCloseTo(90, 5);

      expect((await me(res.body.token)).status).toBe(200);
    });

    it('register with client:mobile returns a refresh token; deviceId/platform fall back to X-Device-Id / X-Platform', async () => {
      const nickname = `auth_mreg_${++n}`;
      const res = await t.http().post('/api/auth/register')
        .set({ 'X-Device-Id': 'hdr-device', 'X-Platform': 'Android' })
        .send({ nickname, password: DEFAULT_PASSWORD, repeatPassword: DEFAULT_PASSWORD, client: 'mobile' });
      expect(res.status).toBe(201);
      expect(keysOf(res.body)).toEqual(['expiresIn', 'refreshToken', 'token', 'user']);
      const row = await t.prisma.refreshToken.findFirstOrThrow({ where: { userId: res.body.user.id } });
      expect(row.deviceId).toBe('hdr-device');
      expect(row.platform).toBe('android');
    });

    it('a re-login on the same deviceId revokes that device\'s previous family only', async () => {
      const u = await newUser();
      const a1 = await mobileLogin(u, 'dev-1');
      const b = await mobileLogin(u, 'dev-2');
      const a2 = await mobileLogin(u, 'dev-1');
      expect((await refresh(a1.refreshToken)).status).toBe(401);
      expect((await refresh(b.refreshToken)).status).toBe(201);
      expect((await refresh(a2.refreshToken)).status).toBe(201);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates: new pair, old row revoked and linked, same family, sliding expiry', async () => {
      const u = await newUser();
      const first = await mobileLogin(u, 'dev-rot');
      const before = await t.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: sha256(first.refreshToken) } });

      const res = await refresh(first.refreshToken);
      expect(res.status).toBe(201);
      expect(keysOf(res.body)).toEqual(['expiresIn', 'refreshToken', 'token', 'user']);
      expect(res.body.user).toEqual({ id: u.id, nickname: u.nickname });
      expect(res.body.refreshToken).not.toBe(first.refreshToken);
      expect(res.body.expiresIn).toBe(30 * 60);
      expect((await me(res.body.token)).status).toBe(200);

      const old = await t.prisma.refreshToken.findUniqueOrThrow({ where: { id: before.id } });
      const next = await t.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: sha256(res.body.refreshToken) } });
      expect(old.revokedAt).not.toBeNull();
      expect(old.replacedById).toBe(next.id);
      expect(next.familyId).toBe(before.familyId);
      expect(next.deviceId).toBe('dev-rot');
      expect(next.revokedAt).toBeNull();
      expect(next.expiresAt.getTime()).toBeGreaterThanOrEqual(before.expiresAt.getTime());
      expect(jwtPayload(res.body.token).fid).toBe(before.familyId);

      // and it keeps rotating
      const third = await refresh(res.body.refreshToken);
      expect(third.status).toBe(201);
    });

    it('reusing a rotated token revokes the whole family (theft detection); other devices survive', async () => {
      const u = await newUser();
      const a = await mobileLogin(u, 'victim');
      const other = await mobileLogin(u, 'other-device');
      const r1 = await refresh(a.refreshToken);
      expect(r1.status).toBe(201);

      const reuse = await refresh(a.refreshToken);
      expect(reuse.status).toBe(401);
      expect(reuse.body.message).toBe('invalid refresh token');

      // the legitimate successor is dead too
      expect((await refresh(r1.body.refreshToken)).status).toBe(401);
      const fid = jwtPayload(a.token).fid as string;
      const live = await t.prisma.refreshToken.count({ where: { familyId: fid, revokedAt: null } });
      expect(live).toBe(0);

      expect((await refresh(other.refreshToken)).status).toBe(201);
    });

    it('two concurrent refreshes with one token: one wins, the loser counts as reuse', async () => {
      const u = await newUser();
      const a = await mobileLogin(u, 'racer');
      const [x, y] = await Promise.all([refresh(a.refreshToken), refresh(a.refreshToken)]);
      expect([x.status, y.status].sort()).toEqual([201, 401]);
      const winner = x.status === 201 ? x : y;
      expect((await refresh(winner.body.refreshToken)).status).toBe(401);
    });

    it('rejects unknown, expired and malformed tokens', async () => {
      const u = await newUser();
      expect((await refresh('not-a-real-token')).status).toBe(401);
      expect((await refresh('')).status).toBe(400);
      expect((await t.http().post('/api/auth/refresh').send({})).status).toBe(400);
      expect((await refresh(123)).status).toBe(400);

      const a = await mobileLogin(u);
      await t.prisma.refreshToken.update({
        where: { tokenHash: sha256(a.refreshToken) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await refresh(a.refreshToken);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('invalid refresh token');
    });

    it('prunes rows revoked more than 30 days ago from the family on rotation', async () => {
      const u = await newUser();
      const a = await mobileLogin(u, 'pruner');
      const r1 = await refresh(a.refreshToken);
      const old = await t.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: sha256(a.refreshToken) } });
      await t.prisma.refreshToken.update({ where: { id: old.id }, data: { revokedAt: new Date(Date.now() - 31 * DAY * 1000) } });
      expect((await refresh(r1.body.refreshToken)).status).toBe(201);
      expect(await t.prisma.refreshToken.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await t.prisma.refreshToken.count({ where: { familyId: old.familyId } })).toBe(2);
    });

    it('a deleted user\'s refresh tokens are gone with the user (FK cascade)', async () => {
      const u = await newUser();
      const a = await mobileLogin(u);
      await t.prisma.user.delete({ where: { id: u.id } });
      expect(await t.prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);
      expect((await refresh(a.refreshToken)).status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes this device\'s family only and is idempotent', async () => {
      const u = await newUser();
      const a = await mobileLogin(u, 'dev-a');
      const b = await mobileLogin(u, 'dev-b');
      const res = await t.http().post('/api/auth/logout').send({ refreshToken: a.refreshToken });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
      expect((await refresh(a.refreshToken)).status).toBe(401);
      expect((await refresh(b.refreshToken)).status).toBe(201);

      expect((await t.http().post('/api/auth/logout').send({ refreshToken: a.refreshToken })).body).toEqual({ ok: true });
      expect((await t.http().post('/api/auth/logout').send({ refreshToken: 'unknown' })).body).toEqual({ ok: true });
      expect((await t.http().post('/api/auth/logout').send({})).status).toBe(400);
    });
  });

  describe('tokenVersion (tv)', () => {
    it('logout-all bumps tv: every earlier access token (web and mobile) and refresh token stops working', async () => {
      const u = await newUser();
      const web = (await login(u)).body.token as string;
      const m1 = await mobileLogin(u, 'd1');
      const m2 = await mobileLogin(u, 'd2');
      expect((await me(web)).status).toBe(200);
      expect((await me(m1.token)).status).toBe(200);

      expect((await t.http().post('/api/auth/logout-all')).status).toBe(401);
      const res = await t.http().post('/api/auth/logout-all').set(bearer(m1.token));
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });

      const row = await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(row.tokenVersion).toBe(1);
      for (const token of [web, m1.token, m2.token]) {
        const r = await me(token);
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ statusCode: 401, message: 'Unauthorized' }); // same body as an expired token
      }
      expect((await refresh(m1.refreshToken)).status).toBe(401);
      expect((await refresh(m2.refreshToken)).status).toBe(401);

      // Fresh logins work again: web keeps {token, user} and its token now carries tv.
      const web2 = await login(u);
      expect(keysOf(web2.body)).toEqual(['token', 'user']);
      expect(jwtPayload(web2.body.token).tv).toBe(1);
      expect((await me(web2.body.token)).status).toBe(200);
      const m3 = await mobileLogin(u, 'd1');
      expect(jwtPayload(m3.token).tv).toBe(1);
      expect((await me(m3.token)).status).toBe(200);
      const m3r = await refresh(m3.refreshToken);
      expect(jwtPayload(m3r.body.token).tv).toBe(1);
      expect((await me(m3r.body.token)).status).toBe(200);
    });

    it('a tv bump in the DB invalidates access tokens once the 60 s cache lapses; missing tv counts as 0', async () => {
      const u = await newUser();
      const web = (await login(u)).body.token as string;
      const mobile = (await mobileLogin(u)).token;
      expect((await me(mobile)).status).toBe(200); // primes the cache
      const ttl = await t.redis.ttl(tokenVersionKey(u.id));
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);

      await t.prisma.user.update({ where: { id: u.id }, data: { tokenVersion: { increment: 1 } } });
      expect((await me(mobile)).status).toBe(200); // cached for up to 60 s by design
      await t.redis.del(tokenVersionKey(u.id)); // = the cache entry expiring
      expect((await me(mobile)).status).toBe(401);
      expect((await me(web)).status).toBe(401);
    });

    it('a token whose user row is gone still reaches the handler (frozen web quirk: 404 on /users/me)', async () => {
      const u = await newUser();
      const web = (await login(u)).body.token as string;
      await t.prisma.user.delete({ where: { id: u.id } });
      expect((await me(web)).status).toBe(404);
      // logout-all answers like change-password (401), not a P2025 500.
      const res = await t.http().post('/api/auth/logout-all').set(bearer(web));
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('not authenticated');
    });
  });

  describe('change-password (B5)', () => {
    const change = (token: string, currentPassword: string, newPassword: string) =>
      t.http().post('/api/auth/change-password').set(bearer(token)).send({ currentPassword, newPassword });

    it('a wrong current password is 403 for every client and revokes nothing', async () => {
      const u = await newUser();
      const web = (await login(u)).body.token as string;
      const m = await mobileLogin(u, 'cp-0');
      for (const token of [web, m.token]) {
        const res = await change(token, 'wrong-pass1', 'NewPassw0rd');
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ statusCode: 403, message: 'current password is incorrect', error: 'Forbidden' });
      }
      expect((await me(web)).status).toBe(200);
      expect((await refresh(m.refreshToken)).status).toBe(201);
    });

    it('success from a mobile device keeps its own family and revokes the others; no tv bump', async () => {
      const u = await newUser();
      const web = (await login(u)).body.token as string;
      const a = await mobileLogin(u, 'cp-a');
      const b = await mobileLogin(u, 'cp-b');
      const res = await change(a.token, u.password, 'NewPassw0rd');
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });

      expect((await refresh(a.refreshToken)).status).toBe(201);
      expect((await refresh(b.refreshToken)).status).toBe(401);
      // Access tokens are not invalidated while the web is alive (B18 adds the bump).
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).tokenVersion).toBe(0);
      expect((await me(web)).status).toBe(200);
      expect((await me(b.token)).status).toBe(200);
    });

    it('success from the web revokes every refresh family', async () => {
      const u = await newUser();
      const web = (await login(u)).body.token as string;
      const a = await mobileLogin(u, 'cp-c');
      expect((await change(web, u.password, 'NewPassw0rd')).status).toBe(201);
      expect((await refresh(a.refreshToken)).status).toBe(401);
      expect((await me(web)).status).toBe(200);
    });
  });
});

describe('auth refresh env overrides (ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS)', () => {
  let t: TestApp;
  const saved = { a: process.env.ACCESS_TOKEN_TTL, r: process.env.REFRESH_TOKEN_TTL_DAYS };

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_TTL = '5m';
    process.env.REFRESH_TOKEN_TTL_DAYS = '7';
    t = await bootTestApp();
  });
  afterAll(async () => {
    await t?.close();
    for (const [k, v] of [['ACCESS_TOKEN_TTL', saved.a], ['REFRESH_TOKEN_TTL_DAYS', saved.r]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('mobile tokens follow the env; the web token stays 7 days', async () => {
    const u = await createUser(t.prisma, { nickname: 'auth_env_1' });
    const m = await t.http().post('/api/auth/login').send({ nickname: u.nickname, password: u.password, client: 'mobile' });
    expect(m.body.expiresIn).toBe(300);
    const p = jwtPayload(m.body.token);
    expect(p.exp - p.iat).toBe(300);
    const row = await t.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: sha256(m.body.refreshToken) } });
    expect((row.expiresAt.getTime() - row.createdAt.getTime()) / (DAY * 1000)).toBeCloseTo(7, 5);

    const web = await t.http().post('/api/auth/login').send({ nickname: u.nickname, password: u.password });
    const w = jwtPayload(web.body.token);
    expect(w.exp - w.iat).toBe(7 * DAY);
  });
});
