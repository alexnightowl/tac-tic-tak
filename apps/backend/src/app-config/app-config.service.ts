import { Injectable, Logger } from '@nestjs/common';
import { AppConfig, loadAppConfig } from './app-config';

/** Holds the env-derived mobile config (read once, when the module is instantiated). */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger('AppConfig');
  readonly config: AppConfig;

  constructor() {
    this.config = loadAppConfig(process.env, (m) => this.logger.warn(m));
  }
}
