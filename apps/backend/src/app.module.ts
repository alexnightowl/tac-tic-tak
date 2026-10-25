import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { ReviewModule } from './review/review.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PuzzlesModule } from './puzzles/puzzles.module';
import { UsersModule } from './users/users.module';
import { AchievementsModule } from './achievements/achievements.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Provides SchedulerRegistry. Registers no job by itself; the session
    // sweeper adds its interval only when SESSION_SWEEPER_ENABLED is set.
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    PuzzlesModule,
    AuthModule,
    UsersModule,
    SessionsModule,
    ReviewModule,
    AnalyticsModule,
    AchievementsModule,
    AdminModule,
  ],
})
export class AppModule {}
