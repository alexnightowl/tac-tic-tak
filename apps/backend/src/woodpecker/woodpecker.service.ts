import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { COURSE_PUZZLE_COURSE } from '../library/courses';
import { MIN_PLAYS, MIN_POPULARITY } from '../puzzles/puzzle-buffer.service';
import { initialLevel } from '../sessions/progress';
import { BOOK_PARTS, compose, order, OVERDRAW, POOL_SIZE, type Candidate } from './compose';
import { CreateWoodpeckerSetDto, WoodpeckerDifficulty } from './dto';

// Woodpecker sets: a fixed list of puzzles solved again and again in
// cycles. Puzzles are never seen by the player before. Results are Library
// attempts with bookId = the set id (LibraryService.sync checks the set).
// A Library result is unique per (player, puzzle, cycle) whatever the
// book, so a set never takes a puzzle from a course, another set or any
// Library result of the player: its results would be dropped as repeats.
//
// D41 "book" sets follow the method as written (Smith & Tikkanen): a pool
// of Easy then Intermediate puzzles under the level, motifs mixed; the
// first cycle runs up to four weeks and the set is what it got through.
// Its first results re-aim the rest of the pool once (calibration).
// D40 sets (size + difficulty) are a fixed list from one rating window.

const OFFSET: Record<WoodpeckerDifficulty, number> = { easy: -300, medium: -150, hard: 0 };
const HALF_WINDOW = 75;
const WIDE_WINDOW = 200;
const MIN_CENTRE = 600;
const MIN_RATING = 400;

/** The first cycle ends by itself after this long (the book's four weeks)… */
export const FIRST_CYCLE_MS = 28 * 24 * 60 * 60 * 1000;
/** …once the set has at least this many puzzles; Close needs as many. */
export const MIN_SET = 50;
/** Calibration reads the first results this many results in… */
const CALIBRATE_AT = 30;
/** …and leaves the next puzzles as they are (a session may be on them). */
const CALIBRATE_KEEP = 20;
const CALIBRATE_SHIFT = 150;
const TOO_EASY = 0.9;
const TOO_HARD = 0.5;
/** A pick short of puzzles widens by this much on each side. */
const WIDEN = 100;

type SetRow = {
  id: string;
  userId: string;
  style: string;
  difficulty: string;
  rating: number;
  puzzleIds: string[];
  method: string | null;
  size: number | null;
  closedAt: Date | null;
  calibratedAt: Date | null;
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
    const taken = await this.taken(userId);
    const id = `wp_${randomBytes(12).toString('hex')}`;

    if (dto.size == null || dto.difficulty == null) {
      const puzzleIds = await this.bookPool(userId, level, POOL_SIZE, 0, taken);
      if (puzzleIds.length < MIN_SET) throw new BadRequestException('not enough puzzles for this set');
      const set = await this.prisma.woodpeckerSet.create({
        data: { id, userId, style: dto.style, difficulty: 'book', rating: level, puzzleIds, method: 'book' },
      });
      return this.full(set);
    }

    const centre = Math.max(MIN_CENTRE, level + OFFSET[dto.difficulty]);
    let ids = await this.pick(userId, centre - HALF_WINDOW, centre + HALF_WINDOW, dto.size, taken);
    if (ids.length < dto.size) {
      ids = ids.concat(await this.pick(userId, centre - WIDE_WINDOW, centre + WIDE_WINDOW, dto.size - ids.length, [...taken, ...ids]));
    }
    if (ids.length < dto.size) throw new BadRequestException('not enough puzzles for this set');

    const rated = await this.prisma.puzzle.findMany({ where: { id: { in: ids } }, select: { id: true, rating: true } });
    rated.sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));

    const set = await this.prisma.woodpeckerSet.create({
      data: {
        id,
        userId,
        style: dto.style,
        difficulty: dto.difficulty,
        rating: centre,
        puzzleIds: rated.map((p) => p.id),
        size: rated.length,
      },
    });
    return this.full(set);
  }

  async list(userId: string) {
    const rows = await this.prisma.woodpeckerSet.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const sets = await Promise.all(rows.map((s) => this.maintain(s)));
    const ratings = await this.ratings(sets.flatMap((s) => setIds(s)));
    return sets.map((s) => summary(s, ratings));
  }

  async get(userId: string, id: string) {
    const set = await this.prisma.woodpeckerSet.findFirst({ where: { id, userId, archivedAt: null } });
    if (!set) throw new NotFoundException('set not found');
    return this.full(await this.maintain(set));
  }

  async close(userId: string, id: string) {
    const set = await this.prisma.woodpeckerSet.findFirst({ where: { id, userId, archivedAt: null } });
    if (!set) throw new NotFoundException('set not found');
    if (set.size != null) return this.full(set);
    const { prefix } = await this.firstCycle(set);
    if (prefix < MIN_SET) throw new BadRequestException(`the first cycle needs ${MIN_SET} puzzles`);
    return this.full(await this.prisma.woodpeckerSet.update({ where: { id }, data: { size: prefix, closedAt: new Date() } }));
  }

  async archive(userId: string, id: string) {
    const { count } = await this.prisma.woodpeckerSet.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('set not found');
    return { ok: true };
  }

  /**
   * A "book" set still in its first cycle: closes it when the pool is
   * done, or four weeks after its first result once it has MIN_SET
   * puzzles; re-aims the rest of the pool once after CALIBRATE_AT results
   * (a set that is too easy or too hard teaches little).
   */
  private async maintain(set: SetRow): Promise<SetRow> {
    if (set.method !== 'book' || set.size != null) return set;
    const { prefix, results, firstAt } = await this.firstCycle(set);
    const due = firstAt != null && Date.now() - firstAt.getTime() >= FIRST_CYCLE_MS && prefix >= MIN_SET;
    if (prefix >= set.puzzleIds.length || due) {
      return this.prisma.woodpeckerSet.update({ where: { id: set.id }, data: { size: prefix, closedAt: new Date() } });
    }
    if (set.calibratedAt || results.length < CALIBRATE_AT) return set;

    const first = results.slice(0, CALIBRATE_AT);
    const clean = first.filter((r) => r.result === 'clean').length / first.length;
    const shift = clean >= TOO_EASY ? CALIBRATE_SHIFT : clean <= TOO_HARD ? -CALIBRATE_SHIFT : 0;
    const keep = set.puzzleIds.slice(0, Math.max(prefix, results.length) + CALIBRATE_KEEP);
    let puzzleIds = set.puzzleIds;
    if (shift !== 0 && keep.length < set.puzzleIds.length) {
      const taken = [...(await this.taken(set.userId, set.id)), ...keep];
      const tail = await this.bookPool(set.userId, set.rating, set.puzzleIds.length, keep.length, taken, shift);
      // Short of puzzles at the new level: keep the old tail.
      if (tail.length >= set.puzzleIds.length - keep.length) puzzleIds = [...keep, ...tail];
    }
    return this.prisma.woodpeckerSet.update({ where: { id: set.id }, data: { puzzleIds, calibratedAt: new Date() } });
  }

  /** The first cycle so far: results in time order, the solved run from the start, the first result's time. */
  private async firstCycle(set: SetRow) {
    const results = await this.prisma.libraryAttempt.findMany({
      where: { userId: set.userId, bookId: set.id, cycle: 1 },
      orderBy: { solvedAt: 'asc' },
      select: { puzzleId: true, result: true, solvedAt: true },
    });
    const done = new Set(results.map((r) => r.puzzleId));
    let prefix = 0;
    while (prefix < set.puzzleIds.length && done.has(set.puzzleIds[prefix])) prefix += 1;
    return { results, prefix, firstAt: results[0]?.solvedAt ?? null };
  }

  /**
   * The pool from position `from` on: each book part takes its share of
   * `total` positions (Easy first), drawn from its rating band around
   * `level` (moved by `shift`), by the motif quotas, in solving order.
   */
  private async bookPool(userId: string, level: number, total: number, from: number, taken: string[], shift = 0): Promise<string[]> {
    const out: string[] = [];
    let start = 0;
    for (const b of BOOK_PARTS) {
      const end = b === BOOK_PARTS[BOOK_PARTS.length - 1] ? total : start + Math.round(total * b.share);
      const count = end - Math.max(start, from);
      start = end;
      if (count <= 0) continue;
      const min = Math.max(MIN_RATING, level + b.from + shift);
      const max = Math.max(min + 50, level + b.to + shift);
      const avoid = [...taken, ...out];
      let picked = compose(await this.candidates(userId, min, max, count * OVERDRAW, avoid), count, b.part);
      if (picked.length < count) {
        const more = await this.candidates(userId, Math.max(MIN_RATING, min - WIDEN), max + WIDEN, (count - picked.length) * OVERDRAW, [
          ...avoid,
          ...picked.map((p) => p.id),
        ]);
        picked = [...picked, ...compose(more, count - picked.length, b.part)];
      }
      out.push(...order(picked).map((p) => p.id));
    }
    return out;
  }

  /** Puzzles no set may take: courses, the player's other sets, any Library result. */
  private async taken(userId: string, exceptSet?: string): Promise<string[]> {
    const [sets, played] = await Promise.all([
      this.prisma.woodpeckerSet.findMany({ where: { userId, ...(exceptSet ? { id: { not: exceptSet } } : {}) }, select: { puzzleIds: true } }),
      this.prisma.libraryAttempt.findMany({ where: { userId }, distinct: ['puzzleId'], select: { puzzleId: true } }),
    ]);
    return [...new Set([...COURSE_PUZZLE_COURSE.keys(), ...sets.flatMap((s) => s.puzzleIds), ...played.map((p) => p.puzzleId)])];
  }

  private async full(set: SetRow) {
    const ids = setIds(set);
    const rows = await this.prisma.puzzle.findMany({
      where: { id: { in: ids } },
      select: { id: true, fen: true, moves: true, rating: true, themes: { select: { theme: { select: { slug: true } } } } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const puzzles = ids.flatMap((id) => {
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

  /**
   * Random good puzzles in [min, max] the player has never been shown,
   * with their themes. Without parallel workers: a one-off scan doesn't
   * need them, and their shared-memory segments are what runs out first
   * in the docker Postgres when sessions preload at the same time.
   */
  private async candidates(userId: string, min: number, max: number, count: number, taken: string[]): Promise<Candidate[]> {
    const [, rows] = await this.prisma.$transaction([
      this.prisma.$executeRaw`SET LOCAL max_parallel_workers_per_gather = 0`,
      this.prisma.$queryRaw<Candidate[]>`
      SELECT p."id", p."rating", p."moves",
        ARRAY(SELECT t."slug" FROM "PuzzleTheme" pt JOIN "Theme" t ON t."id" = pt."themeId" WHERE pt."puzzleId" = p."id") AS themes
      FROM (
        SELECT p."id", p."rating", p."moves"
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
      ) p
    `,
    ]);
    return rows;
  }

  /** D40: random good puzzles in [min, max] the player has never been shown. */
  private async pick(userId: string, min: number, max: number, count: number, taken: string[]): Promise<string[]> {
    return (await this.candidates(userId, min, max, count, taken)).map((r) => r.id);
  }
}

/** The set's puzzles: the first `size`, or the whole pool while the first cycle draws from it. */
function setIds(set: Pick<SetRow, 'puzzleIds' | 'size'>): string[] {
  return set.size == null ? set.puzzleIds : set.puzzleIds.slice(0, set.size);
}

function summary(set: SetRow, ratings: Map<string, number>) {
  const own = setIds(set).map((id) => ratings.get(id)).filter((r): r is number => r != null);
  return {
    id: set.id,
    size: setIds(set).length,
    difficulty: set.difficulty,
    style: set.style,
    rating: set.rating,
    ratingMin: own.length > 0 ? Math.min(...own) : set.rating,
    ratingMax: own.length > 0 ? Math.max(...own) : set.rating,
    createdAt: set.createdAt,
    method: set.method,
    /** False while a "book" set's first cycle still draws from the pool. */
    closed: set.size != null,
    closedAt: set.closedAt,
  };
}
