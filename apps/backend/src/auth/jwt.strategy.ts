import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthedUser } from './current-user.decorator';
import { TokenVersionService } from './token-version.service';

/**
 * Web tokens: {sub, nickname} (plus tv once the user has done a
 * logout-all). Mobile access tokens (B4): also tv and fid (refresh
 * family id, so change-password can keep the caller's own session).
 */
export type JwtPayload = { sub: string; nickname: string; tv?: number; fid?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly tokenVersions: TokenVersionService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthedUser> {
    // A token without tv counts as version 0, so every token issued before
    // a logout-all is rejected. `<` rather than `!==`: a cache value at
    // most 60 s stale must not reject a token minted after the bump.
    const current = await this.tokenVersions.current(payload.sub);
    if (current !== null && (payload.tv ?? 0) < current) {
      throw new UnauthorizedException();
    }
    const user: AuthedUser = { id: payload.sub, nickname: payload.nickname };
    if (typeof payload.fid === 'string') user.familyId = payload.fid;
    return user;
  }
}
