import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  overview(@CurrentUser() u: AuthedUser, @Query('style') style?: string) {
    return this.analytics.overview(u.id, style);
  }

  @Get('themes')
  themes(@CurrentUser() u: AuthedUser, @Query('style') style?: string) {
    return this.analytics.themes(u.id, style);
  }

  @Get('recommendations')
  recommendations(@CurrentUser() u: AuthedUser, @Query('style') style?: string) {
    return this.analytics.recommendations(u.id, style);
  }

  @Get('timeline')
  timeline(
    @CurrentUser() u: AuthedUser,
    @Query('style') style?: string,
    @Query('days') days?: string,
  ) {
    const n = days ? Math.min(Math.max(parseInt(days, 10) || 0, 1), 730) : 365;
    return this.analytics.timeline(u.id, style, n);
  }
}
