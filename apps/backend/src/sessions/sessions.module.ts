import { Module } from '@nestjs/common';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [PuzzlesModule, AchievementsModule],
  providers: [SessionsService, IdempotencyService],
  controllers: [SessionsController],
})
export class SessionsModule {}
