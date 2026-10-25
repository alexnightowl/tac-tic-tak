import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export const CLIENTS = ['web', 'mobile'] as const;
export type AuthClient = (typeof CLIENTS)[number];
export const PLATFORMS = ['ios', 'android'] as const;
export type AuthPlatform = (typeof PLATFORMS)[number];

export class RegisterDto {
  @IsString()
  @Length(3, 20, { message: 'nickname must be 3–20 characters' })
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'nickname may only contain letters, digits, _ and -' })
  @Matches(/^(?!.*[-_]{2}).+$/, { message: 'nickname cannot contain consecutive _ or -' })
  nickname!: string;

  @IsString()
  @Length(8, 128, { message: 'password must be at least 8 characters' })
  @Matches(/[A-Za-z]/, { message: 'password must include a letter' })
  @Matches(/[0-9]/, { message: 'password must include a digit' })
  password!: string;

  @IsString()
  @Length(8, 128)
  repeatPassword!: string;

  // Seed the new account's UI language from whatever the visitor picked
  // on the landing page (optional — defaults to English).
  @IsOptional() @IsIn(['en', 'uk'])
  language?: 'en' | 'uk';

  // ---- B4, mobile only (the web sends none of these) ----

  /** 'mobile' opts into a short access token + refresh token. Absent or 'web': today's 7-day token. */
  @IsOptional() @IsIn(CLIENTS)
  client?: AuthClient;

  /** Stable per-install id; a re-login on the same device ends its previous refresh family. */
  @IsOptional() @IsString() @Length(1, 128)
  deviceId?: string;

  @IsOptional() @IsIn(PLATFORMS)
  platform?: AuthPlatform;
}

export class LoginDto {
  @IsString()
  nickname!: string;

  @IsString()
  password!: string;

  // ---- B4, mobile only (see RegisterDto) ----

  @IsOptional() @IsIn(CLIENTS)
  client?: AuthClient;

  @IsOptional() @IsString() @Length(1, 128)
  deviceId?: string;

  @IsOptional() @IsIn(PLATFORMS)
  platform?: AuthPlatform;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @Length(8, 128, { message: 'password must be at least 8 characters' })
  @Matches(/[A-Za-z]/, { message: 'password must include a letter' })
  @Matches(/[0-9]/, { message: 'password must include a digit' })
  newPassword!: string;
}

/** POST /auth/refresh and /auth/logout. */
export class RefreshTokenDto {
  @IsString()
  @Length(1, 512)
  refreshToken!: string;
}
