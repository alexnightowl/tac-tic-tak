import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';

class ListUsersQuery {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() offset?: number;
}

class SetPasswordDto {
  @IsString() @MinLength(8) password!: string;
}

class ActivityQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Max(365) days?: number;
}

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Lightweight echo so the frontend can confirm admin access
   *  before rendering the page (the guard returns 403 otherwise). */
  @Get('me')
  me(@CurrentUser() u: AuthedUser) {
    return { id: u.id, nickname: u.nickname, isAdmin: true };
  }

  @Get('users')
  listUsers(@Query() q: ListUsersQuery) {
    return this.admin.listUsers(q.q, q.limit ?? 50, q.offset ?? 0);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() u: AuthedUser, @Param('id') id: string) {
    return this.admin.deleteUser(u.id, id);
  }

  @Post('users/:id/password')
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.admin.setPassword(id, dto.password);
  }

  @Get('activity')
  activity(@Query() q: ActivityQuery) {
    return this.admin.activity(q.days ?? 30);
  }
}
