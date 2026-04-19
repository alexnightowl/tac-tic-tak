import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { ReviewService } from './review.service';

@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get()
  list(@CurrentUser() u: AuthedUser) {
    return this.review.list(u.id);
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
