import { Module } from '@nestjs/common';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [PuzzlesModule, AchievementsModule],
  providers: [SessionsService],
  controllers: [SessionsController],
})
export class SessionsModule {}
