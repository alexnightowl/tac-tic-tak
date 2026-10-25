import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { requireJwtSecret } from './jwt-secret';

@Module({
  imports: [
    PassportModule,
    // registerAsync: the secret is read when the module is instantiated
    // (after ConfigModule has loaded .env), the same moment JwtStrategy
    // reads it, so signing and verification always agree.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: requireJwtSecret(),
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
