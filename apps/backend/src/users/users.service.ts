import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true, progression: true },
    });
    if (!user) throw new NotFoundException();
    return {
      id: user.id,
      nickname: user.nickname,
      settings: user.settings,
      progression: user.progression,
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
  }>) {
    return this.prisma.userSetting.update({
      where: { userId },
      data: patch,
    });
  }
}
