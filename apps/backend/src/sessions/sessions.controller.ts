import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { SessionsService } from './sessions.service';
import { AttemptDto, CreateSessionDto, NextDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(@CurrentUser() u: AuthedUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(u.id, dto);
  }

  // Declared before the ':id' routes so 'active' is not read as an id.
  @Get('active')
  active(@CurrentUser() u: AuthedUser) {
    return this.sessions.active(u.id);
  }

  @Post(':id/next')
  next(@CurrentUser() u: AuthedUser, @Param('id') id: string, @Body() dto: NextDto) {
    return this.sessions.next(u.id, id, { requestId: dto?.requestId, mobile: dto?.client === 'mobile' });
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
    // Mobile only (the web sends neither): IANA zone, and client=mobile
    // to get `progression` back.
    @Query('tz') tz?: string,
    @Query('client') client?: string,
  ) {
    return this.sessions.finish(u.id, id, {
      save: save !== 'false',
      localDate,
      tz,
      mobile: client === 'mobile',
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
