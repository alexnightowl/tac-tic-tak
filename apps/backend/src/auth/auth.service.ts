import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.password !== dto.repeatPassword) {
      throw new BadRequestException('passwords do not match');
    }
    // "Alex" and "alex" would be indistinguishable at a case-insensitive login.
    const taken = await this.prisma.user.findFirst({
      where: { nickname: { equals: dto.nickname, mode: 'insensitive' } },
      select: { id: true },
    });
    if (taken) throw new BadRequestException('nickname already taken');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nickname: dto.nickname,
        passwordHash,
        settings: { create: dto.language ? { language: dto.language } : {} },
        progression: { create: {} },
        styleProgressions: {
          create: [
            { style: 'bullet' },
            { style: 'blitz' },
            { style: 'rapid' },
          ],
        },
      },
    });
    return this.issueToken(user.id, user.nickname);
  }

  async login(dto: LoginDto) {
    const user = await this.findForLogin(dto.nickname.trim());
    if (!user) throw new UnauthorizedException('invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalid credentials');
    return this.issueToken(user.id, user.nickname);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('not authenticated');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('current password is incorrect');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('new password must differ from the current one');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }

  /**
   * The nickname as typed, then any casing of it. Accounts registered before
   * the case-insensitive check may differ only in case: the exact spelling
   * wins, and an ambiguous casing matches nobody.
   */
  private async findForLogin(nickname: string) {
    const exact = await this.prisma.user.findUnique({ where: { nickname } });
    if (exact) return exact;
    const matches = await this.prisma.user.findMany({
      where: { nickname: { equals: nickname, mode: 'insensitive' } },
      take: 2,
    });
    return matches.length === 1 ? matches[0] : null;
  }

  private issueToken(userId: string, nickname: string) {
    const token = this.jwt.sign({ sub: userId, nickname });
    return { token, user: { id: userId, nickname } };
  }
}
