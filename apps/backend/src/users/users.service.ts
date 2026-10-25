import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TRAINING_STYLES, TrainingStyle } from '../sessions/unlock';
import { AchievementsService } from '../achievements/achievements.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { promises as fs } from 'fs';
import { join } from 'path';

type StyleRow = {
  startPuzzleRating: number;
  currentPuzzleRating: number;
  unlockedStartRating: number;
  calibrationSessionsLeft: number;
  /** Weak at-peak sessions in a row; WEAK_STREAK_THRESHOLD drops the norm. */
  weakSessionStreak: number;
};

const AVATAR_ROOT = join(process.cwd(), 'uploads', 'avatars');
const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB after base64 decode

@Injectable()
export class UsersService {
  private readonly log = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievements: AchievementsService,
    private readonly analytics: AnalyticsService,
    private readonly redis: RedisService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true, progression: true, styleProgressions: true },
    });
    if (!user) throw new NotFoundException();
    const byStyle = this.mapStyleProgressions(user.styleProgressions);

    return {
      id: user.id,
      nickname: user.nickname,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      country: user.country,
      createdAt: user.createdAt,
      verified: user.verified,
      isAdmin: user.isAdmin,
      settings: user.settings,
      // Legacy single-style progression — kept for backwards compat until the
      // frontend fully migrates off it.
      progression: user.progression,
      progressions: byStyle,
      streak: {
        days: user.streakDays,
        freezes: user.streakFreezes,
        lastDay: user.streakLastDay,
        freezeRegenAt: user.streakFreezeRegenAt,
      },
    };
  }

  async findByNickname(nickname: string) {
    return this.prisma.user.findUnique({
      where: { nickname },
      select: { id: true, nickname: true },
    });
  }

  async publicThemes(nickname: string) {
    const user = await this.prisma.user.findUnique({
      where: { nickname },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('user not found');
    return this.analytics.themes(user.id);
  }

  async publicTimeline(nickname: string) {
    const user = await this.prisma.user.findUnique({
      where: { nickname },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('user not found');
    return this.analytics.timeline(user.id, undefined, 365);
  }

  async publicProfile(nickname: string) {
    const user = await this.prisma.user.findUnique({
      where: { nickname },
      include: { styleProgressions: true },
    });
    if (!user) throw new NotFoundException('user not found');
    const byStyle = this.mapStyleProgressions(user.styleProgressions);

    const recent = await this.prisma.trainingSession.findMany({
      where: { userId: user.id, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true, startedAt: true, durationSec: true, mode: true, style: true, theme: true,
        startRating: true, peakRating: true, accuracy: true, avgResponseMs: true,
        solvedCount: true, failedCount: true,
      },
    });

    const peak = await this.prisma.trainingSession.aggregate({
      where: { userId: user.id, endedAt: { not: null } },
      _max: { peakRating: true },
    });

    return {
      id: user.id,
      nickname: user.nickname,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      country: user.country,
      createdAt: user.createdAt,
      verified: user.verified,
      progressions: byStyle,
      allTimePeak: peak._max.peakRating ?? null,
      streak: {
        days: user.streakDays,
        freezes: user.streakFreezes,
        lastDay: user.streakLastDay,
      },
      recentSessions: recent.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        durationSec: s.durationSec,
        solved: s.solvedCount,
        failed: s.failedCount,
        accuracy: s.accuracy,
        avgResponseMs: s.avgResponseMs,
        peakRating: s.peakRating,
        startRating: s.startRating,
        mode: s.mode,
        style: s.style,
        theme: s.theme,
      })),
    };
  }

  async updateSettings(userId: string, patch: Partial<{
    focusMode: boolean;
    accentColor: string;
    boardTheme: string;
    pieceSet: string;
    soundEnabled: boolean;
    soundPack: string;
    language: string;
    fixedColor: string;
    animationSpeed: string;
    knightArrow: string;
    showStreak: boolean;
    reviewAutoAdvance: boolean;
    mirrorView: boolean;
    onboardingCompleted: boolean;
  }>) {
    const updated = await this.prisma.userSetting.update({
      where: { userId },
      data: patch,
    });
    // Fire-and-forget achievement evaluation — UI doesn't block on
    // it because a settings save shouldn't be slowed down for an
    // audit pass. Toasts will catch up on the next /achievements
    // load if a write somehow misses.
    const newAchievements = await this.achievements.evaluate(userId).catch(() => []);
    return { ...updated, achievementsUnlocked: newAchievements };
  }

  /**
   * Wipes everything tied to the user's *playing history* and resets
   * progressions to the brand-new-account defaults: 1200 ratings,
   * full calibration window, no demote streak, no review queue, no
   * puzzle-history. Keeps the User row itself and UserSetting (theme,
   * sounds, language stay where they were).
   *
   * One transaction so a partial failure can't leave the account in a
   * half-reset state. UserPuzzleHistory and ReviewItem cascade-delete
   * via their userId FKs anyway, but explicit deletes are cheaper than
   * a roundtrip to figure out which rows existed.
   */
  async resetProgress(userId: string) {
    await this.prisma.$transaction([
      this.prisma.trainingAttempt.deleteMany({ where: { userId } }),
      this.prisma.trainingSession.deleteMany({ where: { userId } }),
      this.prisma.userPuzzleHistory.deleteMany({ where: { userId } }),
      this.prisma.reviewItem.deleteMany({ where: { userId } }),
      this.prisma.userStyleProgression.updateMany({
        where: { userId },
        data: {
          startPuzzleRating: 1200,
          currentPuzzleRating: 1200,
          unlockedStartRating: 1200,
          weakSessionStreak: 0,
          calibrationSessionsLeft: 5,
        },
      }),
      this.prisma.userProgression.updateMany({
        where: { userId },
        data: {
          startPuzzleRating: 1200,
          currentPuzzleRating: 1200,
          unlockedStartRating: 1200,
        },
      }),
    ]);
    return { ok: true };
  }

  async updateProfile(userId: string, patch: Partial<{ displayName: string; bio: string; country: string }>) {
    const clean: Partial<{ displayName: string | null; bio: string | null; country: string | null }> = {};
    if ('displayName' in patch) clean.displayName = patch.displayName?.trim() || null;
    if ('bio' in patch) clean.bio = patch.bio?.trim() || null;
    if ('country' in patch) clean.country = patch.country?.toLowerCase() || null;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: clean,
      select: { id: true, displayName: true, bio: true, country: true, avatarUrl: true, nickname: true },
    });
    const newAchievements = await this.achievements.evaluate(userId).catch(() => []);
    return { ...updated, achievementsUnlocked: newAchievements };
  }

  async setAvatar(userId: string, dataUrl: string) {
    const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl);
    if (!match) throw new BadRequestException('invalid data url');
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length === 0) throw new BadRequestException('empty image');
    if (buf.length > MAX_AVATAR_BYTES) {
      throw new BadRequestException(`image too large (${Math.round(buf.length / 1024)}KB)`);
    }

    await fs.mkdir(AVATAR_ROOT, { recursive: true });
    const filename = `${userId}.${ext}`;
    const target = join(AVATAR_ROOT, filename);

    // Clean up previous file with a different extension to avoid stale copies.
    for (const e of ['png', 'jpg', 'webp']) {
      if (e === ext) continue;
      await fs.rm(join(AVATAR_ROOT, `${userId}.${e}`), { force: true });
    }

    await fs.writeFile(target, buf);

    // Cache-bust with mtime so the browser reloads the new avatar.
    const url = `/uploads/avatars/${filename}?v=${Date.now()}`;
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
    const newAchievements = await this.achievements.evaluate(userId).catch(() => []);
    return { avatarUrl: url, achievementsUnlocked: newAchievements };
  }

  /**
   * DELETE /users/me (B10): self-service account deletion, required by
   * the App Store and Google Play. The password must match (403
   * otherwise, the same status B5 gives change-password). Deleting the
   * User row removes every dependent row through the FK cascades
   * (settings, progressions, sessions, attempts, puzzle history, review
   * items, friendships in both directions, achievements); the e2e test
   * asserts that every FK pointing at "User" is ON DELETE CASCADE, so a
   * future model without one fails CI instead of blocking deletion.
   * Models added later (B4 RefreshToken, B15 PushDevice/NotificationLog)
   * must cascade too, or get an explicit delete in this transaction.
   * After the row is gone, the avatar files and the user's Redis
   * puzzle-buffer keys are removed best-effort: a failure there is logged
   * and never turns a completed deletion into an error.
   */
  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException('user not found');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ForbiddenException('password is incorrect');

    // Live sessions are the only ones that may still own a Redis queue
    // (finish clears its buffer); capture them before the cascade.
    const openSessions = await this.prisma.trainingSession.findMany({
      where: { userId, endedAt: null },
      select: { id: true },
    });

    // deleteMany: a concurrent second DELETE that already removed the row
    // is not an error (the first one answered 204).
    await this.prisma.user.deleteMany({ where: { id: userId } });

    await this.removeAvatarFiles(userId);
    try {
      const keys = [
        `user:${userId}:recent`,
        ...openSessions.flatMap((s) => [`session:${s.id}:queue`, `session:${s.id}:seen`]),
      ];
      for (let i = 0; i < keys.length; i += 500) {
        await this.redis.client.del(...keys.slice(i, i + 500));
      }
    } catch (e: unknown) {
      this.log.warn(`account ${userId} deleted; redis cleanup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Removes uploads/avatars/{userId}.* (any extension). */
  private async removeAvatarFiles(userId: string) {
    let names: string[];
    try {
      names = await fs.readdir(AVATAR_ROOT);
    } catch {
      return; // no avatars directory yet
    }
    const prefix = `${userId}.`;
    for (const name of names) {
      if (!name.startsWith(prefix)) continue;
      try {
        await fs.rm(join(AVATAR_ROOT, name), { force: true });
      } catch (e: unknown) {
        this.log.warn(`account ${userId} deleted; could not remove avatar ${name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  private mapStyleProgressions(rows: Array<{
    style: string;
    startPuzzleRating: number;
    currentPuzzleRating: number;
    unlockedStartRating: number;
    calibrationSessionsLeft: number;
    weakSessionStreak: number;
  }>): Record<TrainingStyle, StyleRow> {
    const out: Record<TrainingStyle, StyleRow> = {} as any;
    for (const s of TRAINING_STYLES) {
      const row = rows.find((p) => p.style === s);
      out[s] = row
        ? {
            startPuzzleRating: row.startPuzzleRating,
            currentPuzzleRating: row.currentPuzzleRating,
            unlockedStartRating: row.unlockedStartRating,
            calibrationSessionsLeft: row.calibrationSessionsLeft,
            weakSessionStreak: row.weakSessionStreak,
          }
        : {
            startPuzzleRating: 1200,
            currentPuzzleRating: 1200,
            unlockedStartRating: 1200,
            // Style row missing — surface as full calibration window
            // so the UI prompts the user through it on first session.
            calibrationSessionsLeft: 5,
            weakSessionStreak: 0,
          };
    }
    return out;
  }
}
