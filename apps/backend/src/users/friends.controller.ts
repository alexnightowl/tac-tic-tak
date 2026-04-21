import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { FriendshipService } from './friendship.service';

class SendFriendRequestDto {
  @IsString() @Length(3, 20)
  @Matches(/^[A-Za-z0-9_-]+$/)
  nickname!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendshipService) {}

  @Get()
  list(@CurrentUser() u: AuthedUser) {
    return this.friends.listFriends(u.id);
  }

  @Get('pending')
  pending(@CurrentUser() u: AuthedUser) {
    return this.friends.listPending(u.id);
  }

  @Post('request')
  request(@CurrentUser() u: AuthedUser, @Body() dto: SendFriendRequestDto) {
    return this.friends.sendRequest(u.id, dto.nickname);
  }

  @Post(':id/accept')
  accept(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.friends.accept(u.id, id);
  }

  /** Decline an incoming request or cancel an outgoing one. */
  @Delete(':id')
  reject(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.friends.reject(u.id, id);
  }

  /** Remove an accepted friendship by the other user's id. */
  @Delete('by-user/:otherId')
  removeByUserId(@CurrentUser() u: AuthedUser, @Param('otherId') otherId: string) {
    return this.friends.removeByUserId(u.id, otherId);
  }
}
