import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { PlanService } from './plan.service';

@UseGuards(JwtAuthGuard)
@Controller('plan')
export class PlanController {
  constructor(private readonly plan: PlanService) {}

  @Get('today')
  today(@CurrentUser() u: AuthedUser, @Query('style') style?: string, @Query('since') since?: string) {
    return this.plan.today(u.id, style, since);
  }
}
