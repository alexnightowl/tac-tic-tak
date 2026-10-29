import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CachedPuzzle,
  MIN_PLAYS,
  MIN_POPULARITY,
  PuzzleBufferService,
} from '../puzzles/puzzle-buffer.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AchievementsService } from '../achievements/achievements.service';
import { META_THEME_SLUGS } from '../review/review.service';
import {
  MAX_RATING,
  MIN_RATING,
  SessionsService,
  WINDOW,
} from '../sessions/sessions.service';
import { computeRatingStep, deriveSessionStats } from '../sessions/rating';
import { isValidDay } from '../sessions/streak';
import { TrainingStyle } from '../sessions/unlock';
import { OfflineAttemptDto, PackKind, PackQueryDto, SyncDto } from './dto';

const DEFAULT_COUNT: Record<PackKind, number> = {
  level: 50,
  weak: 30,
  mate: 40,
  endgame: 40,
  hard: 30,
};

/** Rating band (relative to the style's current rating) and theme filter per pack kind. */
const PACK_BANDS: Record<PackKind, { lo: number; hi: number; themes?: string[] }> = {
  level: { lo: -100, hi: 100 },
  hard: { lo: 150, hi: 250 },
  weak: { lo: -150, hi: 150 },
  mate: { lo: -200, hi: 200, themes: ['mateIn1', 'mateIn2', 'mateIn3'] },
  endgame: { lo: -150, hi: 150, themes: ['endgame'] },
};

const WEAK_THEME_COUNT = 3;

/** Offline days older than this (vs the server's idea of the user's today) don't touch the streak. */
const STREAK_GRACE_DAYS = 3;

type StreakOutcome = 'same-day' | 'continued' | 'frozen' | 'reset' | 'started' | 'skipped';
/** When several offline days are applied, report the one that matters most to the player. */
const OUTCOME_PRIORITY: StreakOutcome[] = ['reset', 'frozen', 'continued', 'started', 'same-day', 'skipped'];

@Injectable()
export class OfflineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly buffer: PuzzleBufferService,
    private readonly analytics: AnalyticsService,
    private readonly achievements: AchievementsService,
    private readonly sessions: SessionsService,
  ) {}

  async pack(userId: string, q: PackQueryDto) {
    const progression = await this.sessions.styleProgression(userId, q.style);
    const baseRating = progression.currentPuzzleRating;
    const count = q.count ?? DEFAULT_COUNT[q.kind];
    const band = PACK_BANDS[q.kind];

    let themes = band.themes;
    let weakThemes: string[] | undefined;
    if (q.kind === 'weak') {
      weakThemes = await this.weakestThemes(userId, q.style);
      // No theme history yet: the pack degrades to a ±150 mixed pack.
      themes = weakThemes.length > 0 ? weakThemes : undefined;
    }

    const ids = await this.pickPackIds({
      userId,
      min: baseRating + band.lo,
      max: baseRating + band.hi,
      themes,
      count,
    });
    const puzzles: CachedPuzzle[] = await this.buffer.hydrate(ids);

    return {
      kind: q.kind,
      style: q.style,
      generatedAt: new Date(),
      baseRating,
      ...(weakThemes ? { weakThemes } : {}),
      puzzles,
    };
  }

  /** The analytics weakness ranking, tactical themes only (meta tags like "short" make no pack). */
  private async weakestThemes(userId: string, style: TrainingStyle): Promise<string[]> {
    let rows = await this.analytics.themes(userId, style);
    if (rows.length === 0) rows = await this.analytics.themes(userId);
    return rows
      .filter((r) => !META_THEME_SLUGS.has(r.slug))
      .sort((a, b) => b.weakness - a.weakness)
      .slice(0, WEAK_THEME_COUNT)
      .map((r) => r.slug);
  }

  /**
   * Same quality floor and random pick as the session buffer, but the
   * exclusions (everything the user has seen, plus the unresolved review
   * queue) run in SQL since a pack is a one-off, larger pull.
   */
  private async pickPackIds(opts: {
    userId: string;
    min: number;
    max: number;
    themes?: string[];
    count: number;
  }): Promise<string[]> {
    const { userId, min, max, themes, count } = opts;
    const themeFilter = themes && themes.length > 0
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "PuzzleTheme" pt JOIN "Theme" t ON t."id" = pt."themeId"
          WHERE pt."puzzleId" = p."id" AND t."slug" = ANY(${themes}::text[]))`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id"
      FROM "Puzzle" p
      WHERE p."rating" BETWEEN ${min} AND ${max}
        AND p."popularity" >= ${MIN_POPULARITY}
        AND p."nbPlays" >= ${MIN_PLAYS}
        ${themeFilter}
        AND NOT EXISTS (
          SELECT 1 FROM "UserPuzzleHistory" h
          WHERE h."userId" = ${userId} AND h."puzzleId" = p."id")
        AND NOT EXISTS (
          SELECT 1 FROM "ReviewItem" r
          WHERE r."userId" = ${userId} AND r."puzzleId" = p."id" AND r."resolvedAt" IS NULL)
      ORDER BY random()
      LIMIT ${count}
    `;
    return rows.map((r) => r.id);
  }

  async sync(userId: string, dto: SyncDto) {
    const style = dto.style;
    const now = Date.now();
    // Clamp solve times to "now" so a skewed phone clock can't write future history.
    const all = dto.attempts.map((a) => ({
      ...a,
      solvedAtMs: Math.min(Date.parse(a.solvedAt), now),
    }));

    // In-batch duplicates are dropped before the receipt insert; both
    // kinds of duplicate are reported together.
    const seen = new Set<string>();
    const unique = all.filter((a) => (seen.has(a.clientId) ? false : (seen.add(a.clientId), true)));

    const result = await this.prisma.$transaction(
      async (tx) => {
        const fresh = unique.length === 0
          ? new Set<string>()
          : new Set(
              (await tx.$queryRaw<{ clientId: string }[]>`
                INSERT INTO "OfflineAttemptReceipt" ("clientId", "userId")
                SELECT unnest(${unique.map((a) => a.clientId)}::text[]), ${userId}
                ON CONFLICT ("clientId") DO NOTHING
                RETURNING "clientId"
              `).map((r) => r.clientId),
            );
        const todo = unique.filter((a) => fresh.has(a.clientId));

        const puzzleIds = [...new Set(todo.map((a) => a.puzzleId))];
        const puzzles = puzzleIds.length === 0
          ? []
          : await tx.puzzle.findMany({ where: { id: { in: puzzleIds } }, select: { id: true, rating: true } });
        const ratingOf = new Map(puzzles.map((p) => [p.id, p.rating]));
        // Unknown puzzle ids are skipped (receipt kept), never fail the batch.
        const known = todo.filter((a) => ratingOf.has(a.puzzleId));
        const unknownPuzzles = todo.length - known.length;

        const pack = known
          .filter((a) => a.source === 'pack')
          .sort((a, b) => a.solvedAtMs - b.solvedAtMs);
        const review = known.filter((a) => a.source === 'review');

        const packResult = pack.length > 0
          ? await this.applyPack(tx, userId, style, pack, ratingOf)
          : null;

        let reviewResolved = 0;
        for (const a of review) {
          if (!a.correct) continue;
          const r = await tx.reviewItem.updateMany({
            where: { userId, puzzleId: a.puzzleId, resolvedAt: null },
            data: { resolvedAt: new Date(a.solvedAtMs) },
          });
          reviewResolved += r.count;
        }

        return { packResult, reviewResolved, unknownPuzzles, freshCount: fresh.size };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    // Streak runs over every attempt in the batch, duplicates included:
    // applyStreakOnPlay is a no-op for days already counted, so a retried
    // batch whose first run committed but lost its streak tick heals itself.
    const streak = await this.applyStreak(userId, all, dto.tzOffsetMin);
    const achievementsUnlocked = all.length > 0 ? await this.achievements.evaluate(userId) : [];

    const p = result.packResult;
    const ratingBefore = p?.ratingBefore
      ?? (await this.sessions.styleProgression(userId, style)).currentPuzzleRating;
    const ratingAfter = p?.ratingAfter ?? ratingBefore;
    return {
      sessionId: p?.sessionId ?? null,
      style,
      ratingBefore,
      ratingAfter,
      delta: ratingAfter - ratingBefore,
      solved: p?.solved ?? 0,
      total: p?.total ?? 0,
      accuracy: p?.accuracy ?? 0,
      timeMs: p?.timeMs ?? 0,
      mistakesToReview: p?.mistakesToReview ?? 0,
      reviewResolved: result.reviewResolved,
      duplicates: all.length - result.freshCount,
      unknownPuzzles: result.unknownPuzzles,
      streak,
      achievementsUnlocked,
    };
  }

  /**
   * One offline TrainingSession for the batch's pack attempts, rated like
   * the online `attempt` handler steps them (sliding WINDOW + correct-run
   * multiplier, clamped), in solve order. No unlock/demote/calibration.
   */
  private async applyPack(
    tx: Prisma.TransactionClient,
    userId: string,
    style: TrainingStyle,
    pack: (OfflineAttemptDto & { solvedAtMs: number })[],
    ratingOf: Map<string, number>,
  ) {
    await tx.userStyleProgression.upsert({
      where: { userId_style: { userId, style } },
      create: { userId, style },
      update: {},
    });
    // Row lock so a concurrent online attempt can't interleave its step.
    const [locked] = await tx.$queryRaw<{ currentPuzzleRating: number }[]>`
      SELECT "currentPuzzleRating" FROM "UserStyleProgression"
      WHERE "userId" = ${userId} AND "style" = ${style}
      FOR UPDATE
    `;
    const ratingBefore = locked.currentPuzzleRating;

    const rows = pack.map((a) => ({
      correct: a.correct,
      responseMs: a.responseMs,
      puzzleRating: ratingOf.get(a.puzzleId)!,
    }));
    let rating = ratingBefore;
    let run = 0;
    rows.forEach((row, i) => {
      run = row.correct ? run + 1 : 0;
      const window = rows.slice(Math.max(0, i + 1 - WINDOW), i + 1);
      const step = computeRatingStep(rating, window, run);
      rating = Math.max(MIN_RATING, Math.min(MAX_RATING, rating + step));
    });

    const stats = deriveSessionStats(rows, ratingBefore);
    const timeMs = rows.reduce((s, r) => s + r.responseMs, 0);
    const session = await tx.trainingSession.create({
      data: {
        userId,
        mode: 'offline',
        style,
        theme: null,
        startRating: ratingBefore,
        durationSec: Math.round(timeMs / 1000),
        startedAt: new Date(pack[0].solvedAtMs),
        endedAt: new Date(pack[pack.length - 1].solvedAtMs),
        solvedCount: stats.solved,
        failedCount: stats.failed,
        accuracy: stats.accuracy,
        avgResponseMs: stats.avgResponseMs,
        peakRating: stats.peakRating,
      },
    });
    await tx.trainingAttempt.createMany({
      data: pack.map((a, i) => ({
        sessionId: session.id,
        userId,
        puzzleId: a.puzzleId,
        puzzleRating: rows[i].puzzleRating,
        correct: a.correct,
        responseMs: a.responseMs,
        createdAt: new Date(a.solvedAtMs),
      })),
    });

    // UserPuzzleHistory upsert, batched: one row per puzzle, seenCount += plays in this batch.
    const seenPer = new Map<string, { last: number; n: number }>();
    for (const a of pack) {
      const prev = seenPer.get(a.puzzleId);
      seenPer.set(a.puzzleId, {
        last: Math.max(prev?.last ?? 0, a.solvedAtMs),
        n: (prev?.n ?? 0) + 1,
      });
    }
    const hIds = [...seenPer.keys()];
    await tx.$executeRaw`
      INSERT INTO "UserPuzzleHistory" ("userId", "puzzleId", "lastSeenAt", "seenCount")
      SELECT ${userId}, x.pid, x.seen::timestamp(3), x.n
      FROM unnest(
        ${hIds}::text[],
        ${hIds.map((id) => new Date(seenPer.get(id)!.last).toISOString())}::text[],
        ${hIds.map((id) => seenPer.get(id)!.n)}::int[]
      ) AS x(pid, seen, n)
      ON CONFLICT ("userId", "puzzleId") DO UPDATE SET
        "lastSeenAt" = GREATEST("UserPuzzleHistory"."lastSeenAt", EXCLUDED."lastSeenAt"),
        "seenCount" = "UserPuzzleHistory"."seenCount" + EXCLUDED."seenCount"
    `;

    // Misses go to Review: same effect as the online upsert (create, or re-open).
    const missed = [...new Set(pack.filter((a) => !a.correct).map((a) => a.puzzleId))];
    if (missed.length > 0) {
      await tx.reviewItem.createMany({
        data: missed.map((puzzleId) => ({ userId, puzzleId })),
        skipDuplicates: true,
      });
      await tx.reviewItem.updateMany({
        where: { userId, puzzleId: { in: missed }, resolvedAt: { not: null } },
        data: { resolvedAt: null },
      });
    }

    if (rating !== ratingBefore) {
      await tx.userStyleProgression.update({
        where: { userId_style: { userId, style } },
        data: { currentPuzzleRating: rating },
      });
    }

    return {
      sessionId: session.id,
      ratingBefore,
      ratingAfter: rating,
      solved: stats.solved,
      total: rows.length,
      accuracy: stats.accuracy,
      timeMs,
      mistakesToReview: missed.length,
    };
  }

  /**
   * Applies each distinct local day from the last STREAK_GRACE_DAYS
   * (inclusive of today, by the client's tz offset) in ascending order
   * through the same path `finish` uses.
   */
  private async applyStreak(
    userId: string,
    attempts: { localDay: string }[],
    tzOffsetMin: number,
  ) {
    const today = new Date(Date.now() - tzOffsetMin * 60_000).toISOString().slice(0, 10);
    const todayMs = Date.parse(`${today}T00:00:00Z`);
    const days = [...new Set(attempts.map((a) => a.localDay))]
      .filter((d) => {
        if (!isValidDay(d)) return false;
        const age = Math.round((todayMs - Date.parse(`${d}T00:00:00Z`)) / 86_400_000);
        return age >= 0 && age <= STREAK_GRACE_DAYS;
      })
      .sort();

    let last: Awaited<ReturnType<SessionsService['tickStreak']>> = null;
    const outcomes: StreakOutcome[] = [];
    for (const day of days) {
      last = await this.sessions.tickStreak(userId, day);
      if (last) outcomes.push(last.outcome);
    }
    if (!last) {
      const u = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { streakDays: true, streakFreezes: true, streakLastDay: true, streakFreezeRegenAt: true },
      });
      return {
        days: u.streakDays,
        freezes: u.streakFreezes,
        lastDay: u.streakLastDay,
        freezeRegenAt: u.streakFreezeRegenAt,
        outcome: 'skipped' as StreakOutcome,
        daysApplied: [] as string[],
      };
    }
    const outcome = OUTCOME_PRIORITY.find((o) => outcomes.includes(o)) ?? 'skipped';
    return { ...last, outcome, daysApplied: days };
  }
}
