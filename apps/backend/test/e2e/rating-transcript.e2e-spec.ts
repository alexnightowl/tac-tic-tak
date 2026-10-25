/**
 * RATING TRANSCRIPT GOLDEN TEST.
 *
 * Scripted sessions through the real HTTP API with a fixed puzzle order
 * (primed into the Redis buffer) and fixed answers/response times. The
 * full per-attempt rating sequence and every outcome the finish handler
 * computes (unlock / demote / calibration / streak) are snapshotted, so a
 * backend change that alters web users' ratings shows up as a diff.
 *
 * B6 must leave this file's snapshot byte-identical. B8 (startPuzzleRating
 * rules fix) is the one planned change expected to alter it; it lands with
 * a before/after diff of this snapshot.
 *
 * The first puzzle embedded in POST /sessions is picked at random by the
 * buffer, so transcripts skip it and start from the primed /next queue.
 */
import { bootTestApp, bearer, sleep, TestApp } from '../helpers/app';
import { resetDatabase } from '../helpers/db';
import { backdateSession, createUser, primeQueue, tokenFor } from '../helpers/seed';
import type { TrainingStyle } from '../../src/sessions/unlock';

// 20 fixture puzzles, rating-sorted groups interleaved: comfortable → hard.
const MIXED_QUEUE = [
  '004Lu', '00ICz', '003S3', '00LPw', '009FP', '00u3h', '004mT', '00cy1', '0040n', '009J1',
  '00BCa', '00Bul', '00Tya', '00Af3', '00OCQ', '014p4', '01485', '008tL', '007eS', 'zziK6',
];
// Every fixture puzzle tagged `fork`, repeated to keep the queue deep.
const FORK_QUEUE = ['00BJm', '005nD', '00Aas', 'zzwh6', 'zziK6', 'zzoM1', 'zzYOH', '00BJm', '005nD', '00Aas', 'zzwh6', 'zziK6', 'zzoM1', 'zzYOH'];

type Move = [correct: boolean, responseMs: number];
const STRONG: Move[] = [[true, 3000], [true, 3500], [true, 4200], [true, 2500], [true, 5000], [false, 9000], [true, 3800], [true, 4100]];
const WEAK: Move[] = [[false, 14000], [true, 13000], [false, 8000], [false, 6000], [true, 12500], [false, 15000]];
const MIXED: Move[] = [[true, 6000], [false, 7000], [true, 4000], [true, 8000], [false, 3000], [true, 11000], [true, 5000]];

type SessionSpec = {
  style: TrainingStyle;
  mode?: 'mixed' | 'theme';
  theme?: string;
  startRating?: number;
  durationSec?: number;
  queue?: string[];
  moves: Move[];
  finish: { full: boolean; save?: boolean; localDate?: string };
};

describe('rating transcript (golden)', () => {
  let t: TestApp;
  let n = 0;

  beforeAll(async () => {
    t = await bootTestApp();
    await resetDatabase(t.prisma, t.redis);
  });
  afterAll(async () => { await t?.close(); });

  async function newUser(opts: Parameters<typeof createUser>[1]['styles'] = {}, extra: Partial<Parameters<typeof createUser>[1]> = {}) {
    n += 1;
    const u = await createUser(t.prisma, { nickname: `tr_${n}`, styles: opts, ...extra });
    return { ...u, token: tokenFor(t.jwt, u) };
  }

  async function progression(userId: string, style: TrainingStyle) {
    const p = await t.prisma.userStyleProgression.findUniqueOrThrow({ where: { userId_style: { userId, style } } });
    const { userId: _u, updatedAt: _t, style: _s, ...rest } = p;
    return rest;
  }

  async function play(user: { id: string; token: string }, spec: SessionSpec) {
    const auth = bearer(user.token);
    const before = await progression(user.id, spec.style);
    const created = await t.http().post('/api/sessions').set(auth).send({
      startRating: spec.startRating ?? 1200,
      durationSec: spec.durationSec ?? 60,
      mode: spec.mode ?? 'mixed',
      style: spec.style,
      ...(spec.theme ? { theme: spec.theme } : {}),
    });
    expect(created.status).toBe(201);
    const sid = created.body.sessionId as string;
    const session = await t.prisma.trainingSession.findUniqueOrThrow({ where: { id: sid } });
    await primeQueue(t.redis, sid, spec.queue ?? MIXED_QUEUE);

    const attempts: Array<Record<string, unknown>> = [];
    for (const [correct, responseMs] of spec.moves) {
      const next = await t.http().post(`/api/sessions/${sid}/next`).set(auth);
      expect(next.status).toBe(201);
      // Distinct createdAt (ms precision) so the 4-attempt window order is unambiguous.
      await sleep(3);
      const att = await t.http().post(`/api/sessions/${sid}/attempt`).set(auth)
        .send({ puzzleId: next.body.puzzle.id, correct, responseMs });
      expect(att.status).toBe(201);
      attempts.push({
        puzzle: `${next.body.puzzle.id}@${next.body.puzzle.rating}`,
        servedAt: next.body.currentRating,
        correct,
        responseMs,
        step: att.body.step,
        newRating: att.body.newRating,
        streak: att.body.streak,
      });
    }

    if (spec.finish.full) await backdateSession(t.prisma, sid, (spec.durationSec ?? 60) + 15);
    const qs = new URLSearchParams();
    if (spec.finish.save === false) qs.set('save', 'false');
    qs.set('localDate', spec.finish.localDate ?? '2026-10-20');
    const fin = await t.http().post(`/api/sessions/${sid}/finish?${qs}`).set(auth);
    expect(fin.status).toBe(201);
    const { sessionId: _sid, ...finish } = fin.body;
    return {
      sessionStartRating: session.startRating,
      firstPuzzleServedAt: created.body.firstPuzzle?.currentRating ?? null,
      progressionBefore: before,
      attempts,
      finish,
      progressionAfter: await progression(user.id, spec.style),
    };
  }

  it('calibration: fresh blitz account, strong full session', async () => {
    const u = await newUser();
    expect(await play(u, { style: 'blitz', moves: STRONG, finish: { full: true } })).toMatchSnapshot();
  });

  it('calibration: fresh bullet account, weak full session (floor clamp)', async () => {
    const u = await newUser();
    expect(await play(u, { style: 'bullet', moves: WEAK, finish: { full: true } })).toMatchSnapshot();
  });

  it('calibration: client startRating is ignored, server uses currentPuzzleRating', async () => {
    const u = await newUser({ blitz: { currentPuzzleRating: 1250, calibrationSessionsLeft: 2 } });
    expect(await play(u, { style: 'blitz', startRating: 2400, moves: MIXED, finish: { full: true } })).toMatchSnapshot();
  });

  it('stable at peak: strong session unlocks +50', async () => {
    const u = await newUser({ blitz: { calibrationSessionsLeft: 0 } });
    expect(await play(u, { style: 'blitz', moves: STRONG, finish: { full: true } })).toMatchSnapshot();
  });

  it('stable at peak: second weak session demotes -25', async () => {
    const u = await newUser({ blitz: { calibrationSessionsLeft: 0, unlockedStartRating: 1250, weakSessionStreak: 1 } });
    expect(await play(u, { style: 'blitz', moves: WEAK, finish: { full: true } })).toMatchSnapshot();
  });

  it('stable at peak: demote clamped by startPuzzleRating (B8 baseline)', async () => {
    const u = await newUser({ blitz: { calibrationSessionsLeft: 0, unlockedStartRating: 1200, weakSessionStreak: 1 } });
    expect(await play(u, { style: 'blitz', moves: WEAK, finish: { full: true } })).toMatchSnapshot();
  });

  it('stable comfort zone: weak session leaves the weak streak alone', async () => {
    const u = await newUser({ rapid: { calibrationSessionsLeft: 0, unlockedStartRating: 1400, weakSessionStreak: 1 } });
    expect(await play(u, { style: 'rapid', durationSec: 300, moves: WEAK, finish: { full: true } })).toMatchSnapshot();
  });

  it('early exit: saved, but no unlock / calibration change', async () => {
    const u = await newUser();
    expect(await play(u, { style: 'blitz', moves: STRONG, finish: { full: false } })).toMatchSnapshot();
  });

  it('discard: rating and review queue roll back', async () => {
    const u = await newUser({ blitz: { calibrationSessionsLeft: 0 } });
    const r = await play(u, { style: 'blitz', moves: MIXED, finish: { full: false, save: false } });
    expect(r.finish).toEqual({ discarded: true });
    expect(r.progressionAfter).toEqual(r.progressionBefore);
    expect(await t.prisma.reviewItem.count({ where: { userId: u.id } })).toBe(0);
    expect(r).toMatchSnapshot();
  });

  it('theme session: unrated, progression untouched', async () => {
    const u = await newUser({ bullet: { calibrationSessionsLeft: 0, currentPuzzleRating: 1300 } });
    const r = await play(u, { style: 'bullet', mode: 'theme', theme: 'fork', queue: FORK_QUEUE, moves: MIXED, finish: { full: true } });
    expect(r.progressionAfter).toEqual(r.progressionBefore);
    expect(r).toMatchSnapshot();
  });

  it('daily streak across finishes (started / same-day / continued / frozen / reset / regen)', async () => {
    const u = await newUser();
    const days = ['2026-10-01', '2026-10-01', '2026-10-02', '2026-10-04', '2026-10-07', '2026-10-06', '2026-10-12', '2026-10-14', 'garbage'];
    const out: unknown[] = [];
    for (const d of days) {
      const created = await t.http().post('/api/sessions').set(bearer(u.token))
        .send({ startRating: 1200, durationSec: 60, mode: 'mixed', style: 'blitz' });
      const fin = await t.http().post(`/api/sessions/${created.body.sessionId}/finish?localDate=${d}`).set(bearer(u.token));
      out.push({ localDate: d, streak: fin.body.streak });
    }
    expect(out).toMatchSnapshot();
  });
});
