import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { planStartRating } from '../sessions/sessions.service';
import { isTrainingStyle, TrainingStyle } from '../sessions/unlock';

// The daily plan (D40): one short session of the player's weakest motif
// themes, per style. Themes come from the same weakness score as the stats
// page for that style (failure rate and slowness, blind sessions left out);
// a theme needs a few attempts before it counts as weak. When the history
// is thin, the plan is topped up with core motifs the player has tried
// least ("new"). Once a plan session started today, today's plan keeps its
// themes. It is done once a plan session ran (nearly) its whole clock: an
// early exit doesn't count.

const PLAN_SIZE = 3;
const MIN_ATTEMPTS = 6;
/** Share of the clock a plan session must have run to count as done. */
const DONE_SHARE = 0.9;

/** Motif themes a plan may hold (no phases, lengths or outcome tags). */
const PLAN_THEMES = new Set([
  'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'deflection', 'attraction',
  'clearance', 'interference', 'intermezzo', 'xRayAttack', 'capturingDefender', 'hangingPiece',
  'trappedPiece', 'sacrifice', 'quietMove', 'defensiveMove', 'backRankMate', 'smotheredMate',
  'mateIn1', 'mateIn2', 'mateIn3', 'exposedKing', 'kingsideAttack', 'promotion', 'advancedPawn',
]);

/** Fill order for players without enough history. */
const FUNDAMENTALS = [
  'fork', 'pin', 'skewer', 'discoveredAttack', 'deflection', 'attraction', 'backRankMate',
  'hangingPiece', 'doubleCheck', 'interference', 'clearance', 'xRayAttack',
];

const PLAN_DURATION: Record<TrainingStyle, number> = { bullet: 180, blitz: 300, rapid: 600 };

export type PlanTheme = { slug: string; attempts: number; accuracy: number | null; reason: 'weak' | 'new' };

@Injectable()
export class PlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async today(userId: string, styleParam?: string, sinceParam?: string) {
    const style: TrainingStyle = styleParam && isTrainingStyle(styleParam) ? styleParam : 'blitz';
    const since = dayStart(sinceParam);

    const [progression, sessions, stats] = await Promise.all([
      this.prisma.userStyleProgression.findUnique({ where: { userId_style: { userId, style } } }),
      this.prisma.trainingSession.findMany({
        where: { userId, style, variant: 'plan', startedAt: { gte: since } },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true, themes: true, startedAt: true, endedAt: true, durationSec: true,
          solvedCount: true, failedCount: true, accuracy: true,
        },
      }),
      this.analytics.themes(userId, style),
    ]);

    const bySlug = new Map(stats.map((t) => [t.slug, t]));
    const describe = (slug: string, reason: PlanTheme['reason']): PlanTheme => {
      const t = bySlug.get(slug);
      return { slug, attempts: t?.attempts ?? 0, accuracy: t ? 1 - t.failureRate : null, reason };
    };

    let themes: PlanTheme[];
    const started = sessions.find((s) => s.themes.length > 0);
    if (started) {
      themes = started.themes.map((slug) => {
        const t = bySlug.get(slug);
        return describe(slug, t && t.attempts >= MIN_ATTEMPTS ? 'weak' : 'new');
      });
    } else {
      const weak = stats
        .filter((t) => PLAN_THEMES.has(t.slug) && t.attempts >= MIN_ATTEMPTS)
        .sort((a, b) => b.weakness - a.weakness)
        .slice(0, PLAN_SIZE)
        .map((t) => describe(t.slug, 'weak'));
      const taken = new Set(weak.map((t) => t.slug));
      const fill = FUNDAMENTALS.filter((slug) => !taken.has(slug))
        .map((slug, i) => ({ slug, i, attempts: bySlug.get(slug)?.attempts ?? 0 }))
        .sort((a, b) => a.attempts - b.attempts || a.i - b.i)
        .slice(0, PLAN_SIZE - weak.length)
        .map((t) => describe(t.slug, 'new'));
      themes = [...weak, ...fill];
    }

    const finished = sessions.find(
      (s) => s.endedAt && s.endedAt.getTime() - s.startedAt.getTime() >= s.durationSec * 1000 * DONE_SHARE,
    );
    return {
      style,
      themes,
      durationSec: PLAN_DURATION[style],
      startRating: planStartRating({
        level: progression?.level ?? null,
        currentPuzzleRating: progression?.currentPuzzleRating ?? 1200,
        unlockedStartRating: progression?.unlockedStartRating ?? 1200,
      }),
      done: !!finished,
      session: finished
        ? { id: finished.id, solved: finished.solvedCount, failed: finished.failedCount, accuracy: finished.accuracy }
        : null,
    };
  }
}

/**
 * The player's local midnight as sent by the app; a missing or odd value
 * (more than two days off) falls back to the UTC midnight.
 */
function dayStart(raw?: string): Date {
  const now = Date.now();
  const at = raw ? Date.parse(raw) : NaN;
  if (Number.isFinite(at) && at <= now && now - at <= 48 * 60 * 60 * 1000) return new Date(at);
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
