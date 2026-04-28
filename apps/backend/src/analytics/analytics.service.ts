import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ThemeRow = {
  slug: string;
  attempts: number;
  failures: number;
  avgResponseMs: number;
  failureRate: number;
  weakness: number;
  /** Best puzzle rating the user has SOLVED within this theme — proxy for strength. */
  rating: number;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string) {
    const sessions = await this.prisma.trainingSession.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    // Lifetime aggregates — separate from the take-20 window so they
    // cover every session/attempt the user has ever played. Three
    // cheap queries: total attempt count, solved-only count (Prisma
    // can't SUM a Bool, so use count with where), and peak/session
    // count from finished sessions.
    const [totalAttempts, solvedAttempts, sessionAgg] = await Promise.all([
      this.prisma.trainingAttempt.count({ where: { userId } }),
      this.prisma.trainingAttempt.count({ where: { userId, correct: true } }),
      this.prisma.trainingSession.aggregate({
        where: { userId, endedAt: { not: null } },
        _max: { peakRating: true },
        _count: true,
      }),
    ]);
    const lifetime = {
      solved: solvedAttempts,
      attempts: totalAttempts,
      accuracy: totalAttempts > 0 ? solvedAttempts / totalAttempts : 0,
      peakRating: sessionAgg._max.peakRating ?? 0,
      sessions: sessionAgg._count,
    };

    const lastSession = sessions[0];
    const allTimePeak = lifetime.peakRating;

    // Time-bucket analytics for the most recent session.
    let buckets: Record<string, { attempts: number; accuracy: number; avgResponseMs: number }> = {};
    if (lastSession) {
      const attempts = await this.prisma.trainingAttempt.findMany({
        where: { sessionId: lastSession.id },
        orderBy: { createdAt: 'asc' },
      });
      const started = lastSession.startedAt.getTime();
      const groups: Record<string, typeof attempts> = { '0-3': [], '3-6': [], '6-10': [] };
      for (const a of attempts) {
        const mins = (a.createdAt.getTime() - started) / 60_000;
        const key = mins < 3 ? '0-3' : mins < 6 ? '3-6' : '6-10';
        groups[key].push(a);
      }
      for (const [k, arr] of Object.entries(groups)) {
        const correct = arr.filter((a) => a.correct).length;
        buckets[k] = {
          attempts: arr.length,
          accuracy: arr.length ? correct / arr.length : 0,
          avgResponseMs: arr.length ? Math.round(arr.reduce((s, a) => s + a.responseMs, 0) / arr.length) : 0,
        };
      }
    }

    return {
      recentSessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        solved: s.solvedCount,
        failed: s.failedCount,
        accuracy: s.accuracy,
        avgResponseMs: s.avgResponseMs,
        peakRating: s.peakRating,
        startRating: s.startRating,
        durationSec: s.durationSec,
        mode: s.mode,
        theme: s.theme,
      })),
      allTimePeak,
      lastSessionBuckets: buckets,
      lifetime,
    };
  }

  async themes(userId: string): Promise<ThemeRow[]> {
    // Aggregate attempts by theme via SQL.
    const rows = await this.prisma.$queryRaw<Array<{
      slug: string;
      attempts: bigint;
      failures: bigint;
      avg_ms: number | null;
      rating: number | null;
    }>>`
      SELECT t."slug",
             COUNT(*)::bigint AS attempts,
             SUM(CASE WHEN a."correct" THEN 0 ELSE 1 END)::bigint AS failures,
             AVG(a."responseMs")::float AS avg_ms,
             -- 90th-percentile rating of SOLVED attempts within the theme
             COALESCE(
               PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY a."puzzleRating")
                 FILTER (WHERE a."correct"),
               0
             )::int AS rating
      FROM "TrainingAttempt" a
      JOIN "PuzzleTheme" pt ON pt."puzzleId" = a."puzzleId"
      JOIN "Theme" t ON t."id" = pt."themeId"
      WHERE a."userId" = ${userId}
      GROUP BY t."slug"
      HAVING COUNT(*) >= 3
      ORDER BY attempts DESC
    `;

    // Derive weakness = 0.7 * failureRate + 0.3 * speedPenalty.
    const maxAvg = Math.max(1, ...rows.map((r) => r.avg_ms ?? 0));
    return rows.map((r) => {
      const attempts = Number(r.attempts);
      const failures = Number(r.failures);
      const failureRate = attempts === 0 ? 0 : failures / attempts;
      const avgMs = r.avg_ms ?? 0;
      const speedPenalty = avgMs / maxAvg; // 0..1
      return {
        slug: r.slug,
        attempts,
        failures,
        avgResponseMs: Math.round(avgMs),
        failureRate,
        weakness: 0.7 * failureRate + 0.3 * speedPenalty,
        rating: r.rating ?? 0,
      };
    });
  }

  async recommendations(userId: string) {
    const themes = await this.themes(userId);
    const ranked = themes.slice().sort((a, b) => b.weakness - a.weakness);
    const weakest = ranked[0];
    if (!weakest) return { theme: null, reason: 'play more sessions to get recommendations' };
    return {
      theme: weakest.slug,
      reason: `highest weakness score (${(weakest.weakness * 100).toFixed(0)}%): failure rate ${(weakest.failureRate * 100).toFixed(0)}%, avg ${weakest.avgResponseMs}ms`,
    };
  }
}
