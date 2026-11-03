import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { StormService } from './storm.service';
import { ChallengeCreateDto, StormRunDto, StreamDto, SummaryQueryDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('storm')
export class StormController {
  constructor(private readonly storm: StormService) {}

  @Post('streams')
  @HttpCode(200)
  stream(@CurrentUser() u: AuthedUser, @Body() dto: StreamDto) {
    return this.storm.stream(u.id, dto.challengeId);
  }

  @Get('streams/:id')
  streamById(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.storm.streamById(u.id, id);
  }

  @Post('runs')
  @HttpCode(200)
  run(@CurrentUser() u: AuthedUser, @Body() dto: StormRunDto) {
    return this.storm.saveRun(u.id, dto);
  }

  @Get('summary')
  summary(@CurrentUser() u: AuthedUser, @Query() q: SummaryQueryDto) {
    return this.storm.summary(u.id, q.tzOffsetMin ?? 0);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly storm: StormService) {}

  @Post()
  @HttpCode(200)
  create(@CurrentUser() u: AuthedUser, @Body() dto: ChallengeCreateDto) {
    return this.storm.create(u.id, dto);
  }

  @Get()
  list(@CurrentUser() u: AuthedUser) {
    return this.storm.list(u.id);
  }

  @Get(':id')
  detail(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.storm.detail(u.id, id);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.storm.decline(u.id, id);
  }
}
