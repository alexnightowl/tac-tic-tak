import { Module } from '@nestjs/common';
import { ExperienceModule } from '../experience/experience.module';
import { OfflineModule } from '../offline/offline.module';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { StormService } from './storm.service';
import { ChallengesController, StormController } from './storm.controller';

@Module({
  imports: [ExperienceModule, OfflineModule, PuzzlesModule],
  providers: [StormService],
  controllers: [StormController, ChallengesController],
})
export class StormModule {}
