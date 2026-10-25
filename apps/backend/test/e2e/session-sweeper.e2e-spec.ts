/**
 * B7 session sweeper on seeded idle sessions. PROVISIONAL policy
 * (PLAN §8 #10): last activity > 12 h → 0 attempts: delete; otherwise
 * save as early exit with no unlock / demote / calibration change, no
 * streak tick and no achievement evaluation. Off unless
 * SESSION_SWEEPER_ENABLED=true (unset here).
 */
import { SchedulerRegistry } from '@nestjs/schedule';
import { bootTestApp, bearer, TestApp } from '../helpers/app';
import { resetDatabase, fixturePuzzle } from '../helpers/db';
import { createUser, primeQueue, tokenFor } from '../helpers/seed';
import { deriveSessionStats } from '../../src/sessions/rating';
import { SessionSweeperService, SWEEP_LOCK_KEY } from '../../src/sessions/session-sweeper.service';

const H = 60 * 60 * 1000;

describe('session sweeper (B7)', () => {
  let t: TestApp;
  let sweeper: SessionSweeperService;
  let n = 0;

  beforeAll(async () => {
    t = await bootTestApp();
    sweeper = t.app.get(SessionSweeperService);
    await resetDatabase(t.prisma, t.redis);
  });
  afterAll(async () => { await t?.close(); });

  async function newUser() {
    n += 1;
    return createUser(t.prisma, {
      nickname: `sw_${n}`,
      styles: { blitz: { calibrationSessionsLeft: 3, unlockedStartRating: 1250, weakSessionStreak: 1, currentPuzzleRating: 1234, startPuzzleRating: 1200 } },
      streak: { streakDays: 4, streakFreezes: 1, streakLastDay: '2026-10-01', streakFreezeRegenAt: null },
    });
  }

  /** An unfinished blitz session started `startedAgoMs` ago with attempts at the given ages. */
  async function seedOpen(userId: string, startedAgoMs: number, attemptAgesMs: number[], correct: boolean[] = []) {
    const now = Date.now();
    const s = await t.prisma.trainingSession.create({
      data: { userId, mode: 'mixed', style: 'blitz', startRating: 1200, durationSec: 300, startedAt: new Date(now - startedAgoMs) },
    });
    const ids = ['004Lu', '00ICz', '003S3', '00LPw', '009FP'];
    if (attemptAgesMs.length) {
      await t.prisma.trainingAttempt.createMany({
        data: attemptAgesMs.map((age, i) => ({
          sessionId: s.id,
          userId,
          puzzleId: ids[i],
          puzzleRating: fixturePuzzle(ids[i]).rating,
          correct: correct[i] ?? true,
          responseMs: 3000 + i * 1000,
          createdAt: new Date(now - age),
        })),
      });
    }
    await primeQueue(t.redis, s.id, ['00cy1', '0040n']);
    await t.redis.sadd(`session:${s.id}:seen`, '004Lu');
    return s;
  }

  const sessionKeys = (sid: string) => t.redis.keys(`session:${sid}:*`);

  it('is not scheduled unless SESSION_SWEEPER_ENABLED is set', () => {
    expect(process.env.SESSION_SWEEPER_ENABLED).toBeUndefined();
    expect(t.app.get(SchedulerRegistry).getIntervals()).toEqual([]);
  });

  it('SESSION_SWEEPER_ENABLED=true registers the 10-minute interval (removed on close)', async () => {
    process.env.SESSION_SWEEPER_ENABLED = 'true';
    let enabled: TestApp | undefined;
    try {
      enabled = await bootTestApp();
      const registry = enabled.app.get(SchedulerRegistry);
      expect(registry.getIntervals()).toEqual(['session-sweeper']);
      await enabled.close();
      expect(registry.getIntervals()).toEqual([]);
      enabled = undefined;
    } finally {
      delete process.env.SESSION_SWEEPER_ENABLED;
      await enabled?.close();
    }
  });

  it('applies the policy to seeded sessions', async () => {
    const u = await newUser();
    const other = await newUser();
    const progBefore = await t.prisma.userStyleProgression.findMany({ where: { userId: u.id }, orderBy: { style: 'asc' } });
    const userBefore = await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } });

    const empty = await seedOpen(u.id, 13 * H, []);                                       // → deleted
    const idle = await seedOpen(u.id, 14 * H, [13.9 * H, 13.8 * H, 13.5 * H], [true, false, true]); // → saved early exit
    await t.prisma.reviewItem.create({ data: { userId: u.id, puzzleId: '00ICz' } });
    const recentAttempt = await seedOpen(u.id, 13 * H, [14 * H - 1, 1 * H]);              // last activity 1 h ago → kept
    const young = await seedOpen(other.id, 1 * H, []);                                     // started 1 h ago → kept
    const endedAt = new Date(Date.now() - 20 * H);
    const finished = await t.prisma.trainingSession.create({
      data: { userId: u.id, mode: 'mixed', style: 'blitz', startRating: 1200, durationSec: 60, startedAt: new Date(Date.now() - 21 * H), endedAt },
    });

    const res = await sweeper.sweep();
    expect(res).toEqual({ deleted: 1, finalized: 1, failed: 0 });

    // 0 attempts: row and Redis buffer gone.
    expect(await t.prisma.trainingSession.findUnique({ where: { id: empty.id } })).toBeNull();
    expect(await sessionKeys(empty.id)).toEqual([]);

    // With attempts: saved, stats derived, endedAt = last activity, buffer gone.
    const swept = await t.prisma.trainingSession.findUniqueOrThrow({ where: { id: idle.id } });
    const attempts = await t.prisma.trainingAttempt.findMany({ where: { sessionId: idle.id }, orderBy: { createdAt: 'asc' } });
    const stats = deriveSessionStats(attempts, 1200);
    expect(swept.endedAt?.toISOString()).toBe(attempts[attempts.length - 1].createdAt.toISOString());
    expect({
      solved: swept.solvedCount, failed: swept.failedCount, accuracy: swept.accuracy,
      avgResponseMs: swept.avgResponseMs, peakRating: swept.peakRating,
    }).toEqual(stats);
    expect(stats.solved).toBe(2);
    expect(await sessionKeys(idle.id)).toEqual([]);

    // No progression change (unlock / demote / calibration), no streak tick, no achievements.
    expect(await t.prisma.userStyleProgression.findMany({ where: { userId: u.id }, orderBy: { style: 'asc' } })).toEqual(progBefore);
    const userAfter = await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect({ d: userAfter.streakDays, f: userAfter.streakFreezes, l: userAfter.streakLastDay, r: userAfter.streakFreezeRegenAt })
      .toEqual({ d: userBefore.streakDays, f: userBefore.streakFreezes, l: userBefore.streakLastDay, r: userBefore.streakFreezeRegenAt });
    expect(await t.prisma.userAchievement.count({ where: { userId: u.id } })).toBe(0);
    // The review queue the session produced stays (like an early exit).
    expect(await t.prisma.reviewItem.count({ where: { userId: u.id } })).toBe(1);

    // Untouched: recent activity, young session, already finished.
    for (const s of [recentAttempt, young]) {
      const row = await t.prisma.trainingSession.findUniqueOrThrow({ where: { id: s.id } });
      expect(row.endedAt).toBeNull();
      expect((await sessionKeys(s.id)).length).toBe(2);
    }
    expect((await t.prisma.trainingSession.findUniqueOrThrow({ where: { id: finished.id } })).endedAt?.toISOString()).toBe(endedAt.toISOString());

    // The swept session reads like any finished one; finish returns its summary.
    const auth = bearer(tokenFor(t.jwt, u));
    const detail = await t.http().get(`/api/sessions/${idle.id}`).set(auth);
    expect(detail.status).toBe(200);
    expect(detail.body.endedAt).toBe(swept.endedAt?.toISOString());
    const fin = await t.http().post(`/api/sessions/${idle.id}/finish?localDate=2026-10-25&client=mobile`).set(auth);
    expect(fin.status).toBe(201);
    expect(fin.body).toMatchObject({ sessionId: idle.id, solved: 2, failed: 1, progression: { style: 'blitz', calibrationSessionsLeft: 3 } });
    expect(fin.body).not.toHaveProperty('streak');
    // /sessions/active now reports the one still-live session.
    const active = await t.http().get('/api/sessions/active').set(auth);
    expect(active.body.session.id).toBe(recentAttempt.id);

    // Idempotent: a second sweep finds nothing.
    expect(await sweeper.sweep()).toEqual({ deleted: 0, finalized: 0, failed: 0 });
  });

  it('skips the run while another holder has the Redis lock', async () => {
    const u = await newUser();
    const s = await seedOpen(u.id, 30 * H, []);
    await t.redis.set(SWEEP_LOCK_KEY, 'someone-else', 'PX', 60_000);
    expect(await sweeper.sweep()).toBeNull();
    expect(await t.prisma.trainingSession.findUnique({ where: { id: s.id } })).not.toBeNull();
    expect(await t.redis.get(SWEEP_LOCK_KEY)).toBe('someone-else');
    await t.redis.del(SWEEP_LOCK_KEY);
    expect(await sweeper.sweep()).toEqual({ deleted: 1, finalized: 0, failed: 0 });
    expect(await t.redis.exists(SWEEP_LOCK_KEY)).toBe(0);
  });

  it('two concurrent sweeps: one runs, the other skips', async () => {
    const u = await newUser();
    await seedOpen(u.id, 30 * H, [29 * H]);
    const [a, b] = await Promise.all([sweeper.sweep(), sweeper.sweep()]);
    expect([a, b].filter((r) => r === null)).toHaveLength(1);
    expect([a, b].find((r) => r !== null)).toEqual({ deleted: 0, finalized: 1, failed: 0 });
  });
});
