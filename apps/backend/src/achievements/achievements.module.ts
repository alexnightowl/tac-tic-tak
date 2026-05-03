import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';

@Module({
  imports: [PrismaModule],
  providers: [AchievementsService],
  controllers: [AchievementsController],
  exports: [AchievementsService],
})
export class AchievementsModule {}
