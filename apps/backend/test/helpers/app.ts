import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { JwtService } from '@nestjs/jwt';

export type TestApp = {
  app: INestApplication;
  server: App;
  prisma: PrismaService;
  redis: RedisService['client'];
  jwt: JwtService;
  /** Fresh supertest request bound to the in-process server (no port). */
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
};

/**
 * Boots the real AppModule through the same `createApp()` main.ts uses
 * (prefix, ValidationPipe, body limit, static uploads), without listening
 * on a port: supertest drives the http.Server directly.
 */
export async function bootTestApp(): Promise<TestApp> {
  const app = await createApp({ logger: process.env.E2E_VERBOSE ? undefined : ['error', 'warn'] });
  await app.init();
  const server = app.getHttpServer() as App;
  return {
    app,
    server,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService).client,
    jwt: app.get(JwtService),
    http: () => request(server),
    close: () => app.close(),
  };
}

/** Bearer header helper. */
export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
