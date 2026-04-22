import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

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
    const taken = await this.prisma.user.findUnique({ where: { nickname: dto.nickname } });
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
    const user = await this.prisma.user.findUnique({ where: { nickname: dto.nickname } });
    if (!user) throw new UnauthorizedException('invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalid credentials');
    return this.issueToken(user.id, user.nickname);
  }

  private issueToken(userId: string, nickname: string) {
    const token = this.jwt.sign({ sub: userId, nickname });
    return { token, user: { id: userId, nickname } };
  }
}
