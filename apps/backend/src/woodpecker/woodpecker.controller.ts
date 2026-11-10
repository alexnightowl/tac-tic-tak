import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { CreateWoodpeckerSetDto } from './dto';
import { WoodpeckerService } from './woodpecker.service';

@UseGuards(JwtAuthGuard)
@Controller('woodpecker')
export class WoodpeckerController {
  constructor(private readonly woodpecker: WoodpeckerService) {}

  @Post('sets')
  create(@CurrentUser() u: AuthedUser, @Body() dto: CreateWoodpeckerSetDto) {
    return this.woodpecker.create(u.id, dto);
  }

  @Get('sets')
  list(@CurrentUser() u: AuthedUser) {
    return this.woodpecker.list(u.id);
  }

  @Get('sets/:id')
  get(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.woodpecker.get(u.id, id);
  }

  /** Ends a "book" set's first cycle now: the set is what it got through. */
  @Post('sets/:id/close')
  close(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.woodpecker.close(u.id, id);
  }

  @Delete('sets/:id')
  archive(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.woodpecker.archive(u.id, id);
  }
}
