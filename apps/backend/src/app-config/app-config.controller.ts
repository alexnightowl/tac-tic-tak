import { Controller, Get, Header } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

/**
 * GET /api/v1/app-config (B3), public. The app reads it at launch and on
 * foreground to decide on a forced update, maintenance banner and flags.
 * Exempt from the min-build gate so an outdated build can still learn
 * where to update. (Also reachable as /api/app-config: every route is
 * VERSION_NEUTRAL + v1 until B18.)
 */
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get() {
    return this.appConfig.config;
  }
}
