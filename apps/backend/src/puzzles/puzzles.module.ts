import { Module } from '@nestjs/common';
import { PuzzlesService } from './puzzles.service';
import { PuzzleBufferService } from './puzzle-buffer.service';
import { PuzzlesController } from './puzzles.controller';

@Module({
  providers: [PuzzlesService, PuzzleBufferService],
  controllers: [PuzzlesController],
  exports: [PuzzlesService, PuzzleBufferService],
})
export class PuzzlesModule {}
