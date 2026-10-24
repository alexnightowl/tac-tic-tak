import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { PuzzlesService } from './puzzles.service';

@UseGuards(JwtAuthGuard)
@Controller('puzzles')
export class PuzzlesController {
  constructor(private readonly puzzles: PuzzlesService) {}

  // Read-only view of a puzzle the user has already attempted (opened
  // from a session's attempt list).
  @Get(':puzzleId')
  get(@CurrentUser() u: AuthedUser, @Param('puzzleId') id: string) {
    return this.puzzles.getAttempted(u.id, id);
  }
}
