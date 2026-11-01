import { Module } from '@nestjs/common';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ExperienceModule } from '../experience/experience.module';
import { OfflineService } from './offline.service';
import { OfflineController } from './offline.controller';

@Module({
  imports: [PuzzlesModule, AnalyticsModule, AchievementsModule, SessionsModule, ExperienceModule],
  providers: [OfflineService],
  controllers: [OfflineController],
  exports: [OfflineService],
})
export class OfflineModule {}
