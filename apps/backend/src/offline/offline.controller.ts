import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { OfflineService } from './offline.service';
import { PackQueryDto, SyncDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('offline')
export class OfflineController {
  constructor(private readonly offline: OfflineService) {}

  @Get('pack')
  pack(@CurrentUser() u: AuthedUser, @Query() q: PackQueryDto) {
    return this.offline.pack(u.id, q);
  }

  @Post('sync')
  @HttpCode(200)
  sync(@CurrentUser() u: AuthedUser, @Body() dto: SyncDto) {
    return this.offline.sync(u.id, dto);
  }
}
