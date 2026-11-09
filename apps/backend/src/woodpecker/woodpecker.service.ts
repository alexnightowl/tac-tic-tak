import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MIN_PLAYS, MIN_POPULARITY } from '../puzzles/puzzle-buffer.service';
import { initialLevel } from '../sessions/progress';
import { CreateWoodpeckerSetDto, WoodpeckerDifficulty } from './dto';

// Woodpecker sets (D40): a fixed list of puzzles solved again and again in
// cycles, each faster than the one before (the Library's cycle targets).
// Puzzles come from a window under the style's level, never seen by the
// player before, and are solved easiest first. Results are Library
// attempts with bookId = the set id (LibraryService.sync checks the set).

const OFFSET: Record<WoodpeckerDifficulty, number> = { easy: -300, medium: -150, hard: 0 };
const HALF_WINDOW = 75;
const WIDE_WINDOW = 200;
const MIN_CENTRE = 600;

type SetRow = {
  id: string;
  style: string;
  difficulty: string;
  rating: number;
  puzzleIds: string[];
  createdAt: Date;
};

@Injectable()
export class WoodpeckerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWoodpeckerSetDto) {
    const row = await this.prisma.userStyleProgression.findUnique({
      where: { userId_style: { userId, style: dto.style } },
    });
    const level = row?.level ?? initialLevel(row?.currentPuzzleRating ?? 1200, row?.unlockedStartRating ?? 1200);
    const centre = Math.max(MIN_CENTRE, level + OFFSET[dto.difficulty]);

    let ids = await this.pick(userId, centre - HALF_WINDOW, centre + HALF_WINDOW, dto.size, []);
    if (ids.length < dto.size) {
      ids = ids.concat(await this.pick(userId, centre - WIDE_WINDOW, centre + WIDE_WINDOW, dto.size - ids.length, ids));
    }
    if (ids.length < dto.size) throw new BadRequestException('not enough puzzles for this set');

    const rated = await this.prisma.puzzle.findMany({ where: { id: { in: ids } }, select: { id: true, rating: true } });
    rated.sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));

    const set = await this.prisma.woodpeckerSet.create({
      data: {
        id: `wp_${randomBytes(12).toString('hex')}`,
        userId,
        style: dto.style,
        difficulty: dto.difficulty,
        rating: centre,
        puzzleIds: rated.map((p) => p.id),
      },
    });
    return this.full(set);
  }

  async list(userId: string) {
    const sets = await this.prisma.woodpeckerSet.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const ratings = await this.ratings(sets.flatMap((s) => s.puzzleIds));
    return sets.map((s) => summary(s, ratings));
  }

  async get(userId: string, id: string) {
    const set = await this.prisma.woodpeckerSet.findFirst({ where: { id, userId, archivedAt: null } });
    if (!set) throw new NotFoundException('set not found');
    return this.full(set);
  }

  async archive(userId: string, id: string) {
    const { count } = await this.prisma.woodpeckerSet.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('set not found');
    return { ok: true };
  }

  private async full(set: SetRow) {
    const rows = await this.prisma.puzzle.findMany({
      where: { id: { in: set.puzzleIds } },
      select: { id: true, fen: true, moves: true, rating: true, themes: { select: { theme: { select: { slug: true } } } } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const puzzles = set.puzzleIds.flatMap((id) => {
      const p = byId.get(id);
      return p ? [{ id: p.id, fen: p.fen, moves: p.moves, rating: p.rating, themes: p.themes.map((t) => t.theme.slug) }] : [];
    });
    return { ...summary(set, new Map(puzzles.map((p) => [p.id, p.rating]))), puzzles };
  }

  private async ratings(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.puzzle.findMany({ where: { id: { in: ids } }, select: { id: true, rating: true } });
    return new Map(rows.map((r) => [r.id, r.rating]));
  }

  /** Random good puzzles in [min, max] the player has never been shown. */
  private async pick(userId: string, min: number, max: number, count: number, taken: string[]): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id"
      FROM "Puzzle" p
      WHERE p."rating" BETWEEN ${min} AND ${max}
        AND p."popularity" >= ${MIN_POPULARITY}
        AND p."nbPlays" >= ${MIN_PLAYS}
        AND NOT EXISTS (
          SELECT 1 FROM "UserPuzzleHistory" h WHERE h."userId" = ${userId} AND h."puzzleId" = p."id"
        )
        AND NOT (p."id" = ANY(${taken}::text[]))
      ORDER BY random()
      LIMIT ${count}
    `;
    return rows.map((r) => r.id);
  }
}

function summary(set: SetRow, ratings: Map<string, number>) {
  const own = set.puzzleIds.map((id) => ratings.get(id)).filter((r): r is number => r != null);
  return {
    id: set.id,
    size: set.puzzleIds.length,
    difficulty: set.difficulty,
    style: set.style,
    rating: set.rating,
    ratingMin: own.length > 0 ? Math.min(...own) : set.rating,
    ratingMax: own.length > 0 ? Math.max(...own) : set.rating,
    createdAt: set.createdAt,
  };
}
