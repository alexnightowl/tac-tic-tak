import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PuzzleBufferService } from '../puzzles/puzzle-buffer.service';
import { AttemptDto, CreateSessionDto } from './dto';
import { computeRatingStep, deriveSessionStats } from './rating';

const WINDOW = 4;
const MIN_RATING = 400;
const MAX_RATING = 3000;

@Injectable()
export class SessionsService {
  private readonly log = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buffer: PuzzleBufferService,
  ) {}

  async create(userId: string, dto: CreateSessionDto) {
    const progression = await this.prisma.userProgression.findUnique({ where: { userId } });
    if (!progression) throw new BadRequestException('progression missing');
    if (dto.startRating > progression.unlockedStartRating + 200) {
      throw new BadRequestException(`startRating exceeds unlocked cap (${progression.unlockedStartRating})`);
    }
    const session = await this.prisma.trainingSession.create({
      data: {
        userId,
        mode: dto.mode,
        theme: dto.theme ?? null,
        startRating: dto.startRating,
        durationSec: dto.durationSec,
      },
    });
    await this.prisma.userProgression.update({
      where: { userId },
      data: { currentPuzzleRating: dto.startRating, startPuzzleRating: dto.startRating },
    });

    // Warm the session queue up-front so the very first /next returns fast.
    this.buffer
      .warmSession({
        sessionId: session.id,
        userId,
        rating: dto.startRating,
        theme: dto.theme ?? null,
      })
      .catch((e) => this.log.error(`initial warm failed: ${e?.message}`));

    return { sessionId: session.id, startedAt: session.startedAt, durationSec: session.durationSec };
  }

  async next(userId: string, sessionId: string) {
    const session = await this.ownedSession(userId, sessionId);
    if (session.endedAt) throw new BadRequestException('session ended');

    const progression = await this.prisma.userProgression.findUniqueOrThrow({ where: { userId } });

    // First call after create: reset startedAt to NOW so the timer starts when
    // the user actually sees the first puzzle (not when the session row was
    // persisted).
    const attemptCount = await this.prisma.trainingAttempt.count({ where: { sessionId } });
    let startedAt = session.startedAt;
    if (attemptCount === 0) {
      startedAt = new Date();
      await this.prisma.trainingSession.update({
        where: { id: sessionId },
        data: { startedAt },
      });
    }

    const puzzle = await this.buffer.getNext({
      sessionId,
      userId,
      rating: progression.currentPuzzleRating,
      theme: session.theme,
    });
    if (!puzzle) throw new NotFoundException('no puzzles available');

    return {
      puzzle,
      currentRating: progression.currentPuzzleRating,
      session: {
        id: session.id,
        startedAt,
        durationSec: session.durationSec,
      },
    };
  }

  async attempt(userId: string, sessionId: string, dto: AttemptDto) {
    const session = await this.ownedSession(userId, sessionId);
    if (session.endedAt) throw new BadRequestException('session ended');

    const puzzle = await this.prisma.puzzle.findUnique({ where: { id: dto.puzzleId } });
    if (!puzzle) throw new NotFoundException('puzzle not found');

    await this.prisma.trainingAttempt.create({
      data: {
        sessionId,
        userId,
        puzzleId: dto.puzzleId,
        puzzleRating: puzzle.rating,
        correct: dto.correct,
        responseMs: dto.responseMs,
      },
    });

    await this.prisma.userPuzzleHistory.upsert({
      where: { userId_puzzleId: { userId, puzzleId: dto.puzzleId } },
      create: { userId, puzzleId: dto.puzzleId },
      update: { lastSeenAt: new Date(), seenCount: { increment: 1 } },
    });

    if (!dto.correct) {
      await this.prisma.reviewItem.upsert({
        where: { userId_puzzleId: { userId, puzzleId: dto.puzzleId } },
        create: { userId, puzzleId: dto.puzzleId },
        update: { resolvedAt: null },
      });
    }

    const windowAttempts = await this.prisma.trainingAttempt.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: WINDOW,
    });
    const progression = await this.prisma.userProgression.findUniqueOrThrow({ where: { userId } });
    const step = computeRatingStep(progression.currentPuzzleRating, windowAttempts.map((a) => ({
      correct: a.correct,
      responseMs: a.responseMs,
      puzzleRating: a.puzzleRating,
    })));
    const next = Math.max(MIN_RATING, Math.min(MAX_RATING, progression.currentPuzzleRating + step));
    await this.prisma.userProgression.update({
      where: { userId },
      data: { currentPuzzleRating: next },
    });

    return { newRating: next, step };
  }

  async finish(userId: string, sessionId: string, opts: { save?: boolean } = {}) {
    const save = opts.save !== false;
    const session = await this.ownedSession(userId, sessionId);
    if (session.endedAt) return this.summary(session.id);

    // User chose to discard — wipe the session and its attempts entirely.
    if (!save) {
      await this.buffer.clearSession(sessionId);
      await this.prisma.trainingSession.delete({ where: { id: sessionId } });
      return { discarded: true } as const;
    }

    const attempts = await this.prisma.trainingAttempt.findMany({ where: { sessionId } });
    const stats = deriveSessionStats(attempts, session.startRating);
    await this.prisma.trainingSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        solvedCount: stats.solved,
        failedCount: stats.failed,
        accuracy: stats.accuracy,
        avgResponseMs: stats.avgResponseMs,
        peakRating: stats.peakRating,
      },
    });

    const progression = await this.prisma.userProgression.findUniqueOrThrow({ where: { userId } });
    const delta = stats.peakRating - session.startRating;
    const unlocked = delta >= 100 && stats.accuracy >= 0.72 && stats.avgResponseMs <= 9000 && stats.solved >= 15;
    if (unlocked) {
      await this.prisma.userProgression.update({
        where: { userId },
        data: { unlockedStartRating: progression.unlockedStartRating + 50 },
      });
    }

    await this.buffer.clearSession(sessionId);
    return { ...(await this.summary(sessionId)), unlocked };
  }

  /** Delete a finished session (used by the list's swipe-to-delete). */
  async remove(userId: string, sessionId: string) {
    const session = await this.ownedSession(userId, sessionId);
    await this.prisma.trainingSession.delete({ where: { id: session.id } });
    return { ok: true };
  }

  /** Detailed view of a single session: headline stats + attempt breakdown. */
  async detail(userId: string, sessionId: string) {
    const session = await this.ownedSession(userId, sessionId);
    const attempts = await this.prisma.trainingAttempt.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, puzzleId: true, puzzleRating: true,
        correct: true, responseMs: true, createdAt: true,
      },
    });
    const endRating = attempts.length > 0
      ? (attempts[attempts.length - 1].correct ? attempts[attempts.length - 1].puzzleRating : session.peakRating)
      : session.startRating;
    return {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      mode: session.mode,
      theme: session.theme,
      durationSec: session.durationSec,
      startRating: session.startRating,
      endRating,
      peakRating: session.peakRating,
      solved: session.solvedCount,
      failed: session.failedCount,
      accuracy: session.accuracy,
      avgResponseMs: session.avgResponseMs,
      attempts,
    };
  }

  private async ownedSession(userId: string, sessionId: string) {
    const s = await this.prisma.trainingSession.findUnique({ where: { id: sessionId } });
    if (!s || s.userId !== userId) throw new NotFoundException('session not found');
    return s;
  }

  private async summary(sessionId: string) {
    const s = await this.prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
    return {
      sessionId: s.id,
      solved: s.solvedCount,
      failed: s.failedCount,
      accuracy: s.accuracy,
      avgResponseMs: s.avgResponseMs,
      peakRating: s.peakRating,
      durationSec: s.durationSec,
    };
  }
}
