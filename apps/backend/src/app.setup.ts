import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

/**
 * Builds the HTTP app exactly as production runs it (global prefix,
 * validation pipe, body limit, static uploads). Shared by main.ts and
 * the e2e test harness so tests exercise the same pipeline the live
 * web hits. `options` lets tests silence the logger; production passes
 * nothing.
 */
export async function createApp(options: NestApplicationOptions = {}) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true, ...options });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Raise body limit so base64-encoded avatar uploads fit.
  app.useBodyParser('json', { limit: '6mb' });

  // Serve uploaded files (avatars, etc) from /uploads.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  return app;
}
