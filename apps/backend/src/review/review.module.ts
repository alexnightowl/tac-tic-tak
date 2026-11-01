import { Module } from '@nestjs/common';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { ExperienceModule } from '../experience/experience.module';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [PuzzlesModule, ExperienceModule],
  providers: [ReviewService],
  controllers: [ReviewController],
})
export class ReviewModule {}
