import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PuzzlesService } from '../puzzles/puzzles.service';

// Mirror of apps/frontend/src/lib/theme-labels.ts META_THEME_SLUGS.
// "Meta" themes describe game phase / length / outcome / source — they
// don't carry a tactical pattern, so we skip them when picking a
// puzzle's primary theme for the review queue grouping.
const META_THEME_SLUGS = new Set<string>([
  'opening', 'middlegame', 'endgame',
  'oneMove', 'short', 'long', 'veryLong',
  'master', 'masterVsMaster', 'superGM',
  'advantage', 'crushing', 'equality',
  'mate',
  'puzzle',
]);

function primaryTheme(slugs: string[]): string {
  const real = slugs.find((s) => !META_THEME_SLUGS.has(s));
  // Items with only meta themes get pushed to the end of the list so
  // the grouped tactical patterns stay together at the top.
  return real ?? '￿';
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly puzzles: PuzzlesService,
  ) {}

  async list(userId: string) {
    const items = await this.prisma.reviewItem.findMany({
      where: { userId, resolvedAt: null },
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
    const enriched = items.map((i) => {
      const themes = i.puzzle.themes.map((pt) => pt.theme.slug);
      return {
        id: i.id,
        puzzleId: i.puzzleId,
        createdAt: i.createdAt,
        rating: i.puzzle.rating,
        fen: i.puzzle.fen,
        setupMove: i.puzzle.moves.split(' ')[0] ?? null,
        themes,
        primaryTheme: primaryTheme(themes),
      };
    });
    // Group by primary theme, ascending rating within each theme so
    // the user can drill the same pattern from easy to hard and start
    // recognising it before it shifts.
    enriched.sort((a, b) => {
      if (a.primaryTheme !== b.primaryTheme) {
        return a.primaryTheme < b.primaryTheme ? -1 : 1;
      }
      return a.rating - b.rating;
    });
    return enriched.map(({ primaryTheme: _p, ...rest }) => rest);
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
