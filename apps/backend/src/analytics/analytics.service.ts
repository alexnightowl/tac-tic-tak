import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hasteMs } from '../sessions/progress';
import { isTrainingStyle, TrainingStyle, TRAINING_STYLES } from '../sessions/unlock';

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

/** Optional per-style filter accepted by every analytics endpoint —
 *  null means "all styles combined" (the default for the page when
 *  the player hasn't picked a tab). */
function styleFilter(style: string | undefined): TrainingStyle | null {
  return style && isTrainingStyle(style) ? style : null;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string, styleParam?: string) {
    const style = styleFilter(styleParam);
    const sessionWhere = {
      userId,
      endedAt: { not: null },
      ...(style ? { style } : {}),
    };
    const attemptWhere = {
      userId,
      ...(style ? { session: { style } } : {}),
    };

    const sessions = await this.prisma.trainingSession.findMany({
      where: sessionWhere,
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    // Lifetime aggregates — separate from the take-20 window so they
    // cover every session/attempt the user has ever played. Three
    // cheap queries: total attempt count, solved-only count (Prisma
    // can't SUM a Bool, so use count with where), and peak/session
    // count from finished sessions.
    const [totalAttempts, solvedAttempts, sessionAgg] = await Promise.all([
      this.prisma.trainingAttempt.count({ where: attemptWhere }),
      this.prisma.trainingAttempt.count({ where: { ...attemptWhere, correct: true } }),
      this.prisma.trainingSession.aggregate({
        where: sessionWhere,
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

    const allTimePeak = lifetime.peakRating;

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
        style: s.style,
        theme: s.theme,
        themes: s.themes,
        variant: s.variant,
      })),
      allTimePeak,
      lifetime,
    };
  }

  async themes(userId: string, styleParam?: string): Promise<ThemeRow[]> {
    const style = styleFilter(styleParam);
    // Aggregate attempts by theme via SQL. Optional join into
    // TrainingSession to filter by training style — only added
    // when the caller asked for it so the All-styles path stays
    // a 3-table query.
    const rows = style
      ? await this.prisma.$queryRaw<Array<{
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
                 COALESCE(
                   PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY a."puzzleRating")
                     FILTER (WHERE a."correct"),
                   0
                 )::int AS rating
          FROM "TrainingAttempt" a
          JOIN "TrainingSession" s ON s."id" = a."sessionId"
          JOIN "PuzzleTheme" pt ON pt."puzzleId" = a."puzzleId"
          JOIN "Theme" t ON t."id" = pt."themeId"
          WHERE a."userId" = ${userId} AND s."style" = ${style}
            AND s."variant" IS DISTINCT FROM 'blind'
          GROUP BY t."slug"
          HAVING COUNT(*) >= 3
          ORDER BY attempts DESC
        `
      : await this.prisma.$queryRaw<Array<{
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
          JOIN "TrainingSession" s ON s."id" = a."sessionId"
          JOIN "PuzzleTheme" pt ON pt."puzzleId" = a."puzzleId"
          JOIN "Theme" t ON t."id" = pt."themeId"
          WHERE a."userId" = ${userId}
            AND s."variant" IS DISTINCT FROM 'blind'
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

  async recommendations(userId: string, styleParam?: string) {
    const themes = await this.themes(userId, styleParam);
    const ranked = themes.slice().sort((a, b) => b.weakness - a.weakness);
    const weakest = ranked[0];
    if (!weakest) return { theme: null, reason: 'play more sessions to get recommendations' };
    return {
      theme: weakest.slug,
      reason: `highest weakness score (${(weakest.weakness * 100).toFixed(0)}%): failure rate ${(weakest.failureRate * 100).toFixed(0)}%, avg ${weakest.avgResponseMs}ms`,
    };
  }

  /**
   * Per-session timeline for the rating-history line chart and the
   * activity heatmap. Returns flat session rows so the client can
   * bucket them locally — important for the heatmap, where "today"
   * is the user's local calendar day, not the server's UTC day.
   */
  async timeline(userId: string, styleParam?: string, days = 365) {
    const style = styleFilter(styleParam);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.trainingSession.findMany({
      where: {
        userId,
        endedAt: { not: null, gte: since },
        ...(style ? { style } : {}),
      },
      orderBy: { endedAt: 'asc' },
      select: {
        id: true,
        endedAt: true,
        style: true,
        mode: true,
        ruleset: true,
        variant: true,
        startRating: true,
        peakRating: true,
        solvedCount: true,
        durationSec: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      endedAt: r.endedAt,
      style: r.style,
      // D39: the level chart plots rated v2 sessions' starts (the level) only.
      mode: r.mode,
      ruleset: r.ruleset,
      variant: r.variant,
      startRating: r.startRating,
      peakRating: r.peakRating,
      solved: r.solvedCount,
      durationSec: r.durationSec,
    }));
  }

  /**
   * Hasty mistakes (D40): wrong attempts whose wrong move came in under
   * the style's haste threshold (hasteMs). Older rows have no mistakeMs;
   * their whole-puzzle time stands in (it can only be longer, so an old
   * row is never counted hasty by mistake). Blind sessions are left out.
   */
  async haste(userId: string, daysParam?: string) {
    const days = clampInt(daysParam, 30, 7, 180);
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const week0 = mondayUtc(now) - 7 * 7 * DAY;
    const since = Math.min(now - 2 * days * DAY, week0);
    const rows = await this.prisma.trainingAttempt.findMany({
      where: {
        userId,
        correct: false,
        createdAt: { gte: new Date(since) },
        session: { OR: [{ variant: null }, { variant: { not: 'blind' } }] },
      },
      select: { createdAt: true, responseMs: true, mistakeMs: true, session: { select: { style: true } } },
    });

    const counts = () => ({ mistakes: 0, hasty: 0 });
    const total = counts();
    const previous = counts();
    const byStyle = new Map<TrainingStyle, ReturnType<typeof counts>>();
    const weeks = Array.from({ length: 8 }, (_, i) => ({ start: week0 + i * 7 * DAY, ...counts() }));
    const add = (c: ReturnType<typeof counts>, hasty: boolean) => {
      c.mistakes += 1;
      if (hasty) c.hasty += 1;
    };
    for (const r of rows) {
      const style = isTrainingStyle(r.session.style) ? r.session.style : 'blitz';
      const hasty = (r.mistakeMs ?? r.responseMs) < hasteMs(style);
      const at = r.createdAt.getTime();
      if (at >= now - days * DAY) {
        add(total, hasty);
        if (!byStyle.has(style)) byStyle.set(style, counts());
        add(byStyle.get(style)!, hasty);
      } else if (at >= now - 2 * days * DAY) {
        add(previous, hasty);
      }
      const w = Math.floor((at - week0) / (7 * DAY));
      if (w >= 0 && w < weeks.length) add(weeks[w], hasty);
    }
    const withShare = (c: ReturnType<typeof counts>) => ({ ...c, share: c.mistakes > 0 ? c.hasty / c.mistakes : 0 });
    return {
      thresholdsMs: Object.fromEntries(TRAINING_STYLES.map((s) => [s, hasteMs(s)])) as Record<TrainingStyle, number>,
      days,
      total: withShare(total),
      previous: withShare(previous),
      byStyle: TRAINING_STYLES.filter((s) => byStyle.has(s)).map((s) => ({ style: s, ...withShare(byStyle.get(s)!) })),
      weeks: weeks.map(({ start, ...c }) => ({ weekStart: new Date(start).toISOString().slice(0, 10), ...withShare(c) })),
    };
  }
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Midnight UTC of the Monday of the week holding `ms`. */
function mondayUtc(ms: number): number {
  const d = new Date(ms);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnight - ((d.getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000;
}
