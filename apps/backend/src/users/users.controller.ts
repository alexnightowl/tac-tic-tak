import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsHexColor, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { FriendshipService } from './friendship.service';

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
  @IsOptional() @IsIn(['bent', 'straight']) knightArrow?: string;
}

class UpdateProfileDto {
  // Empty string is accepted as "clear this field" (users.service converts
  // it to null). Min-length was the old cause of the infamous
  // "displayName must be longer than or equal to 1 characters" error
  // when someone wanted to change only the country code.
  @IsOptional() @IsString() @MaxLength(40)
  displayName?: string;

  @IsOptional() @IsString() @MaxLength(280)
  bio?: string;

  @IsOptional() @IsString() @Matches(/^([a-z]{2})?$/i, { message: 'country must be a 2-letter code or empty' })
  country?: string;
}

class UploadAvatarDto {
  @IsString() @Matches(/^data:image\/(png|jpeg|webp);base64,/, { message: 'unsupported image format' })
  dataUrl!: string;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly friends: FriendshipService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() u: AuthedUser) {
    return this.users.getProfile(u.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/settings')
  updateSettings(@CurrentUser() u: AuthedUser, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(u.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  updateProfile(@CurrentUser() u: AuthedUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(u.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  uploadAvatar(@CurrentUser() u: AuthedUser, @Body() dto: UploadAvatarDto) {
    return this.users.setAvatar(u.id, dto.dataUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/reset-progress')
  resetProgress(@CurrentUser() u: AuthedUser) {
    return this.users.resetProgress(u.id);
  }

  /** Prefix search by nickname. Requires auth to discourage scraping. */
  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(@CurrentUser() u: AuthedUser, @Query('q') q: string) {
    const rows = await this.friends.search(u.id, q ?? '', 10);
    // Enrich each hit with the viewer's friendship state so the UI can render
    // the right CTA without a per-row round-trip.
    const withStatus = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        friendship: await this.friends.statusWith(u.id, r.id),
      })),
    );
    return withStatus;
  }

  /** Public profile lookup by nickname. Auth is optional — if the caller is
   *  authenticated, the response includes their friendship state with the
   *  target so the UI can render the correct action button. */
  @Get('by-nickname/:nickname')
  async publicProfile(@Param('nickname') nickname: string) {
    const profile = await this.users.publicProfile(nickname);
    return profile;
  }

  /** Friendship state with a named user (requires auth). */
  @UseGuards(JwtAuthGuard)
  @Get('by-nickname/:nickname/friendship')
  async friendshipWith(@CurrentUser() u: AuthedUser, @Param('nickname') nickname: string) {
    const target = await this.users.findByNickname(nickname);
    if (!target) return { state: 'none', friendshipId: null };
    return this.friends.statusWith(u.id, target.id);
  }
}
