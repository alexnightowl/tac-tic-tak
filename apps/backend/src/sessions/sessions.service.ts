import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PuzzleBufferService } from '../puzzles/puzzle-buffer.service';
import { PuzzlesService } from '../puzzles/puzzles.service';
import { AttemptDto, CreateSessionDto } from './dto';
import { computeRatingStep, deriveSessionStats } from './rating';

const WINDOW = 4;
const MIN_RATING = 400;
const MAX_RATING = 3000;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly buffer: PuzzleBufferService,
    private readonly puzzles: PuzzlesService,
  ) {}

  async create(userId: string, dto: CreateSessionDto) {
    const progression = await this.prisma.userProgression.findUnique({ where: { userId } });
    if (!progression) throw new BadRequestException('progression missing');
    if (dto.startRating < progression.unlockedStartRating) {
      // allow starting below unlocked, but cap cannot be exceeded
    }
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
    return { sessionId: session.id, startedAt: session.startedAt, durationSec: session.durationSec };
  }

  async next(userId: string, sessionId: string) {
    const session = await this.ownedSession(userId, sessionId);
    if (session.endedAt) throw new BadRequestException('session ended');

    const progression = await this.prisma.userProgression.findUniqueOrThrow({ where: { userId } });
    const puzzleId = await this.buffer.getNext({
      sessionId,
      userId,
      rating: progression.currentPuzzleRating,
      theme: session.theme,
    });
    if (!puzzleId) throw new NotFoundException('no puzzles available');
    const puzzle = await this.puzzles.getForPlay(puzzleId);
    return {
      puzzle,
      currentRating: progression.currentPuzzleRating,
      session: {
        id: session.id,
        startedAt: session.startedAt,
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

    // Update history.
    await this.prisma.userPuzzleHistory.upsert({
      where: { userId_puzzleId: { userId, puzzleId: dto.puzzleId } },
      create: { userId, puzzleId: dto.puzzleId },
      update: { lastSeenAt: new Date(), seenCount: { increment: 1 } },
    });

    // On fail: queue as review item.
    if (!dto.correct) {
      await this.prisma.reviewItem.upsert({
        where: { userId_puzzleId: { userId, puzzleId: dto.puzzleId } },
        create: { userId, puzzleId: dto.puzzleId },
        update: { resolvedAt: null },
      });
    }

    // Update rating via rolling window.
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

  async finish(userId: string, sessionId: string) {
    const session = await this.ownedSession(userId, sessionId);
    if (session.endedAt) return this.summary(session.id);

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

    // Unlock check: per spec — delta>=100, accuracy>=72%, avgResponse<=9s, solved>=15 → +50 unlockedStartRating.
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
