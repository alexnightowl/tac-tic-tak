import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [AnalyticsModule],
  providers: [PlanService],
  controllers: [PlanController],
})
export class PlanModule {}
