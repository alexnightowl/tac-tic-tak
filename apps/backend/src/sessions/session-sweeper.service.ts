import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PuzzleBufferService } from '../puzzles/puzzle-buffer.service';
import { deriveSessionStats } from './rating';

/** How often the sweeper runs (when enabled). */
export const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
/** A session is abandoned once its last activity is older than this. */
export const SWEEP_IDLE_MS = 12 * 60 * 60 * 1000;
/** Redis lock: one sweeper per run across instances; expires before the next run. */
export const SWEEP_LOCK_KEY = 'lock:session-sweeper';
const SWEEP_LOCK_MS = 9 * 60 * 1000;
const BATCH = 100;
const MAX_BATCHES = 20;
const INTERVAL_NAME = 'session-sweeper';

const RELEASE_LUA = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

/**
 * SESSION_SWEEPER_ENABLED=true (or 1) turns the scheduled sweep on.
 * Default off, so merging changes nothing in prod until the owner flips
 * it (PLAN §8 #10 is still a provisional default).
 */
export function sweeperEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.SESSION_SWEEPER_ENABLED ?? '').trim().toLowerCase();
  return v === 'true' || v === '1';
}

export type SweepResult = { deleted: number; finalized: number; failed: number };

/**
 * B7: finalises abandoned sessions (endedAt null, last activity = latest
 * attempt or startedAt older than 12 h). PROVISIONAL policy (PLAN §8 #10,
 * awaiting the owner):
 *   - 0 attempts: the session is deleted (and its Redis buffer cleared);
 *   - otherwise it is saved as an early exit: stats recorded, endedAt =
 *     last activity, and NOTHING else. No unlock / demote / calibration
 *     change, no streak tick, no achievement evaluation (the next real
 *     finish evaluates achievements and toasts them as usual).
 * The per-attempt rating drift already applied stays, exactly like the
 * web's own early exit.
 */
@Injectable()
export class SessionSweeperService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(SessionSweeperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly buffer: PuzzleBufferService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    if (!sweeperEnabled()) return;
    const handle = setInterval(() => {
      this.sweep().catch((e) => this.log.error(`sweep failed: ${e instanceof Error ? e.message : String(e)}`));
    }, SWEEP_INTERVAL_MS);
    this.registry.addInterval(INTERVAL_NAME, handle);
    this.log.log(`session sweeper enabled: every ${SWEEP_INTERVAL_MS / 60000} min, idle > ${SWEEP_IDLE_MS / 3600000} h`);
  }

  onApplicationShutdown() {
    if (this.registry.doesExist('interval', INTERVAL_NAME)) this.registry.deleteInterval(INTERVAL_NAME);
  }

  /**
   * One sweep under the Redis lock. Returns null when another run holds
   * the lock. `now` is injectable for tests.
   */
  async sweep(now: Date = new Date()): Promise<SweepResult | null> {
    const token = randomUUID();
    const got = await this.redis.client.set(SWEEP_LOCK_KEY, token, 'PX', SWEEP_LOCK_MS, 'NX');
    if (got !== 'OK') return null;
    try {
      return await this.sweepUnlocked(now);
    } finally {
      await this.redis.client.eval(RELEASE_LUA, 1, SWEEP_LOCK_KEY, token).catch(() => undefined);
    }
  }

  private async sweepUnlocked(now: Date): Promise<SweepResult> {
    const cutoff = new Date(now.getTime() - SWEEP_IDLE_MS);
    const result: SweepResult = { deleted: 0, finalized: 0, failed: 0 };
    const skip: string[] = [];

    for (let i = 0; i < MAX_BATCHES; i++) {
      const candidates = await this.prisma.trainingSession.findMany({
        where: {
          endedAt: null,
          // Last activity >= startedAt, so this is a cheap necessary condition.
          startedAt: { lt: cutoff },
          attempts: { none: { createdAt: { gte: cutoff } } },
          ...(skip.length ? { id: { notIn: skip } } : {}),
        },
        orderBy: { startedAt: 'asc' },
        take: BATCH,
        select: { id: true, startRating: true, startedAt: true },
      });
      if (candidates.length === 0) break;
      for (const s of candidates) {
        try {
          const outcome = await this.sweepOne(s, cutoff);
          if (outcome === 'deleted') result.deleted++;
          else if (outcome === 'finalized') result.finalized++;
          else skip.push(s.id);
        } catch (e) {
          result.failed++;
          skip.push(s.id);
          this.log.error(`sweep of session ${s.id} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (candidates.length < BATCH) break;
    }

    if (result.deleted || result.finalized || result.failed) {
      this.log.log(`swept abandoned sessions: ${result.deleted} deleted, ${result.finalized} saved as early exit, ${result.failed} failed`);
    }
    return result;
  }

  private async sweepOne(
    s: { id: string; startRating: number; startedAt: Date },
    cutoff: Date,
  ): Promise<'deleted' | 'finalized' | 'skipped'> {
    const attempts = await this.prisma.trainingAttempt.findMany({ where: { sessionId: s.id } });

    if (attempts.length === 0) {
      // Conditional: a finish or a first attempt that raced us wins.
      const r = await this.prisma.trainingSession.deleteMany({
        where: { id: s.id, endedAt: null, attempts: { none: {} } },
      });
      if (r.count === 0) return 'skipped';
      await this.buffer.clearSession(s.id);
      return 'deleted';
    }

    const stats = deriveSessionStats(attempts, s.startRating);
    const lastActivity = attempts.reduce(
      (max, a) => (a.createdAt > max ? a.createdAt : max),
      s.startedAt,
    );
    const r = await this.prisma.trainingSession.updateMany({
      where: { id: s.id, endedAt: null, attempts: { none: { createdAt: { gte: cutoff } } } },
      data: {
        endedAt: lastActivity,
        solvedCount: stats.solved,
        failedCount: stats.failed,
        accuracy: stats.accuracy,
        avgResponseMs: stats.avgResponseMs,
        peakRating: stats.peakRating,
      },
    });
    if (r.count === 0) return 'skipped';
    await this.buffer.clearSession(s.id);
    return 'finalized';
  }
}
