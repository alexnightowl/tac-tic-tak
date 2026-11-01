import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { ExperienceService } from './experience.service';

@Controller('users')
export class ExperienceController {
  constructor(private readonly experience: ExperienceService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me/experience')
  mine(@CurrentUser() u: AuthedUser) {
    return this.experience.summary(u.id);
  }
}
