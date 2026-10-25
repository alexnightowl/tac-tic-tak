import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { SessionsService } from './sessions.service';
import { AttemptDto, CreateSessionDto, ListSessionsQueryDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /**
   * The caller's finished sessions, newest first, cursor-paginated (B9).
   * New route: the web never calls GET /sessions (it reads the latest 20
   * from /analytics), so this changes nothing for it.
   */
  @Get()
  list(@CurrentUser() u: AuthedUser, @Query() q: ListSessionsQueryDto) {
    return this.sessions.list(u.id, q);
  }

  @Post()
  create(@CurrentUser() u: AuthedUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(u.id, dto);
  }

  @Post(':id/next')
  next(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.sessions.next(u.id, id);
  }

  @Post(':id/attempt')
  attempt(@CurrentUser() u: AuthedUser, @Param('id') id: string, @Body() dto: AttemptDto) {
    return this.sessions.attempt(u.id, id, dto);
  }

  @Post(':id/finish')
  finish(
    @CurrentUser() u: AuthedUser,
    @Param('id') id: string,
    @Query('save') save?: string,
    @Query('localDate') localDate?: string,
  ) {
    return this.sessions.finish(u.id, id, {
      save: save !== 'false',
      localDate,
    });
  }

  @Get(':id')
  detail(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.sessions.detail(u.id, id);
  }

  @Get(':id/review-items')
  reviewItems(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.sessions.reviewItems(u.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.sessions.remove(u.id, id);
  }
}
