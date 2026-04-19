import { Module } from '@nestjs/common';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [PuzzlesModule],
  providers: [ReviewService],
  controllers: [ReviewController],
})
export class ReviewModule {}
