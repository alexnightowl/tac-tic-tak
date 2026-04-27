import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { ReviewService } from './review.service';

@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get()
  list(@CurrentUser() u: AuthedUser, @Query('theme') theme?: string) {
    return this.review.list(u.id, theme);
  }

  @Get('themes')
  themes(@CurrentUser() u: AuthedUser) {
    return this.review.themes(u.id);
  }

  @Get(':puzzleId')
  get(@CurrentUser() u: AuthedUser, @Param('puzzleId') id: string) {
    return this.review.getPuzzle(u.id, id);
  }

  @Post(':puzzleId/resolve')
  resolve(@CurrentUser() u: AuthedUser, @Param('puzzleId') id: string) {
    return this.review.resolve(u.id, id);
  }
}
