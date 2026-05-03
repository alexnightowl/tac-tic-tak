import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { AchievementsService } from './achievements.service';

@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /** Catalogue + per-user unlocked state. */
  @Get()
  list(@CurrentUser() u: AuthedUser) {
    return this.achievements.list(u.id);
  }

  /** Re-evaluate now and return the slugs that were newly unlocked.
   *  The frontend calls this on the achievements page mount as a
   *  catch-all in case some write missed its inline trigger. */
  @Post('evaluate')
  async evaluate(@CurrentUser() u: AuthedUser) {
    const newly = await this.achievements.evaluate(u.id);
    return { newly };
  }

  /** Trust-based "I starred the repo" button. Flips the flag and
   *  re-evaluates in one round-trip so the unlock toast fires
   *  immediately. */
  @Post('star-confirm')
  async starConfirm(@CurrentUser() u: AuthedUser) {
    const newly = await this.achievements.confirmStarred(u.id);
    return { newly };
  }
}
