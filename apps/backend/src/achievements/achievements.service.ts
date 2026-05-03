import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACHIEVEMENT_DEFS,
  ACHIEVEMENT_SLUGS,
  AchievementDef,
  AchievementState,
} from './registry';

export type AchievementListItem = {
  slug: string;
  category: AchievementDef['category'];
  icon: string;
  unlocked: boolean;
  unlockedAt: Date | null;
};

@Injectable()
export class AchievementsService {
  private readonly log = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a snapshot of every fact the registry might inspect, in
   * one round of queries. Cheap reads — totals on indexed columns,
   * one settings row, one user row. Adding more achievements means
   * no extra queries unless they introduce a new dimension.
   */
  private async loadState(userId: string): Promise<AchievementState> {
    const [user, sessions, solvedCount, progressions, friendsCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { settings: true },
      }),
      this.prisma.trainingSession.findMany({
        where: { userId, endedAt: { not: null } },
        select: { style: true, peakRating: true },
      }),
      this.prisma.trainingAttempt.count({ where: { userId, correct: true } }),
      this.prisma.userStyleProgression.findMany({
        where: { userId },
        select: {
          style: true,
          calibrationSessionsLeft: true,
          unlockedStartRating: true,
          startPuzzleRating: true,
        },
      }),
      this.prisma.friendship.count({
        where: {
          status: 'accepted',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
    ]);

    if (!user) {
      throw new Error(`user ${userId} not found while evaluating achievements`);
    }

    const styleSet = new Set<string>();
    let bestPeak = 0;
    for (const s of sessions) {
      styleSet.add(s.style);
      if (s.peakRating > bestPeak) bestPeak = s.peakRating;
    }

    return {
      settings: user.settings
        ? {
            accentColor: user.settings.accentColor,
            boardTheme: user.settings.boardTheme,
            pieceSet: user.settings.pieceSet,
            language: user.settings.language,
          }
        : null,
      profile: {
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        country: user.country,
        starredRepo: user.starredRepo,
      },
      totalSessions: sessions.length,
      totalSolved: solvedCount,
      styleSet,
      bestPeakRating: bestPeak,
      progressions,
      streakDays: user.streakDays,
      friendsCount,
    };
  }

  /**
   * Evaluate every achievement against the current state and persist
   * any newly-met ones. Returns the slugs that were unlocked THIS
   * call so the caller (a write endpoint, usually) can surface
   * toasts in the response.
   *
   * Safe to call from any write that might have moved the needle —
   * idempotent (createMany skipDuplicates), cheap (one snapshot per
   * call), no race-condition penalty (a duplicate insert from a
   * concurrent call gets dropped).
   */
  async evaluate(userId: string): Promise<string[]> {
    const state = await this.loadState(userId);
    const eligibleSlugs: string[] = [];
    for (const def of ACHIEVEMENT_DEFS) {
      try {
        if (def.evaluator(state)) eligibleSlugs.push(def.slug);
      } catch (e) {
        this.log.error(`evaluator for ${def.slug} threw: ${e}`);
      }
    }
    if (eligibleSlugs.length === 0) return [];

    // Find which of the eligible ones aren't yet recorded.
    const existing = await this.prisma.userAchievement.findMany({
      where: { userId, slug: { in: eligibleSlugs } },
      select: { slug: true },
    });
    const have = new Set(existing.map((e) => e.slug));
    const newly = eligibleSlugs.filter((s) => !have.has(s));
    if (newly.length === 0) return [];

    await this.prisma.userAchievement.createMany({
      data: newly.map((slug) => ({ userId, slug })),
      skipDuplicates: true,
    });
    return newly;
  }

  /** Full catalogue + per-user unlocked state, for the achievements page. */
  async list(userId: string): Promise<AchievementListItem[]> {
    const rows = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { slug: true, unlockedAt: true },
    });
    const unlockedAt = new Map(rows.map((r) => [r.slug, r.unlockedAt]));
    return ACHIEVEMENT_DEFS.map((d) => ({
      slug: d.slug,
      category: d.category,
      icon: d.icon,
      unlocked: unlockedAt.has(d.slug),
      unlockedAt: unlockedAt.get(d.slug) ?? null,
    }));
  }

  /**
   * Self-attestation that the user starred the GitHub repo. Trust-
   * based — we don't have GitHub OAuth, the user clicks a button on
   * the achievements page. After flipping the flag we re-evaluate so
   * the star-repo achievement unlocks in the same call.
   */
  async confirmStarred(userId: string): Promise<string[]> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { starredRepo: true },
    });
    return this.evaluate(userId);
  }

  /** Slug allow-list, exported in case a caller wants to validate a
   *  client-supplied identifier before passing it on. */
  static readonly KNOWN_SLUGS: ReadonlySet<string> = ACHIEVEMENT_SLUGS;
}
