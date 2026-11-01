import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExperienceService } from '../experience/experience.service';
import { OfflineService } from '../offline/offline.service';
import { trainingXp } from '../sessions/progress';
import {
  LIBRARY_BOOK_BY_ID,
  LIBRARY_BOOKS,
  LIBRARY_PUZZLE_BOOK,
  type LibraryBook,
  type LibraryPuzzleContent,
} from './catalog';
import { LibraryAttemptDto, LibrarySyncDto, MAX_LIBRARY_TIME_MS } from './dto';

/**
 * Library puzzles live in the Puzzle table (so Review can hold them) with
 * popularity and play counts under every selection floor
 * (MIN_POPULARITY, MIN_PLAYS), so no rated, casual, theme or offline pick
 * ever serves one.
 */
export const LIBRARY_POPULARITY = -100;

/** Rough solving time per puzzle on a first pass, for "~N h per cycle". */
const MINUTES_PER_PUZZLE = 2;

const roundTo = (v: number, step: number, dir: 'down' | 'up') =>
  (dir === 'down' ? Math.floor(v / step) : Math.ceil(v / step)) * step;

function summaryOf(b: LibraryBook) {
  const puzzles = b.chapters.flatMap((c) => c.puzzles);
  const ratings = puzzles.map((p) => p.rating);
  return {
    id: b.id,
    version: b.version,
    title: b.title,
    authors: b.authors,
    players: b.players,
    era: b.era,
    description: b.description,
    cover: b.cover,
    coverPiece: b.coverPiece,
    puzzleCount: puzzles.length,
    ratingMin: roundTo(Math.min(...ratings), 50, 'down'),
    ratingMax: roundTo(Math.max(...ratings), 50, 'up'),
    minutesPerCycle: puzzles.length * MINUTES_PER_PUZZLE,
    chapters: b.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      count: c.puzzles.length,
      puzzleIds: c.puzzles.map((p) => p.id),
      ...(c.exam ? { exam: true } : {}),
    })),
  };
}

const puzzleOut = (p: LibraryPuzzleContent) => ({
  id: p.id,
  fen: p.fen,
  moves: p.moves.split(' '),
  rating: p.rating,
  themes: p.themes,
  goal: p.goal,
  mateIn: p.mateIn,
  game: p.game,
  note: p.note,
});

@Injectable()
export class LibraryService implements OnModuleInit {
  private readonly log = new Logger(LibraryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly experience: ExperienceService,
    private readonly offline: OfflineService,
  ) {}

  async onModuleInit() {
    try {
      const n = await this.syncPuzzleRows();
      if (n > 0) this.log.log(`library: ${n} puzzle rows written`);
    } catch (e) {
      // The books still serve; only Review of a missed puzzle needs the rows.
      this.log.error(`library: puzzle rows not synced: ${(e as Error).message}`);
    }
  }

  /** Writes the Puzzle (+ PuzzleTheme) rows that differ from the content. Idempotent. */
  async syncPuzzleRows(): Promise<number> {
    const all = LIBRARY_BOOKS.flatMap((b) => b.chapters.flatMap((c) => c.puzzles));
    if (all.length === 0) return 0;
    const existing = await this.prisma.puzzle.findMany({
      where: { id: { in: all.map((p) => p.id) } },
      select: { id: true, fen: true, moves: true, rating: true, themes: { select: { theme: { select: { slug: true } } } } },
    });
    const byId = new Map(existing.map((e) => [e.id, e]));
    const stale = all.filter((p) => {
      const e = byId.get(p.id);
      if (!e) return true;
      const slugs = e.themes.map((t) => t.theme.slug).sort().join(' ');
      return e.fen !== p.fen || e.moves !== p.moves || e.rating !== p.rating || slugs !== [...p.themes].sort().join(' ');
    });
    for (const p of stale) {
      await this.prisma.$transaction(async (tx) => {
        await tx.puzzle.upsert({
          where: { id: p.id },
          create: {
            id: p.id, fen: p.fen, moves: p.moves, rating: p.rating,
            ratingDeviation: 0, popularity: LIBRARY_POPULARITY, nbPlays: 0, gameUrl: null,
          },
          update: { fen: p.fen, moves: p.moves, rating: p.rating },
        });
        await tx.puzzleTheme.deleteMany({ where: { puzzleId: p.id } });
        for (const slug of p.themes) {
          const theme = await tx.theme.upsert({ where: { slug }, create: { slug }, update: {} });
          await tx.puzzleTheme.create({ data: { puzzleId: p.id, themeId: theme.id } });
        }
      });
    }
    return stale.length;
  }

  books() {
    return { books: LIBRARY_BOOKS.map(summaryOf) };
  }

  /** The whole book, as the phone stores it for offline solving. */
  book(id: string) {
    const b = LIBRARY_BOOK_BY_ID.get(id);
    if (!b) throw new NotFoundException('book not found');
    return {
      ...summaryOf(b),
      chapters: b.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        count: c.puzzles.length,
        puzzleIds: c.puzzles.map((p) => p.id),
        ...(c.exam ? { exam: true } : {}),
        puzzles: c.puzzles.map(puzzleOut),
      })),
    };
  }

  async progress(userId: string) {
    const rows = await this.prisma.libraryAttempt.findMany({
      where: { userId },
      select: { bookId: true, puzzleId: true, cycle: true, result: true, timeMs: true, solvedAt: true },
      orderBy: { solvedAt: 'asc' },
    });
    return { attempts: rows };
  }

  /**
   * Results played on the phone (online or not). A re-sent result
   * (same clientId) or a second result for a puzzle already played in
   * that cycle is dropped; a puzzle that is not in the named book is
   * skipped. Hint and missed results put the puzzle in Review. Time
   * spent earns XP like any training, and the days played count for
   * the streak (as offline days do: up to 3 days late); the rating never
   * moves.
   */
  async sync(userId: string, dto: LibrarySyncDto) {
    const now = Date.now();
    const seen = new Set<string>();
    let unknown = 0;
    const valid: (LibraryAttemptDto & { at: Date })[] = [];
    for (const a of dto.attempts) {
      if (seen.has(a.clientId)) continue;
      seen.add(a.clientId);
      if (LIBRARY_PUZZLE_BOOK.get(a.puzzleId) !== a.bookId) {
        unknown += 1;
        continue;
      }
      valid.push({
        ...a,
        timeMs: Math.min(MAX_LIBRARY_TIME_MS, a.timeMs),
        // A skewed phone clock can't write the future.
        at: new Date(Math.min(Date.parse(a.solvedAt), now)),
      });
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const inserted = valid.length === 0
        ? []
        : await tx.$queryRaw<{ clientId: string }[]>`
            INSERT INTO "LibraryAttempt" ("id", "clientId", "userId", "bookId", "puzzleId", "cycle", "result", "timeMs", "solvedAt")
            SELECT gen_random_uuid()::text, v."clientId", ${userId}, v."bookId", v."puzzleId", v."cycle", v."result", v."timeMs",
              (v."solvedAt"::timestamptz AT TIME ZONE 'UTC')
            FROM unnest(
              ${valid.map((a) => a.clientId)}::text[],
              ${valid.map((a) => a.bookId)}::text[],
              ${valid.map((a) => a.puzzleId)}::text[],
              ${valid.map((a) => a.cycle)}::int[],
              ${valid.map((a) => a.result)}::text[],
              ${valid.map((a) => a.timeMs)}::int[],
              ${valid.map((a) => a.at.toISOString())}::text[]
            ) AS v("clientId", "bookId", "puzzleId", "cycle", "result", "timeMs", "solvedAt")
            ON CONFLICT DO NOTHING
            RETURNING "clientId"
          `;
      const fresh = new Set(inserted.map((r) => r.clientId));
      const added = valid.filter((a) => fresh.has(a.clientId));

      const toReview = [...new Set(added.filter((a) => a.result !== 'clean').map((a) => a.puzzleId))];
      const rows = toReview.length === 0
        ? []
        : await tx.puzzle.findMany({ where: { id: { in: toReview } }, select: { id: true } });
      for (const { id } of rows) {
        await tx.reviewItem.upsert({
          where: { userId_puzzleId: { userId, puzzleId: id } },
          create: { userId, puzzleId: id },
          update: { resolvedAt: null },
        });
      }

      // XP from the whole library time, so results synced one puzzle at
      // a time still add up to whole minutes.
      const activeMs = added.reduce((s, a) => s + a.timeMs, 0);
      let xp = null;
      if (added.length > 0) {
        const total = await tx.libraryAttempt.aggregate({ where: { userId }, _sum: { timeMs: true } });
        const totalMs = total._sum.timeMs ?? 0;
        const gained = trainingXp(totalMs) - trainingXp(totalMs - activeMs);
        xp = await this.experience.award(userId, { source: 'library', xp: gained, trainingSec: activeMs / 1000 }, tx);
      }

      return {
        accepted: added.length,
        duplicates: valid.length - added.length,
        unknown,
        reviewAdded: rows.length,
        xp,
      };
    });

    // Every result's day, duplicates included: a day already counted is a no-op,
    // so a retried batch whose streak tick was lost heals itself.
    const days = valid.filter((a) => a.localDay).map((a) => ({ localDay: a.localDay! }));
    const streak = days.length > 0 && dto.tzOffsetMin != null
      ? await this.offline.applyStreak(userId, days, dto.tzOffsetMin)
      : null;
    return { ...saved, streak };
  }
}
