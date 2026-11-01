import { Module } from '@nestjs/common';
import { ExperienceModule } from '../experience/experience.module';
import { OfflineModule } from '../offline/offline.module';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';

@Module({
  imports: [ExperienceModule, OfflineModule],
  providers: [LibraryService],
  controllers: [LibraryController],
})
export class LibraryModule {}
