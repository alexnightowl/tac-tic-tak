import { Module } from '@nestjs/common';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [PuzzlesModule],
  providers: [SessionsService],
  controllers: [SessionsController],
})
export class SessionsModule {}
