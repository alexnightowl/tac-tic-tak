import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthedUser } from '../auth/current-user.decorator';
import { LibraryService } from './library.service';
import { LibrarySyncDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('books')
  books() {
    return this.library.books();
  }

  @Get('books/:id')
  book(@Param('id') id: string) {
    return this.library.book(id);
  }

  @Get('courses')
  courses() {
    return this.library.courses();
  }

  @Get('courses/:id')
  course(@Param('id') id: string) {
    return this.library.course(id);
  }

  @Get('progress')
  progress(@CurrentUser() u: AuthedUser) {
    return this.library.progress(u.id);
  }

  @Post('sync')
  @HttpCode(200)
  sync(@CurrentUser() u: AuthedUser, @Body() dto: LibrarySyncDto) {
    return this.library.sync(u.id, dto);
  }
}
