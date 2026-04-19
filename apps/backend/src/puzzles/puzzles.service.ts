import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PuzzlesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(id: string) {
    const p = await this.prisma.puzzle.findUnique({
      where: { id },
      include: { themes: { include: { theme: true } } },
    });
    if (!p) throw new NotFoundException('puzzle not found');
    return {
      id: p.id,
      fen: p.fen,
      moves: p.moves.split(' '),
      rating: p.rating,
      themes: p.themes.map((pt) => pt.theme.slug),
      gameUrl: p.gameUrl,
    };
  }

  async getForPlay(id: string) {
    // Same as get() — solution ("moves") is trusted to the client; client-side
    // validation happens before attempt is submitted to the server.
    return this.get(id);
  }
}
