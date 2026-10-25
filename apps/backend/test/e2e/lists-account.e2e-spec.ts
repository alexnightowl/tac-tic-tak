/**
 * B9 (lists) + B10 (account deletion) e2e.
 *
 *  - GET /sessions: keyset pagination over 3 pages, style filter, strict
 *    query validation, own finished sessions only.
 *  - GET /review/themes: firstPuzzleId === GET /review?theme={slug}[0].
 *  - POST /review/:puzzleId/resolve: idempotent, 404 when never queued.
 *  - DELETE /users/me {password}: 403 on a wrong password, 204 removes the
 *    user, every dependent row, the avatar files and the Redis buffer keys.
 *
 * The routes are tested on today's /api prefix; once B2's URI versioning
 * is on main the same handlers also answer on /api/v1.
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { bootTestApp, bearer, TestApp } from '../helpers/app';
import { resetDatabase } from '../helpers/db';
import {
  createFinishedSession,
  createFriendship,
  createReviewItem,
  createUser,
  DEFAULT_PASSWORD,
  tokenFor,
} from '../helpers/seed';
import { keysOf } from '../helpers/shape';
import type { TrainingStyle } from '../../src/sessions/unlock';

const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars');
// 1x1 transparent PNG.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const STYLES: TrainingStyle[] = ['bullet', 'blitz', 'rapid'];

describe('B9 lists + B10 account deletion', () => {
  let t: TestApp;
  let n = 0;

  beforeAll(async () => {
    t = await bootTestApp();
    await resetDatabase(t.prisma, t.redis);
  });
  afterAll(async () => { await t?.close(); });

  async function newUser(prefix: string) {
    n += 1;
    const u = await createUser(t.prisma, { nickname: `${prefix}_${n}` });
    return { ...u, token: tokenFor(t.jwt, u), auth: bearer(tokenFor(t.jwt, u)) };
  }

  // ───────────────────────────── GET /sessions ─────────────────────────────

  describe('GET /sessions', () => {
    let owner: Awaited<ReturnType<typeof newUser>>;
    /** Expected order: startedAt desc, id desc. */
    let expected: { id: string; style: string; startedAt: Date }[];
    /** The two sessions sharing one startedAt, in expected (id desc) order. */
    let tieIds: string[];

    beforeAll(async () => {
      owner = await newUser('list');
      const other = await newUser('list_other');
      const base = Date.UTC(2026, 5, 1, 12, 0, 0);
      const rows: { id: string; style: string; startedAt: Date }[] = [];
      // 48 sessions an hour apart, styles rotating bullet/blitz/rapid.
      for (let i = 0; i < 48; i += 1) {
        const style = STYLES[i % 3];
        const startedAt = new Date(base + i * 3_600_000);
        const s = await createFinishedSession(t.prisma, owner.id, {
          style,
          startedAt,
          durationSec: 60,
          attempts: i % 2 === 0 ? [{ puzzleId: '00BJm', correct: true, responseMs: 4000 }] : [],
        });
        rows.push({ id: s.id, style, startedAt });
      }
      // Two sessions sharing one startedAt, straddling the page-1/page-2
      // boundary: the id tie-break must neither drop nor repeat one.
      const tie = new Date(base + 30 * 3_600_000 + 1_800_000);
      for (let i = 0; i < 2; i += 1) {
        const s = await createFinishedSession(t.prisma, owner.id, { style: 'blitz', startedAt: tie, durationSec: 60, attempts: [] });
        rows.push({ id: s.id, style: 'blitz', startedAt: tie });
      }
      // Never listed: a live session (endedAt null) and another user's.
      await t.prisma.trainingSession.create({
        data: { userId: owner.id, mode: 'mixed', style: 'blitz', startRating: 1200, durationSec: 60, startedAt: new Date(base + 100 * 3_600_000) },
      });
      await createFinishedSession(t.prisma, other.id, { style: 'blitz', startedAt: new Date(base), attempts: [] });

      expected = rows.sort((a, b) =>
        b.startedAt.getTime() - a.startedAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
      tieIds = expected.filter((r) => r.startedAt.getTime() === tie.getTime()).map((r) => r.id);
    });

    async function fetchAll(query: Record<string, string>) {
      const pages: { id: string; style: string; startedAt: string }[][] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 20; guard += 1) {
        const res = await t.http().get('/api/sessions').set(owner.auth)
          .query({ ...query, ...(cursor ? { cursor } : {}) });
        expect(res.status).toBe(200);
        expect(keysOf(res.body)).toEqual(['items', 'nextCursor']);
        pages.push(res.body.items);
        cursor = res.body.nextCursor;
        if (cursor === null) break;
        expect(typeof cursor).toBe('string');
      }
      return pages;
    }

    it('paginates 50 finished sessions over 3 pages (20/20/10), startedAt desc, no gaps or repeats', async () => {
      const pages = await fetchAll({ limit: '20' });
      expect(pages.map((p) => p.length)).toEqual([20, 20, 10]);
      const ids = pages.flat().map((r) => r.id);
      expect(new Set(ids).size).toBe(50);
      expect(ids).toEqual(expected.map((r) => r.id));
      // Cut a page exactly between the two sessions sharing a startedAt:
      // the (startedAt, id) cursor must neither drop nor repeat one.
      expect(tieIds).toHaveLength(2);
      const tieIndex = ids.indexOf(tieIds[0]);
      const split = await fetchAll({ limit: String(tieIndex + 1) });
      expect(split[0][split[0].length - 1].id).toBe(tieIds[0]);
      expect(split[1][0].id).toBe(tieIds[1]);
      expect(split.flat().map((r) => r.id)).toEqual(ids);
    });

    it('rows carry the /analytics recentSessions fields plus endedAt', async () => {
      const res = await t.http().get('/api/sessions').set(owner.auth).query({ limit: 2 });
      expect(res.status).toBe(200);
      expect(keysOf(res.body.items[0])).toEqual([
        'accuracy', 'avgResponseMs', 'durationSec', 'endedAt', 'failed', 'id', 'mode', 'peakRating',
        'solved', 'startRating', 'startedAt', 'style', 'theme',
      ]);
      const overview = await t.http().get('/api/analytics').set(owner.auth);
      const recent = overview.body.recentSessions[0];
      const { endedAt: _e, ...row } = res.body.items[0];
      expect(row).toEqual(recent); // same values for the same session
    });

    it('defaults to 20 per page', async () => {
      const res = await t.http().get('/api/sessions').set(owner.auth);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(20);
      expect(res.body.nextCursor).toEqual(expect.any(String));
    });

    it('style filter returns only that style, paginated', async () => {
      for (const style of STYLES) {
        const pages = await fetchAll({ style, limit: '7' });
        const rows = pages.flat();
        const want = expected.filter((r) => r.style === style).map((r) => r.id);
        expect(rows.map((r) => r.id)).toEqual(want);
        expect(rows.every((r) => r.style === style)).toBe(true);
        expect(pages.length).toBe(Math.ceil(want.length / 7));
      }
    });

    it('a user with no finished sessions gets an empty page', async () => {
      const fresh = await newUser('list_empty');
      const res = await t.http().get('/api/sessions').set(fresh.auth);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('rejects a bad limit, style or cursor with 400 and needs a token', async () => {
      for (const q of [{ limit: '0' }, { limit: '51' }, { limit: 'abc' }, { limit: '2.5' }, { style: 'classical' },
        { cursor: 'not-a-cursor' }, { cursor: '%%%' }, { cursor: Buffer.from('123:').toString('base64url') }]) {
        const res = await t.http().get('/api/sessions').set(owner.auth).query(q);
        expect({ q, status: res.status }).toEqual({ q, status: 400 });
      }
      const anon = await t.http().get('/api/sessions');
      expect(anon.status).toBe(401);
    });

    it('a cursor from one user only narrows the caller\'s own rows', async () => {
      const first = await t.http().get('/api/sessions').set(owner.auth).query({ limit: 5 });
      const other = await newUser('list_cursor');
      await createFinishedSession(t.prisma, other.id, { startedAt: new Date(Date.UTC(2026, 0, 1)), attempts: [] });
      const res = await t.http().get('/api/sessions').set(other.auth).query({ cursor: first.body.nextCursor });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.nextCursor).toBeNull();
    });
  });

  // ─────────────────────────────── review ───────────────────────────────

  describe('review themes firstPuzzleId + idempotent resolve', () => {
    let u: Awaited<ReturnType<typeof newUser>>;

    beforeAll(async () => {
      u = await newUser('rev');
      const t0 = Date.UTC(2026, 5, 1);
      // fork: 00BJm 1088 (resolved, must be ignored), 00Aas 1111 and
      // 005nD 1111 (tie; 00Aas queued first), zzwh6 1167, zzYOH 1237.
      // skewer: 004mT 1361, 00ICz 1205, 00AB1 1107.
      const order: [string, boolean][] = [
        ['zzYOH', false], ['00BJm', true], ['00Aas', false], ['004mT', false], ['005nD', false],
        ['zzwh6', false], ['00ICz', false], ['00AB1', false],
      ];
      for (const [i, [puzzleId, resolved]] of order.entries()) {
        await t.prisma.reviewItem.create({
          data: { userId: u.id, puzzleId, createdAt: new Date(t0 + i * 1000), resolvedAt: resolved ? new Date(t0) : null },
        });
      }
    });

    it('every theme row has firstPuzzleId === GET /review?theme={slug}[0].puzzleId at minRating', async () => {
      const res = await t.http().get('/api/review/themes').set(u.auth);
      expect(res.status).toBe(200);
      expect(res.body.map((r: { slug: string }) => r.slug).sort()).toEqual(['fork', 'mateIn2', 'skewer']);
      for (const row of res.body) {
        expect(keysOf(row)).toEqual(['count', 'firstPuzzleId', 'minRating', 'slug']);
        const list = await t.http().get('/api/review').set(u.auth).query({ theme: row.slug });
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(row.count);
        expect({ slug: row.slug, first: row.firstPuzzleId }).toEqual({ slug: row.slug, first: list.body[0].puzzleId });
        expect(list.body[0].rating).toBe(row.minRating);
      }
      const fork = res.body.find((r: { slug: string }) => r.slug === 'fork');
      expect(fork).toEqual({ slug: 'fork', count: 4, minRating: 1111, firstPuzzleId: '00Aas' });
      const skewer = res.body.find((r: { slug: string }) => r.slug === 'skewer');
      expect(skewer).toEqual({ slug: 'skewer', count: 3, minRating: 1107, firstPuzzleId: '00AB1' });
    });

    it('resolve twice: 201 {ok:true} both times, resolvedAt kept from the first call', async () => {
      const first = await t.http().post('/api/review/00Aas/resolve').set(u.auth);
      expect(first.status).toBe(201);
      expect(first.body).toEqual({ ok: true });
      const stamped = await t.prisma.reviewItem.findUniqueOrThrow({ where: { userId_puzzleId: { userId: u.id, puzzleId: '00Aas' } } });
      expect(stamped.resolvedAt).not.toBeNull();

      const second = await t.http().post('/api/review/00Aas/resolve').set(u.auth);
      expect(second.status).toBe(201);
      expect(second.body).toEqual({ ok: true });
      const after = await t.prisma.reviewItem.findUniqueOrThrow({ where: { userId_puzzleId: { userId: u.id, puzzleId: '00Aas' } } });
      expect(after.resolvedAt).toEqual(stamped.resolvedAt);

      // Concurrent duplicates (a mobile retry racing the original) both succeed.
      const [a, b] = await Promise.all([
        t.http().post('/api/review/005nD/resolve').set(u.auth),
        t.http().post('/api/review/005nD/resolve').set(u.auth),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);

      const themes = await t.http().get('/api/review/themes').set(u.auth);
      const fork = themes.body.find((r: { slug: string }) => r.slug === 'fork');
      expect(fork).toEqual({ slug: 'fork', count: 2, minRating: 1167, firstPuzzleId: 'zzwh6' });
    });

    it('an already-resolved (older) item is idempotent too', async () => {
      const res = await t.http().post('/api/review/00BJm/resolve').set(u.auth);
      expect(res.status).toBe(201);
      const row = await t.prisma.reviewItem.findUniqueOrThrow({ where: { userId_puzzleId: { userId: u.id, puzzleId: '00BJm' } } });
      expect(row.resolvedAt).toEqual(new Date(Date.UTC(2026, 5, 1)));
    });

    it('a puzzle never queued for the caller is 404 "not in review queue" (was a P2025 500)', async () => {
      const notQueued = await t.http().post('/api/review/009FP/resolve').set(u.auth);
      expect(notQueued.status).toBe(404);
      expect(notQueued.body.message).toBe('not in review queue');
      const unknown = await t.http().post('/api/review/nope_puzzle/resolve').set(u.auth);
      expect(unknown.status).toBe(404);

      // Another user's queued item cannot be resolved through this user.
      const other = await newUser('rev_other');
      await createReviewItem(t.prisma, other.id, '009FP');
      const cross = await t.http().post('/api/review/009FP/resolve').set(u.auth);
      expect(cross.status).toBe(404);
      const untouched = await t.prisma.reviewItem.findUniqueOrThrow({ where: { userId_puzzleId: { userId: other.id, puzzleId: '009FP' } } });
      expect(untouched.resolvedAt).toBeNull();
    });
  });

  // ─────────────────────────── DELETE /users/me ───────────────────────────

  describe('DELETE /users/me', () => {
    /** Every FK column that references "User"(id), read from the catalog. */
    async function userFks() {
      return t.prisma.$queryRawUnsafe<{ table: string; column: string; deltype: string }[]>(`
        SELECT c.conrelid::regclass::text AS "table", a.attname AS "column", c.confdeltype AS "deltype"
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass
        ORDER BY 1, 2`);
    }

    async function dependentCounts(userId: string) {
      const out: Record<string, number> = {};
      for (const fk of await userFks()) {
        const [{ count }] = await t.prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT count(*)::bigint AS count FROM ${fk.table} WHERE "${fk.column}" = $1`, userId);
        out[`${fk.table}.${fk.column}`] = Number(count);
      }
      return out;
    }

    async function avatarFiles(userId: string) {
      const names = await fs.readdir(AVATAR_DIR).catch(() => [] as string[]);
      return names.filter((f) => f.startsWith(`${userId}.`));
    }

    it('every foreign key to "User" cascades (so deleting the row removes all dependents)', async () => {
      const fks = await userFks();
      expect(fks.length).toBeGreaterThanOrEqual(10);
      expect(fks.filter((f) => f.deltype !== 'c')).toEqual([]);
    });

    it('needs a token and a password; a wrong password is 403 and deletes nothing', async () => {
      const u = await newUser('del_guard');
      expect((await t.http().delete('/api/users/me').send({ password: DEFAULT_PASSWORD })).status).toBe(401);

      const missing = await t.http().delete('/api/users/me').set(u.auth).send({});
      expect(missing.status).toBe(400);

      const wrong = await t.http().delete('/api/users/me').set(u.auth).send({ password: 'Wrong0pass' });
      expect(wrong.status).toBe(403);
      expect(wrong.body.message).toBe('password is incorrect');
      expect(await t.prisma.user.findUnique({ where: { id: u.id } })).not.toBeNull();
      const login = await t.http().post('/api/auth/login').send({ nickname: u.nickname, password: DEFAULT_PASSWORD });
      expect(login.status).toBe(201);
    });

    it('204 removes the user, every dependent row, the avatar file and the Redis buffer keys', async () => {
      const victim = await newUser('del_me');
      const friend = await newUser('del_friend');
      const bystander = await newUser('del_bystander');

      // Populate every relation the schema has.
      const s = await createFinishedSession(t.prisma, victim.id, {
        attempts: [
          { puzzleId: '00BJm', correct: false, responseMs: 5000 },
          { puzzleId: '00AB1', correct: true, responseMs: 3000 },
        ],
      });
      expect(s.id).toBeTruthy();
      await t.prisma.userPuzzleHistory.create({ data: { userId: victim.id, puzzleId: '00BJm' } });
      await createReviewItem(t.prisma, victim.id, '00BJm');
      await createFriendship(t.prisma, victim.id, friend.id, 'accepted');
      await createFriendship(t.prisma, bystander.id, victim.id, 'pending');
      await createFriendship(t.prisma, friend.id, bystander.id, 'accepted');
      await t.prisma.userAchievement.create({ data: { userId: victim.id, slug: 'first_session' } });
      // A live session through the API: fills session:{sid}:queue/:seen and user:{uid}:recent.
      const live = await t.http().post('/api/sessions').set(victim.auth)
        .send({ startRating: 1200, durationSec: 60, mode: 'mixed', style: 'blitz' });
      expect(live.status).toBe(201);
      const sid = live.body.sessionId as string;
      // Avatars for the victim (two extensions) and the bystander.
      const up = await t.http().post('/api/users/me/avatar').set(victim.auth).send({ dataUrl: PNG_1PX });
      expect(up.status).toBe(201);
      await fs.writeFile(join(AVATAR_DIR, `${victim.id}.webp`), 'stale');
      const keep = await t.http().post('/api/users/me/avatar').set(bystander.auth).send({ dataUrl: PNG_1PX });
      expect(keep.status).toBe(201);

      const before = await dependentCounts(victim.id);
      // Every relation actually had rows, so the "after" zeros mean something.
      expect(Object.entries(before).filter(([, c]) => c === 0)).toEqual([]);
      expect(await avatarFiles(victim.id)).toEqual(expect.arrayContaining([`${victim.id}.png`, `${victim.id}.webp`]));
      expect(await t.redis.exists(`user:${victim.id}:recent`)).toBe(1);
      expect(await t.redis.exists(`session:${sid}:seen`)).toBe(1);
      const bystanderBefore = await dependentCounts(bystander.id);
      const friendBefore = await dependentCounts(friend.id);

      const res = await t.http().delete('/api/users/me').set(victim.auth)
        .set('Content-Type', 'application/json').send({ password: DEFAULT_PASSWORD });
      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      expect(await t.prisma.user.findUnique({ where: { id: victim.id } })).toBeNull();
      const after = await dependentCounts(victim.id);
      expect(Object.values(after).every((c) => c === 0)).toBe(true);
      expect(await avatarFiles(victim.id)).toEqual([]);
      expect(await t.redis.exists(`user:${victim.id}:recent`, `session:${sid}:queue`, `session:${sid}:seen`)).toBe(0);

      // Other users keep everything except their rows with the victim.
      expect(await t.prisma.user.count({ where: { id: { in: [friend.id, bystander.id] } } })).toBe(2);
      expect(await avatarFiles(bystander.id)).toEqual([`${bystander.id}.png`]);
      const bystanderAfter = await dependentCounts(bystander.id);
      const friendAfter = await dependentCounts(friend.id);
      expect(bystanderAfter['"Friendship".requesterId']).toBe(bystanderBefore['"Friendship".requesterId'] - 1);
      expect(friendAfter['"Friendship".addresseeId']).toBe(friendBefore['"Friendship".addresseeId'] - 1);
      expect(friendAfter['"Friendship".requesterId']).toBe(1); // friend ↔ bystander survives
      expect(friendAfter['"UserSetting".userId']).toBe(1);

      // The old token now hits the existing deleted-user paths; login fails.
      expect((await t.http().get('/api/users/me').set(victim.auth)).status).toBe(404);
      expect((await t.http().delete('/api/users/me').set(victim.auth).send({ password: DEFAULT_PASSWORD })).status).toBe(404);
      const login = await t.http().post('/api/auth/login').send({ nickname: victim.nickname, password: DEFAULT_PASSWORD });
      expect(login.status).toBe(401);
      // The nickname is free again.
      const again = await t.http().post('/api/auth/register')
        .send({ nickname: victim.nickname, password: DEFAULT_PASSWORD, repeatPassword: DEFAULT_PASSWORD });
      expect(again.status).toBe(201);

      for (const ext of ['png', 'jpg', 'webp']) {
        await fs.rm(join(AVATAR_DIR, `${bystander.id}.${ext}`), { force: true });
      }
    });
  });
});
