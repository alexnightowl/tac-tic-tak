import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_STYLE, TRAINING_STYLES, TrainingStyle } from '../sessions/unlock';

type StyleRow = {
  startPuzzleRating: number;
  currentPuzzleRating: number;
  unlockedStartRating: number;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true, progression: true, styleProgressions: true },
    });
    if (!user) throw new NotFoundException();

    // Ensure every style has a row (helpful for accounts created before the
    // per-style table existed).
    const byStyle: Record<TrainingStyle, StyleRow> = {} as any;
    for (const s of TRAINING_STYLES) {
      const row = user.styleProgressions.find((p) => p.style === s);
      byStyle[s] = row
        ? {
            startPuzzleRating: row.startPuzzleRating,
            currentPuzzleRating: row.currentPuzzleRating,
            unlockedStartRating: row.unlockedStartRating,
          }
        : { startPuzzleRating: 1200, currentPuzzleRating: 1200, unlockedStartRating: 1200 };
    }

    return {
      id: user.id,
      nickname: user.nickname,
      settings: user.settings,
      // Legacy single-style progression — kept for backwards compat until the
      // frontend fully migrates off it.
      progression: user.progression,
      progressions: byStyle,
      defaultStyle: (user.settings?.defaultStyle as TrainingStyle) ?? DEFAULT_STYLE,
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
  }>) {
    return this.prisma.userSetting.update({
      where: { userId },
      data: patch,
    });
  }
}
