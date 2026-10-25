import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestApplicationOptions, ValidationPipe, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { requireJwtSecret } from './auth/jwt-secret';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { AppConfigService } from './app-config/app-config.service';
import { minBuildGate } from './app-config/min-build.middleware';

/**
 * Builds the HTTP app exactly as production runs it (global prefix,
 * versioning, validation pipe, body limit, static uploads, hardening).
 * Shared by main.ts and the e2e test harness so tests exercise the same
 * pipeline the live web hits. `options` lets tests silence the logger;
 * production passes nothing.
 */
export async function createApp(options: NestApplicationOptions = {}) {
  // Fail fast (B2): no JWT_SECRET means no boot. AppModule is already
  // imported at this point, so ConfigModule has loaded .env.
  requireJwtSecret();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true, ...options });

  // nginx is the single proxy hop in front of the backend: req.ip becomes
  // the client address from X-Forwarded-For (needed by B11 throttling).
  app.set('trust proxy', 1);

  // Security headers. HSTS is owned by nginx (one header, one policy).
  // CORP is cross-origin so avatars under /uploads still load on a page
  // served from another origin (the web dev server on :3000).
  app.use(
    helmet({
      strictTransportSecurity: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // 426 for mobile builds below the minimum; a no-op without X-App-Build (B3).
  app.use(minBuildGate(app.get(AppConfigService).config));

  app.setGlobalPrefix('api');
  // /api/x (VERSION_NEUTRAL, what the web calls) and /api/v1/x (mobile)
  // reach the same handler. A future breaking change goes to a v2 handler.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: [VERSION_NEUTRAL, '1'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new PrismaExceptionFilter(app.getHttpAdapter()));
  // Raise body limit so base64-encoded avatar uploads fit.
  app.useBodyParser('json', { limit: '6mb' });

  // Serve uploaded files (avatars, etc) from /uploads.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // SIGTERM/SIGINT run onModuleDestroy (Prisma $disconnect, Redis quit).
  app.enableShutdownHooks();
  return app;
}
