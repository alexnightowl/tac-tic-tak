import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean, IsHexColor, IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';

class UpdateSettingsDto {
  @IsOptional() @IsBoolean() focusMode?: boolean;
  @IsOptional() @IsHexColor() accentColor?: string;
  @IsOptional() @IsString() boardTheme?: string;
  @IsOptional() @IsString() pieceSet?: string;
  @IsOptional() @IsBoolean() soundEnabled?: boolean;
  @IsOptional() @IsString() soundPack?: string;
  @IsOptional() @IsIn(['en', 'uk']) language?: string;
  @IsOptional() @IsIn(['auto', 'white', 'black']) fixedColor?: string;
  @IsOptional() @IsIn(['instant', 'fast', 'normal', 'slow']) animationSpeed?: string;
  @IsOptional() @IsIn(['bullet', 'blitz', 'rapid']) defaultStyle?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() u: AuthedUser) {
    return this.users.getProfile(u.id);
  }

  @Patch('me/settings')
  updateSettings(@CurrentUser() u: AuthedUser, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(u.id, dto);
  }
}
