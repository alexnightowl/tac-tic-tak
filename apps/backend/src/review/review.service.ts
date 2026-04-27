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

  async list(userId: string, themeSlug?: string) {
    const items = await this.prisma.reviewItem.findMany({
      where: {
        userId,
        resolvedAt: null,
        ...(themeSlug
          ? { puzzle: { themes: { some: { theme: { slug: themeSlug } } } } }
          : {}),
      },
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
    // Within a single theme drill, easiest first. Without a theme
    // filter the queue is grouped by primary theme alphabetically
    // and ascending rating inside each — preserves the old global
    // sort for any callers that still hit the unfiltered endpoint.
    enriched.sort((a, b) => {
      if (themeSlug) return a.rating - b.rating;
      if (a.primaryTheme !== b.primaryTheme) {
        return a.primaryTheme < b.primaryTheme ? -1 : 1;
      }
      return a.rating - b.rating;
    });
    return enriched.map(({ primaryTheme: _p, ...rest }) => rest);
  }

  /**
   * Buckets the user's unresolved review items by tactical theme. A
   * puzzle that carries multiple tactical themes (e.g. "fork" AND
   * "discovery") shows up under each — solving it removes it from
   * every bucket at once. Meta themes (game phase, length, source,
   * outcome, mate-aliases) are skipped so the cards on the review
   * landing page are tactical patterns, not housekeeping tags.
   */
  async themes(userId: string) {
    const items = await this.prisma.reviewItem.findMany({
      where: { userId, resolvedAt: null },
      include: {
        puzzle: {
          select: {
            rating: true,
            themes: { include: { theme: true } },
          },
        },
      },
    });
    const counts = new Map<string, { count: number; minRating: number }>();
    for (const i of items) {
      for (const pt of i.puzzle.themes) {
        const slug = pt.theme.slug;
        if (META_THEME_SLUGS.has(slug)) continue;
        const prev = counts.get(slug);
        if (prev) {
          prev.count += 1;
          if (i.puzzle.rating < prev.minRating) prev.minRating = i.puzzle.rating;
        } else {
          counts.set(slug, { count: 1, minRating: i.puzzle.rating });
        }
      }
    }
    return Array.from(counts.entries())
      .map(([slug, v]) => ({ slug, count: v.count, minRating: v.minRating }))
      // Most-failed pattern first — that's where drilling pays off.
      .sort((a, b) => b.count - a.count || (a.slug < b.slug ? -1 : 1));
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
