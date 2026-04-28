import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_STYLE, TRAINING_STYLES, TrainingStyle } from '../sessions/unlock';
import { promises as fs } from 'fs';
import { join } from 'path';

type StyleRow = {
  startPuzzleRating: number;
  currentPuzzleRating: number;
  unlockedStartRating: number;
  calibrationSessionsLeft: number;
};

const AVATAR_ROOT = join(process.cwd(), 'uploads', 'avatars');
const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB after base64 decode

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      settings: user.settings,
      // Legacy single-style progression — kept for backwards compat until the
      // frontend fully migrates off it.
      progression: user.progression,
      progressions: byStyle,
      defaultStyle: (user.settings?.defaultStyle as TrainingStyle) ?? DEFAULT_STYLE,
    };
  }

  async findByNickname(nickname: string) {
    return this.prisma.user.findUnique({
      where: { nickname },
      select: { id: true, nickname: true },
    });
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
      progressions: byStyle,
      allTimePeak: peak._max.peakRating ?? null,
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
    defaultStyle: string;
    knightArrow: string;
  }>) {
    return this.prisma.userSetting.update({
      where: { userId },
      data: patch,
    });
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
    return updated;
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
    return { avatarUrl: url };
  }

  private mapStyleProgressions(rows: Array<{
    style: string;
    startPuzzleRating: number;
    currentPuzzleRating: number;
    unlockedStartRating: number;
    calibrationSessionsLeft: number;
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
          }
        : {
            startPuzzleRating: 1200,
            currentPuzzleRating: 1200,
            unlockedStartRating: 1200,
            // Style row missing — surface as full calibration window
            // so the UI prompts the user through it on first session.
            calibrationSessionsLeft: 5,
          };
    }
    return out;
  }
}
