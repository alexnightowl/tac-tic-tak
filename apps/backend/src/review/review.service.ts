import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PuzzlesService } from '../puzzles/puzzles.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly puzzles: PuzzlesService,
  ) {}

  async list(userId: string) {
    const items = await this.prisma.reviewItem.findMany({
      where: { userId, resolvedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        puzzle: {
          select: {
            id: true,
            rating: true,
            fen: true,
            moves: true,
            themes: { include: { theme: true } },
          },
        },
      },
    });
    return items.map((i) => {
      const first = i.puzzle.moves.split(' ')[0] ?? null;
      return {
        id: i.id,
        puzzleId: i.puzzleId,
        createdAt: i.createdAt,
        rating: i.puzzle.rating,
        fen: i.puzzle.fen,
        setupMove: first,
        themes: i.puzzle.themes.map((pt) => pt.theme.slug),
      };
    });
  }

  async getPuzzle(userId: string, puzzleId: string) {
    const item = await this.prisma.reviewItem.findUnique({
      where: { userId_puzzleId: { userId, puzzleId } },
    });
    if (!item) throw new NotFoundException('not in review queue');
    return this.puzzles.get(puzzleId);
  }

  async resolve(userId: string, puzzleId: string) {
    await this.prisma.reviewItem.update({
      where: { userId_puzzleId: { userId, puzzleId } },
      data: { resolvedAt: new Date() },
    });
    return { ok: true };
  }
}
