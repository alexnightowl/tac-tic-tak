import { Module } from '@nestjs/common';
import { WoodpeckerController } from './woodpecker.controller';
import { WoodpeckerService } from './woodpecker.service';

@Module({
  providers: [WoodpeckerService],
  controllers: [WoodpeckerController],
})
export class WoodpeckerModule {}
