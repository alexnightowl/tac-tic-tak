import { Body, Controller, Post, Get, UseGuards, Headers } from '@nestjs/common';
import { AuthService, ClientHeaders } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, AuthedUser } from './current-user.decorator';

const clientHeaders = (deviceId?: string, platform?: string): ClientHeaders => ({ deviceId, platform });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-platform') platform?: string,
  ) {
    return this.auth.register(dto, clientHeaders(deviceId, platform));
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-platform') platform?: string,
  ) {
    return this.auth.login(dto, clientHeaders(deviceId, platform));
  }

  /** B4: public (the access token may be expired); the refresh token is the credential. */
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /** B4: ends this device's refresh family. Public and idempotent. */
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  /** B4: bumps tokenVersion and revokes every refresh token of the caller. */
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthedUser) {
    return this.auth.logoutAll(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthedUser) {
    // Explicit pick: req.user may carry server-side extras (familyId).
    return { id: user.id, nickname: user.nickname };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthedUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto, user.familyId);
  }
}
