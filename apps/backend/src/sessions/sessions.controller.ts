import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { SessionsService } from './sessions.service';
import { AttemptDto, CreateSessionDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

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
  finish(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.sessions.finish(u.id, id);
  }
}
