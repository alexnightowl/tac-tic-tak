import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthedUser = {
  id: string;
  nickname: string;
  /** Refresh family of a mobile access token (B4); absent for web tokens. Never returned to clients. */
  familyId?: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
