import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

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
}

export class LoginDto {
  @IsString()
  nickname!: string;

  @IsString()
  password!: string;
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
