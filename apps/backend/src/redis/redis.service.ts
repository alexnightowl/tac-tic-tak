import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client!: Redis;

  onModuleInit() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
