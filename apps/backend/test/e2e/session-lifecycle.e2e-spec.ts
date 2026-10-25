/**
 * B6 session lifecycle: idempotent attempts (clientAttemptId), includeNext,
 * /next requestId replay, serverNow, GET /sessions/active, finish tz +
 * progression, Redis key hygiene (TTL, recent-trim, DELETE clears buffer).
 *
 * Everything here is opt-in through new optional fields; the web sends
 * none of them. The web contract golden and the rating transcript prove
 * the web path is unchanged; the last test here proves a mobile-style
 * session steps the rating exactly like a web-style one.
 */
import { randomUUID } from 'crypto';
import { bootTestApp, bearer, sleep, TestApp } from '../helpers/app';
import { resetDatabase } from '../helpers/db';
import { backdateSession, createUser, primeQueue, tokenFor } from '../helpers/seed';
import { localDayInZone } from '../../src/sessions/timezone';
import type { TrainingStyle } from '../../src/sessions/unlock';

// 20 fixture puzzles: deep enough that no background refill kicks in, so
// queue lengths are exact.
const QUEUE = [
  '004Lu', '00ICz', '003S3', '00LPw', '009FP', '00u3h', '004mT', '00cy1', '0040n', '009J1',
  '00BCa', '00Bul', '00Tya', '00Af3', '00OCQ', '014p4', '01485', '008tL', '007eS', 'zziK6',
];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('session lifecycle (B6)', () => {
  let t: TestApp;
  let n = 0;

  beforeAll(async () => {
    t = await bootTestApp();
    await resetDatabase(t.prisma, t.redis);
  });
  afterAll(async () => { await t?.close(); });

  async function newUser(styles: Parameters<typeof createUser>[1]['styles'] = { blitz: { calibrationSessionsLeft: 0 } }) {
    n += 1;
    const u = await createUser(t.prisma, { nickname: `lc_${n}`, styles });
    return { ...u, token: tokenFor(t.jwt, u), auth: bearer(tokenFor(t.jwt, u)) };
  }
  type U = Awaited<ReturnType<typeof newUser>>;

  async function createSession(u: U, extra: Record<string, unknown> = {}, style: TrainingStyle = 'blitz') {
    const res = await t.http().post('/api/sessions').set(u.auth)
      .send({ startRating: 1200, durationSec: 300, mode: 'mixed', style, ...extra });
    expect(res.status).toBe(201);
    const sid = res.body.sessionId as string;
    await primeQueue(t.redis, sid, QUEUE);
    return { sid, body: res.body };
  }

  const queueLen = (sid: string) => t.redis.llen(`session:${sid}:queue`);
  const rating = async (userId: string, style: TrainingStyle = 'blitz') =>
    (await t.prisma.userStyleProgression.findUniqueOrThrow({ where: { userId_style: { userId, style } } })).currentPuzzleRating;

  describe('POST /sessions/:id/attempt with clientAttemptId', () => {
    it('x5 concurrent + a later replay: exactly 1 row, one rating step, byte-identical bodies (next included)', async () => {
      const u = await newUser();
      const { sid } = await createSession(u, { client: 'mobile' });
      const first = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth).send({ requestId: randomUUID(), client: 'mobile' });
      expect(first.status).toBe(201);
      const before = await rating(u.id);
      const lenBefore = await queueLen(sid);

      const cid = randomUUID();
      const body = { puzzleId: first.body.puzzle.id, correct: true, responseMs: 3000, clientAttemptId: cid, includeNext: true, client: 'mobile' };
      const burst = await Promise.all(
        Array.from({ length: 5 }, () => t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send(body)),
      );
      await sleep(20);
      const later = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send(body);
      const all = [...burst, later];

      for (const r of all) expect(r.status).toBe(201);
      const texts = new Set(all.map((r) => r.text));
      expect(texts.size).toBe(1);

      // psql-equivalent checks: one row with that key, one attempt in the session.
      const rows = await t.prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "TrainingAttempt" WHERE "clientAttemptId" = $1`, cid,
      );
      expect(Number(rows[0].n)).toBe(1);
      expect(await t.prisma.trainingAttempt.count({ where: { sessionId: sid } })).toBe(1);

      // One rating step.
      const res = burst[0].body;
      expect(res.step).not.toBe(0);
      expect(res.newRating).toBe(before + res.step);
      expect(await rating(u.id)).toBe(res.newRating);
      expect(res.streak).toBe(1);

      // `next` popped once and is the following queued puzzle.
      expect(await queueLen(sid)).toBe(lenBefore - 1);
      expect(res.next.puzzle.id).not.toBe(first.body.puzzle.id);
      expect(res.next.currentRating).toBe(res.newRating);
      expect(res.next.serverNow).toMatch(ISO);
      expect(Object.keys(res)).toEqual(['newRating', 'step', 'streak', 'next']);

      // The replay still answers after the session is finished.
      const fin = await t.http().post(`/api/sessions/${sid}/finish?localDate=2026-10-20`).set(u.auth);
      expect(fin.status).toBe(201);
      const afterFinish = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send(body);
      expect(afterFinish.status).toBe(201);
      expect(afterFinish.text).toBe(burst[0].text);
      // A new key on the finished session is still refused like the web.
      const fresh = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send({ ...body, clientAttemptId: randomUUID() });
      expect(fresh.status).toBe(400);
      expect(fresh.body.message).toBe('session ended');
    });

    it('without includeNext returns exactly the web keys', async () => {
      const u = await newUser();
      const { sid } = await createSession(u);
      const nx = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
      const r = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth)
        .send({ puzzleId: nx.body.puzzle.id, correct: false, responseMs: 5000, clientAttemptId: randomUUID() });
      expect(r.status).toBe(201);
      expect(Object.keys(r.body)).toEqual(['newRating', 'step', 'streak']);
    });

    it('cache lost (Redis flushed or > 24 h): no second row, no second step', async () => {
      const u = await newUser();
      const { sid } = await createSession(u);
      const nx = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
      const cid = randomUUID();
      const body = { puzzleId: nx.body.puzzle.id, correct: true, responseMs: 2500, clientAttemptId: cid };
      const r1 = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send(body);
      expect(r1.status).toBe(201);
      const after1 = await rating(u.id);
      await t.redis.del(`session:${sid}:attempt:${cid}`);
      const r2 = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send(body);
      expect(r2.status).toBe(201);
      expect(r2.body).toEqual({ newRating: after1, step: 0, streak: 1 });
      expect(await rating(u.id)).toBe(after1);
      expect(await t.prisma.trainingAttempt.count({ where: { clientAttemptId: cid } })).toBe(1);
    });

    it('a clientAttemptId already used on another session is a 409', async () => {
      const u = await newUser();
      const a = await createSession(u);
      const nx = await t.http().post(`/api/sessions/${a.sid}/next`).set(u.auth);
      const cid = randomUUID();
      const body = { puzzleId: nx.body.puzzle.id, correct: true, responseMs: 2500, clientAttemptId: cid };
      expect((await t.http().post(`/api/sessions/${a.sid}/attempt`).set(u.auth).send(body)).status).toBe(201);
      await t.http().post(`/api/sessions/${a.sid}/finish?save=false`).set(u.auth);
      const b = await createSession(u);
      const r = await t.http().post(`/api/sessions/${b.sid}/attempt`).set(u.auth).send(body);
      // Session a was discarded (cascade removed the row), so the key is free again.
      expect(r.status).toBe(201);
      const c = await createSession(u);
      const r2 = await t.http().post(`/api/sessions/${c.sid}/attempt`).set(u.auth).send(body);
      expect(r2.status).toBe(409);
      expect(r2.body.message).toBe('clientAttemptId already used');
    });

    it('validates the new fields; responseMs now allows up to 1 hour', async () => {
      const u = await newUser();
      const { sid } = await createSession(u);
      const nx = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
      const base = { puzzleId: nx.body.puzzle.id, correct: true };
      const bad = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth)
        .send({ ...base, responseMs: 1000, clientAttemptId: 'has spaces!', includeNext: 'yes', client: 'tv' });
      expect(bad.status).toBe(400);
      expect(bad.body.message).toEqual(expect.arrayContaining([
        'clientAttemptId must be 8-64 characters of A-Z, a-z, 0-9, _ or -',
        'includeNext must be a boolean value',
      ]));
      const tooSlow = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send({ ...base, responseMs: 3_600_001 });
      expect(tooSlow.status).toBe(400);
      expect(tooSlow.body.message).toEqual(['responseMs must not be greater than 3600000']);
      const slow = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send({ ...base, responseMs: 3_600_000 });
      expect(slow.status).toBe(201);
    });
  });

  describe('POST /sessions/:id/next with requestId', () => {
    it('the same requestId replays the same puzzle (once popped); a new one pops the next', async () => {
      const u = await newUser();
      const { sid } = await createSession(u);
      const len0 = await queueLen(sid);
      const rid = randomUUID();
      const burst = await Promise.all(
        Array.from({ length: 3 }, () => t.http().post(`/api/sessions/${sid}/next`).set(u.auth).send({ requestId: rid })),
      );
      const again = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth).send({ requestId: rid });
      for (const r of [...burst, again]) expect(r.status).toBe(201);
      expect(new Set([...burst, again].map((r) => r.text)).size).toBe(1);
      expect(burst[0].body.puzzle.id).toBe(QUEUE[0]);
      expect(await queueLen(sid)).toBe(len0 - 1);
      // Without client:'mobile' the body keeps the web keys.
      expect(Object.keys(burst[0].body)).toEqual(['puzzle', 'currentRating', 'session']);

      const ttl = await t.redis.ttl(`session:${sid}:next:${rid}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);

      const other = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth).send({ requestId: randomUUID() });
      expect(other.body.puzzle.id).toBe(QUEUE[1]);
      // The web's body-less /next still pops every time.
      const web1 = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
      const web2 = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
      expect([web1.body.puzzle.id, web2.body.puzzle.id]).toEqual([QUEUE[2], QUEUE[3]]);
    });

    it('rejects a malformed requestId', async () => {
      const u = await newUser();
      const { sid } = await createSession(u);
      const r = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth).send({ requestId: 'x' });
      expect(r.status).toBe(400);
      expect(r.body.message).toEqual(['requestId must be 8-64 characters of A-Z, a-z, 0-9, _ or -']);
    });
  });

  describe('serverNow', () => {
    it('is added to create and next only for client:mobile', async () => {
      const u = await newUser();
      const web = await createSession(u);
      expect(web.body).not.toHaveProperty('serverNow');
      const mob = await createSession(u, { client: 'mobile' });
      expect(mob.body.serverNow).toMatch(ISO);
      expect(Math.abs(Date.parse(mob.body.serverNow) - Date.now())).toBeLessThan(5000);
      const nx = await t.http().post(`/api/sessions/${mob.sid}/next`).set(u.auth).send({ client: 'mobile' });
      expect(nx.body.serverNow).toMatch(ISO);
      expect(Object.keys(nx.body)).toEqual(['puzzle', 'currentRating', 'session', 'serverNow']);
    });
  });

  describe('GET /sessions/active', () => {
    it('returns the caller\'s latest unfinished session, then null after finish', async () => {
      const u = await newUser();
      const other = await newUser();
      const none = await t.http().get('/api/sessions/active').set(u.auth);
      expect(none.status).toBe(200);
      expect(none.body.session).toBeNull();
      expect(none.body.serverNow).toMatch(ISO);

      const older = await createSession(u);
      await backdateSession(t.prisma, older.sid, 3600);
      const { sid } = await createSession(u);
      await createSession(other);
      const nx = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
      const att = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth)
        .send({ puzzleId: nx.body.puzzle.id, correct: false, responseMs: 4000 });

      const r = await t.http().get('/api/sessions/active').set(u.auth);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['session', 'serverNow']);
      const row = await t.prisma.trainingAttempt.findFirstOrThrow({ where: { sessionId: sid } });
      expect(r.body.session).toEqual({
        id: sid,
        mode: 'mixed',
        style: 'blitz',
        theme: null,
        startRating: 1200,
        durationSec: 300,
        startedAt: expect.stringMatching(ISO),
        lastActivityAt: row.createdAt.toISOString(),
        attempts: 1,
        solved: 0,
        failed: 1,
        currentRating: att.body.newRating,
      });

      await t.http().post(`/api/sessions/${sid}/finish?save=false`).set(u.auth);
      const r2 = await t.http().get('/api/sessions/active').set(u.auth);
      expect(r2.body.session.id).toBe(older.sid);
      expect(r2.body.session.lastActivityAt).toBe(r2.body.session.startedAt);
      await t.http().post(`/api/sessions/${older.sid}/finish`).set(u.auth);
      expect((await t.http().get('/api/sessions/active').set(u.auth)).body.session).toBeNull();
    });

    it('requires auth', async () => {
      expect((await t.http().get('/api/sessions/active')).status).toBe(401);
    });
  });

  describe('finish: tz and progression', () => {
    it('stores a valid tz, ignores an invalid one, and uses tz when localDate is missing', async () => {
      const u = await newUser();
      const a = await createSession(u);
      const r = await t.http().post(`/api/sessions/${a.sid}/finish?tz=Europe/Kyiv`).set(u.auth);
      expect(r.status).toBe(201);
      expect(r.body.streak).toMatchObject({ outcome: 'started', days: 1, lastDay: localDayInZone('Europe/Kyiv', new Date()) });
      expect(r.body).not.toHaveProperty('progression');
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).timezone).toBe('Europe/Kyiv');

      const b = await createSession(u);
      const r2 = await t.http().post(`/api/sessions/${b.sid}/finish?tz=Not/AZone`).set(u.auth);
      expect(r2.status).toBe(201);
      expect(r2.body.streak).toBeNull(); // no localDate, no usable tz: same as the web today
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).timezone).toBe('Europe/Kyiv');

      // An explicit localDate wins over tz.
      const c = await createSession(u);
      const r3 = await t.http().post(`/api/sessions/${c.sid}/finish?localDate=2030-01-01&tz=America/New_York`).set(u.auth);
      expect(r3.body.streak.lastDay).toBe('2030-01-01');
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).timezone).toBe('America/New_York');
    });

    it('client=mobile adds progression (saved, already-finished and discarded)', async () => {
      const u = await newUser({ rapid: { calibrationSessionsLeft: 0, unlockedStartRating: 1300 } });
      const a = await createSession(u, {}, 'rapid');
      const nx = await t.http().post(`/api/sessions/${a.sid}/next`).set(u.auth);
      await t.http().post(`/api/sessions/${a.sid}/attempt`).set(u.auth)
        .send({ puzzleId: nx.body.puzzle.id, correct: true, responseMs: 3000 });
      await backdateSession(t.prisma, a.sid, 400);
      const r = await t.http().post(`/api/sessions/${a.sid}/finish?localDate=2026-10-20&client=mobile`).set(u.auth);
      expect(r.status).toBe(201);
      const row = await t.prisma.userStyleProgression.findUniqueOrThrow({ where: { userId_style: { userId: u.id, style: 'rapid' } } });
      const expected = {
        style: 'rapid',
        startPuzzleRating: row.startPuzzleRating,
        currentPuzzleRating: row.currentPuzzleRating,
        unlockedStartRating: row.unlockedStartRating,
        calibrationSessionsLeft: row.calibrationSessionsLeft,
        weakSessionStreak: row.weakSessionStreak,
      };
      expect(r.body.progression).toEqual(expected);
      expect(Object.keys(r.body).slice(-1)).toEqual(['progression']);

      const again = await t.http().post(`/api/sessions/${a.sid}/finish?client=mobile`).set(u.auth);
      expect(again.body.progression).toEqual(expected);

      const d = await createSession(u, { startRating: 1250 }, 'rapid');
      const nd = await t.http().post(`/api/sessions/${d.sid}/next`).set(u.auth);
      await t.http().post(`/api/sessions/${d.sid}/attempt`).set(u.auth)
        .send({ puzzleId: nd.body.puzzle.id, correct: true, responseMs: 2000 });
      const disc = await t.http().post(`/api/sessions/${d.sid}/finish?save=false&client=mobile`).set(u.auth);
      expect(disc.body).toEqual({ discarded: true, progression: expect.objectContaining({ style: 'rapid', currentPuzzleRating: 1250 }) });
    });
  });

  describe('Redis key hygiene', () => {
    it('every session:{sid}:* key has a TTL; queue/seen get durationSec + 24 h', async () => {
      const u = await newUser();
      const { sid } = await createSession(u, { client: 'mobile', durationSec: 600 });
      const nx = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth).send({ requestId: randomUUID() });
      await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth)
        .send({ puzzleId: nx.body.puzzle.id, correct: true, responseMs: 3000, clientAttemptId: randomUUID(), includeNext: true });

      const keys = await t.redis.keys(`session:${sid}:*`);
      expect(keys.sort()).toEqual(expect.arrayContaining([`session:${sid}:queue`, `session:${sid}:seen`]));
      expect(keys.length).toBe(4); // queue, seen, next replay, attempt replay (no leftover locks)
      for (const k of keys) expect(await t.redis.ttl(k)).toBeGreaterThan(0);
      for (const k of [`session:${sid}:queue`, `session:${sid}:seen`]) {
        const ttl = await t.redis.ttl(k);
        expect(ttl).toBeGreaterThan(600 + 86400 - 30);
        expect(ttl).toBeLessThanOrEqual(600 + 86400);
      }
      expect(await t.redis.ttl(`session:${sid}:attempt:${(await t.prisma.trainingAttempt.findFirstOrThrow({ where: { sessionId: sid } })).clientAttemptId}`))
        .toBeGreaterThan(86400 - 30);

      // A cold preload (no primed queue) also sets the TTL on the fresh list.
      const cold = await t.http().post('/api/sessions').set(u.auth).send({ startRating: 1200, durationSec: 60, mode: 'mixed', style: 'blitz' });
      const coldSid = cold.body.sessionId as string;
      await t.redis.del(`session:${coldSid}:queue`);
      const cn = await t.http().post(`/api/sessions/${coldSid}/next`).set(u.auth);
      expect(cn.status).toBe(201);
      await sleep(100); // let the background refill land
      for (const k of await t.redis.keys(`session:${coldSid}:*`)) expect(await t.redis.ttl(k)).toBeGreaterThan(0);
    });

    it('user:{uid}:recent drops entries older than 30 days', async () => {
      const u = await newUser();
      const { sid } = await createSession(u);
      const key = `user:${u.id}:recent`;
      await t.redis.zadd(key, Date.now() - 31 * 86400 * 1000, 'stale-puzzle');
      await t.redis.zadd(key, Date.now() - 29 * 86400 * 1000, 'fresh-puzzle');
      await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
      const members = await t.redis.zrange(key, 0, -1);
      expect(members).not.toContain('stale-puzzle');
      expect(members).toContain('fresh-puzzle');
      expect(members).toContain(QUEUE[0]);
      expect(await t.redis.ttl(key)).toBeGreaterThan(0);
    });

    it('DELETE /sessions/:id also clears the buffer keys', async () => {
      const u = await newUser();
      const { sid } = await createSession(u);
      await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
      expect(await t.redis.exists(`session:${sid}:queue`, `session:${sid}:seen`)).toBe(2);
      const r = await t.http().delete(`/api/sessions/${sid}`).set(u.auth);
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true });
      expect(await t.redis.exists(`session:${sid}:queue`, `session:${sid}:seen`)).toBe(0);
    });
  });

  describe('rating semantics', () => {
    type Move = [boolean, number];
    const SCRIPT: Move[] = [[true, 3000], [true, 3500], [false, 9000], [true, 4200], [true, 2500], [false, 14000], [true, 5000]];

    async function playWeb(u: U) {
      const { sid } = await createSession(u, { durationSec: 60 });
      const out: unknown[] = [];
      for (const [correct, responseMs] of SCRIPT) {
        const nx = await t.http().post(`/api/sessions/${sid}/next`).set(u.auth);
        await sleep(3);
        const a = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send({ puzzleId: nx.body.puzzle.id, correct, responseMs });
        out.push({ puzzle: nx.body.puzzle.id, servedAt: nx.body.currentRating, ...a.body });
      }
      await backdateSession(t.prisma, sid, 75);
      const fin = await t.http().post(`/api/sessions/${sid}/finish?localDate=2026-10-20`).set(u.auth);
      const { sessionId: _s, ...finish } = fin.body;
      return { out, finish };
    }

    async function playMobile(u: U) {
      const { sid } = await createSession(u, { durationSec: 60, client: 'mobile' });
      const out: unknown[] = [];
      let nx = (await t.http().post(`/api/sessions/${sid}/next`).set(u.auth).send({ requestId: randomUUID(), client: 'mobile' })).body;
      for (const [correct, responseMs] of SCRIPT) {
        await sleep(3);
        const body = { puzzleId: nx.puzzle.id, correct, responseMs, clientAttemptId: randomUUID(), includeNext: true, client: 'mobile' };
        const a = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send(body);
        // An outbox retry of every attempt must not change anything.
        const retry = await t.http().post(`/api/sessions/${sid}/attempt`).set(u.auth).send(body);
        expect(retry.text).toBe(a.text);
        const { next, ...step } = a.body;
        out.push({ puzzle: nx.puzzle.id, servedAt: nx.currentRating, ...step });
        nx = next;
      }
      await backdateSession(t.prisma, sid, 75);
      const fin = await t.http().post(`/api/sessions/${sid}/finish?localDate=2026-10-20&tz=Europe/Kyiv&client=mobile`).set(u.auth);
      const { sessionId: _s, progression: _p, ...finish } = fin.body;
      return { out, finish };
    }

    it('a mobile-style session (requestId, clientAttemptId + retries, includeNext) rates exactly like the web flow', async () => {
      const web = await playWeb(await newUser());
      const mobile = await playMobile(await newUser());
      expect(mobile).toEqual(web);
      expect((web.out as Array<{ step: number }>).some((a) => a.step !== 0)).toBe(true);
    });
  });
});
