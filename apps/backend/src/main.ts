import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Raise body limit so base64-encoded avatar uploads fit.
  app.useBodyParser('json', { limit: '6mb' });

  // Serve uploaded files (avatars, etc) from /uploads.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`API listening on :${port}`, 'Bootstrap');
}

bootstrap();
