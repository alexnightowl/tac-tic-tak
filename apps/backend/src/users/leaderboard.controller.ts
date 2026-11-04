import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { LeaderboardService } from './leaderboard.service';
import { isTrainingStyle, TrainingStyle } from '../sessions/unlock';

@UseGuards(JwtAuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly board: LeaderboardService) {}

  @Get()
  top(
    @CurrentUser() u: AuthedUser,
    @Query('style') style: string,
    @Query('scope') scope?: string,
    @Query('limit') limit?: string,
    @Query('period') period?: string,
  ) {
    const s: TrainingStyle = isTrainingStyle(style) ? style : 'blitz';
    const sc = scope === 'friends' ? 'friends' : 'global';
    const lim = limit ? Number(limit) : undefined;
    // period=week: the weekly XP league (mobile); without it, today's rating board (web).
    if (period === 'week') return this.board.weekly(u.id, { scope: sc, limit: lim });
    return this.board.topByStyle(s, { viewerId: u.id, scope: sc, limit: lim });
  }
}
