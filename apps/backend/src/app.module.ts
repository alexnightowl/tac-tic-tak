import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { ReviewModule } from './review/review.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PuzzlesModule } from './puzzles/puzzles.module';
import { UsersModule } from './users/users.module';
import { AchievementsModule } from './achievements/achievements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    PuzzlesModule,
    AuthModule,
    UsersModule,
    SessionsModule,
    ReviewModule,
    AnalyticsModule,
    AchievementsModule,
  ],
})
export class AppModule {}
