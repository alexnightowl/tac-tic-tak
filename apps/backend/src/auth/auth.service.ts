import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto, PLATFORMS, RegisterDto } from './dto';
import { accessTokenTtlSec } from './auth.config';
import { DeviceMeta, INVALID_REFRESH, RefreshTokenService } from './refresh-token.service';
import { TokenVersionService } from './token-version.service';
import type { JwtPayload } from './jwt.strategy';

type TokenUser = { id: string; nickname: string; tokenVersion: number };

/** Headers the mobile client sends on every request; used only when the DTO omits the field. */
export type ClientHeaders = { deviceId?: string; platform?: string };

/** Web response, unchanged since before B4. */
export type WebAuthResponse = { token: string; user: { id: string; nickname: string } };
/** client:'mobile' response: the web keys plus refreshToken and expiresIn (access-token seconds). */
export type MobileAuthResponse = WebAuthResponse & { refreshToken: string; expiresIn: number };

@Injectable()
export class AuthService {
  private readonly accessTtlSec = accessTokenTtlSec();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly tokenVersions: TokenVersionService,
  ) {}

  async register(dto: RegisterDto, headers: ClientHeaders = {}) {
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
    return this.issue(user, dto, headers);
  }

  async login(dto: LoginDto, headers: ClientHeaders = {}) {
    const user = await this.prisma.user.findUnique({ where: { nickname: dto.nickname } });
    if (!user) throw new UnauthorizedException('invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalid credentials');
    return this.issue(user, dto, headers);
  }

  /** POST /auth/refresh: rotates the refresh token and returns a fresh mobile pair. */
  async refresh(raw: string): Promise<MobileAuthResponse> {
    const rotated = await this.refreshTokens.rotate(raw);
    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      select: { id: true, nickname: true, tokenVersion: true },
    });
    if (!user) throw new UnauthorizedException(INVALID_REFRESH);
    return this.mobileResponse(user, rotated.familyId, rotated.refreshToken);
  }

  /** POST /auth/logout: ends one device session. Idempotent, unknown tokens included. */
  async logout(raw: string) {
    await this.refreshTokens.revokeByToken(raw);
    return { ok: true };
  }

  /** POST /auth/logout-all: every access token (web included) and every refresh token of the user dies. */
  async logoutAll(userId: string) {
    await this.tokenVersions.bump(userId);
    await this.refreshTokens.revokeAllForUser(userId);
    return { ok: true };
  }

  /**
   * B5: a wrong current password is 403 (was 401, which made the web log
   * the user out on a typo). A successful change revokes the user's other
   * refresh families (the caller's own family, from the access token's
   * `fid`, survives). No tokenVersion bump while the web is alive (B18).
   */
  async changePassword(userId: string, dto: ChangePasswordDto, currentFamilyId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('not authenticated');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new ForbiddenException('current password is incorrect');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('new password must differ from the current one');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.refreshTokens.revokeAllForUser(userId, currentFamilyId);
    return { ok: true };
  }

  private async issue(
    user: TokenUser,
    dto: { client?: string; deviceId?: string; platform?: string },
    headers: ClientHeaders,
  ): Promise<WebAuthResponse | MobileAuthResponse> {
    if (dto.client !== 'mobile') return this.webResponse(user);
    const meta: DeviceMeta = {
      deviceId: dto.deviceId ?? cleanHeader(headers.deviceId, 128),
      platform: dto.platform ?? platformFromHeader(headers.platform),
    };
    const { refreshToken, familyId } = await this.refreshTokens.startFamily(user.id, meta);
    return this.mobileResponse(user, familyId, refreshToken);
  }

  /**
   * Exactly today's web token: {sub, nickname}, module default expiry
   * (JWT_EXPIRES_IN, 7d). Only after a logout-all (tokenVersion > 0) does
   * it also carry `tv`, otherwise the user's next web login would be
   * rejected (a token without tv counts as 0). The web never decodes it.
   */
  private webResponse(user: TokenUser): WebAuthResponse {
    const payload: JwtPayload = { sub: user.id, nickname: user.nickname };
    if (user.tokenVersion > 0) payload.tv = user.tokenVersion;
    return { token: this.jwt.sign(payload), user: { id: user.id, nickname: user.nickname } };
  }

  private mobileResponse(user: TokenUser, familyId: string, refreshToken: string): MobileAuthResponse {
    const payload: JwtPayload = { sub: user.id, nickname: user.nickname, tv: user.tokenVersion, fid: familyId };
    const token = this.jwt.sign(payload, { expiresIn: this.accessTtlSec });
    return { token, refreshToken, expiresIn: this.accessTtlSec, user: { id: user.id, nickname: user.nickname } };
  }
}

function cleanHeader(v: string | undefined, max: number): string | undefined {
  const s = v?.trim();
  return s && s.length <= max ? s : undefined;
}

function platformFromHeader(v: string | undefined): string | undefined {
  const s = v?.trim().toLowerCase();
  return s && (PLATFORMS as readonly string[]).includes(s) ? s : undefined;
}
