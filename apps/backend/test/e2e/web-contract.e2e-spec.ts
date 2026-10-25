/**
 * WEB-CONTRACT GOLDEN TEST.
 *
 * Replays every request shape apps/frontend sends (test/contract/
 * web-scenario.ts) against the real AppModule and freezes status codes,
 * response shapes (keys + value kinds) and error messages in
 * __snapshots__/web-contract.e2e-spec.ts.snap.
 *
 * Every backend PR must keep this green. A diff here means the live web
 * sees something different: only additive changes are allowed, and the
 * snapshot may only be updated (`-u`) for a deliberate, documented
 * exception (e.g. B5's 401 → 403 on change-password). New response
 * fields show up as added keys; review them, then update.
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { bootTestApp, bearer, TestApp } from '../helpers/app';
import { resetDatabase } from '../helpers/db';
import { backdateSession, primeQueue } from '../helpers/seed';
import { runWebScenario, ScenarioResult } from '../contract/web-scenario';
import { supertestTransport } from '../contract/supertest-transport';
import { keysOf } from '../helpers/shape';

// Ratings around the 1200 entry level, fixed order → deterministic analytics/review data.
const FORK_QUEUE = ['zzoM1', 'zziK6', 'zzYOH', 'zzwh6', '00BJm', '005nD', '00Aas', 'zzoM1', 'zziK6', 'zzYOH', 'zzwh6', '00BJm'];
const QUEUE = ['004Lu', '00BJm', '00ICz', '00AB1', '00LPw', '0040n', '00u3h', '00cy1', 'zzoM1', '009J1', '00Tya', '01485'];

function decodeJwt(token: string) {
  const [h, p] = token.split('.');
  const dec = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
  return { header: dec(h), payload: dec(p) };
}

describe('web contract (golden)', () => {
  let t: TestApp;
  let result: ScenarioResult;

  beforeAll(async () => {
    t = await bootTestApp();
    await resetDatabase(t.prisma, t.redis);
    result = await runWebScenario(supertestTransport(t), {
      primeQueue: (sid, kind) => primeQueue(t.redis, sid, kind === 'fork' ? FORK_QUEUE : QUEUE),
      backdateSession: (sid, s) => backdateSession(t.prisma, sid, s),
      makeAdmin: async (id) => { await t.prisma.user.update({ where: { id }, data: { isAdmin: true } }); },
    });
  });

  afterAll(async () => {
    // The avatar step writes uploads/avatars/<id>.png under the cwd; remove it.
    for (const u of [result?.ctx.userA, result?.ctx.userB]) {
      if (!u) continue;
      for (const ext of ['png', 'jpg', 'webp']) {
        await fs.rm(join(process.cwd(), 'uploads', 'avatars', `${u.id}.${ext}`), { force: true });
      }
    }
    await t?.close();
  });

  it('replays every web request with the frozen status codes and response shapes', () => {
    expect(result.steps.filter((s) => s.status === 'skipped')).toEqual([]);
    expect(result.steps).toMatchSnapshot();
  });

  it('register/login return exactly {token, user:{id, nickname}} and a 7-day HS256 JWT', async () => {
    const res = await t.http()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ nickname: result.ctx.userA!.nickname, password: 'Passw0rd2' });
    expect(res.status).toBe(201);
    expect(keysOf(res.body)).toEqual(['token', 'user']);
    expect(keysOf(res.body.user)).toEqual(['id', 'nickname']);
    const { header, payload } = decodeJwt(res.body.token);
    expect(header.alg).toBe('HS256');
    expect(keysOf(payload)).toEqual(['exp', 'iat', 'nickname', 'sub']);
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
    expect(payload.sub).toBe(result.ctx.userA!.id);
  });

  it('web-only request extras are ignored (whitelist strips unknown fields, no 400)', async () => {
    const res = await t.http()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ nickname: result.ctx.userA!.nickname, password: 'Passw0rd2', somethingElse: 1 });
    expect(res.status).toBe(201);
  });

  it('serves uploaded avatars statically outside the /api prefix', async () => {
    const me = await t.http().get('/api/users/me').set(bearer(result.ctx.userA!.token));
    // reset-progress keeps the avatar; the URL is cache-busted with ?v=
    expect(me.body.avatarUrl).toMatch(/^\/uploads\/avatars\/.+\.png\?v=\d+$/);
    const file = await t.http().get(me.body.avatarUrl);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/image\/png/);
  });

  it('CORS stays open (web is served from another origin in dev)', async () => {
    const res = await t.http().options('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
