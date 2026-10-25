import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './app.setup';

async function bootstrap() {
  const app = await createApp();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`API listening on :${port}`, 'Bootstrap');
}

bootstrap();
