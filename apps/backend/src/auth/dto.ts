import { IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 24)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'nickname must be alphanumeric' })
  nickname!: string;

  @IsString()
  @Length(8, 128)
  password!: string;

  @IsString()
  @Length(8, 128)
  repeatPassword!: string;
}

export class LoginDto {
  @IsString()
  nickname!: string;

  @IsString()
  password!: string;
}
