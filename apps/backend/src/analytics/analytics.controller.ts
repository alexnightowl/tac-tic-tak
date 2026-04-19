import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  overview(@CurrentUser() u: AuthedUser) {
    return this.analytics.overview(u.id);
  }

  @Get('themes')
  themes(@CurrentUser() u: AuthedUser) {
    return this.analytics.themes(u.id);
  }

  @Get('recommendations')
  recommendations(@CurrentUser() u: AuthedUser) {
    return this.analytics.recommendations(u.id);
  }
}
