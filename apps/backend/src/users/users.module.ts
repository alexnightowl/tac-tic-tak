import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FriendshipService } from './friendship.service';
import { FriendsController } from './friends.controller';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  providers: [UsersService, FriendshipService, LeaderboardService],
  controllers: [UsersController, FriendsController, LeaderboardController],
  exports: [UsersService, FriendshipService],
})
export class UsersModule {}
