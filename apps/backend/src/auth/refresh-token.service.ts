import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { refreshTokenTtlDays } from './auth.config';

export type DeviceMeta = { deviceId?: string | null; platform?: string | null };

export type IssuedRefresh = { refreshToken: string; familyId: string; userId: string };

/** The single error for every refresh failure (unknown, revoked, reused, expired): nothing to probe. */
export const INVALID_REFRESH = 'invalid refresh token';

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Rotated/revoked rows are kept this long for reuse detection, then
 * pruned. Replaying an older one is still rejected (unknown token), it
 * just no longer revokes the family.
 */
export const REVOKED_RETENTION_DAYS = 30;

/** SHA-256 hex digest: the only form in which a refresh token is stored. */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * Mobile refresh tokens (B4). A login starts a *family* (one per device
 * session); each refresh rotates the token inside its family. Presenting
 * a token that was already rotated or revoked is treated as theft and
 * revokes the whole family.
 */
@Injectable()
export class RefreshTokenService {
  private readonly log = new Logger(RefreshTokenService.name);
  private readonly ttlMs = refreshTokenTtlDays() * DAY_MS;

  constructor(private readonly prisma: PrismaService) {}

  /** Opaque 256-bit token, base64url (43 chars). */
  private generate(): string {
    return randomBytes(32).toString('base64url');
  }

  private expiry(now: Date) {
    return new Date(now.getTime() + this.ttlMs);
  }

  private retentionCutoff(now: Date) {
    return new Date(now.getTime() - REVOKED_RETENTION_DAYS * DAY_MS);
  }

  /** New family for a fresh login/register. A re-login on the same deviceId ends that device's previous session. */
  async startFamily(userId: string, meta: DeviceMeta): Promise<IssuedRefresh> {
    const now = new Date();
    // Housekeeping: expired rows can never be used again, and revoked
    // rows only matter for reuse detection within the retention window.
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: this.retentionCutoff(now) } }],
      },
    });
    if (meta.deviceId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, deviceId: meta.deviceId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    const refreshToken = this.generate();
    const familyId = randomUUID();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashRefreshToken(refreshToken),
        deviceId: meta.deviceId ?? null,
        platform: meta.platform ?? null,
        createdAt: now,
        lastUsedAt: now,
        expiresAt: this.expiry(now),
      },
    });
    return { refreshToken, familyId, userId };
  }

  /**
   * Rotates `raw`: revokes it, links it to its successor and returns the
   * successor (sliding expiry). Throws 401 for an unknown, expired or
   * revoked token; a revoked one also revokes its whole family.
   */
  async rotate(raw: string): Promise<IssuedRefresh> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(raw) } });
    if (!row) throw new UnauthorizedException(INVALID_REFRESH);
    const now = new Date();
    if (row.revokedAt) {
      await this.revokeFamily(row.familyId, now);
      this.log.warn(`refresh token reuse: family ${row.familyId} of user ${row.userId} revoked`);
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    if (row.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: now } });
      throw new UnauthorizedException(INVALID_REFRESH);
    }

    const next = this.generate();
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Conditional claim: of two concurrent refreshes with the same token
      // exactly one sees revokedAt null; the loser is handled as reuse.
      const claim = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now },
      });
      if (claim.count !== 1) return false;
      const successor = await tx.refreshToken.create({
        data: {
          userId: row.userId,
          familyId: row.familyId,
          tokenHash: hashRefreshToken(next),
          deviceId: row.deviceId,
          platform: row.platform,
          createdAt: now,
          lastUsedAt: now,
          expiresAt: this.expiry(now),
        },
      });
      await tx.refreshToken.update({ where: { id: row.id }, data: { replacedById: successor.id } });
      return true;
    });
    if (!rotated) {
      await this.revokeFamily(row.familyId, new Date());
      this.log.warn(`concurrent refresh token reuse: family ${row.familyId} of user ${row.userId} revoked`);
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    // A long-lived family would otherwise grow by one row per rotation.
    await this.prisma.refreshToken.deleteMany({
      where: { familyId: row.familyId, revokedAt: { lt: this.retentionCutoff(now) } },
    });
    return { refreshToken: next, familyId: row.familyId, userId: row.userId };
  }

  /** Logout of one device: revokes the family `raw` belongs to. Unknown tokens are a no-op. */
  async revokeByToken(raw: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(raw) },
      select: { familyId: true },
    });
    if (row) await this.revokeFamily(row.familyId, new Date());
  }

  async revokeFamily(familyId: string, now = new Date()) {
    await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
  }

  /** Revokes every live refresh token of the user, except the family `keepFamilyId` when given. */
  async revokeAllForUser(userId: string, keepFamilyId?: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(keepFamilyId ? { familyId: { not: keepFamilyId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }
}
