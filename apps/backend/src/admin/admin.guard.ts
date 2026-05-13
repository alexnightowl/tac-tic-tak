import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Stacks on top of the JWT auth pass: re-validates the bearer token,
 * then reads `isAdmin` from the DB. We re-query rather than trusting
 * a claim in the JWT so an admin demotion takes effect immediately
 * (existing tokens stop opening the door the moment the flag flips).
 */
@Injectable()
export class AdminGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(ctx)) as boolean;
    if (!ok) return false;
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.id as string | undefined;
    if (!userId) throw new ForbiddenException();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) throw new ForbiddenException();
    return true;
  }
}
