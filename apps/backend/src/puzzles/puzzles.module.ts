import { Module } from '@nestjs/common';
import { PuzzlesService } from './puzzles.service';
import { PuzzleBufferService } from './puzzle-buffer.service';

@Module({
  providers: [PuzzlesService, PuzzleBufferService],
  exports: [PuzzlesService, PuzzleBufferService],
})
export class PuzzlesModule {}
