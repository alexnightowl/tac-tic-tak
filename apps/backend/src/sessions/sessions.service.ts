import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PuzzleBufferService } from '../puzzles/puzzle-buffer.service';
import { AttemptDto, CreateSessionDto } from './dto';
import { computeRatingStep, deriveSessionStats } from './rating';
import { evaluateUnlock, isTrainingStyle, TrainingStyle, UNLOCK_REWARD } from './unlock';

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
    const styleRow = await this.styleProgression(userId, dto.style);
    // Theme-mode sessions are unrated practice — any start rating is allowed
    // and the style's progression row is not bumped.
    if (dto.mode !== 'theme' && dto.startRating > styleRow.unlockedStartRating + 200) {
      throw new BadRequestException(`startRating exceeds unlocked cap (${styleRow.unlockedStartRating})`);
    }
    const session = await this.prisma.trainingSession.create({
      data: {
        userId,
        mode: dto.mode,
        style: dto.style,
        theme: dto.theme ?? null,
        startRating: dto.startRating,
        durationSec: dto.durationSec,
      },
    });
    if (dto.mode !== 'theme') {
      await this.prisma.userStyleProgression.update({
        where: { userId_style: { userId, style: dto.style } },
        data: { currentPuzzleRating: dto.startRating, startPuzzleRating: dto.startRating },
      });
    }

    // Warm the session queue up-front so the very first /next returns fast.
    this.buffer
      .warmSession({
        sessionId: session.id,
        userId,
        rating: dto.startRating,
        theme: dto.theme ?? null,
      })
      .catch((e) => this.log.error(`initial warm failed: ${e?.message}`));

    return {
      sessionId: session.id,
      startedAt: session.startedAt,
      durationSec: session.durationSec,
      style: dto.style,
    };
  }

  async next(userId: string, sessionId: string) {
    const session = await this.ownedSession(userId, sessionId);
    if (session.endedAt) throw new BadRequestException('session ended');

    const style = normalizeStyle(session.style);
    const progression = await this.styleProgression(userId, style);

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

    // Theme sessions are unrated — they pin puzzle difficulty to the user's
    // chosen startRating and never touch the adaptive progression.
    const servingRating = session.mode === 'theme'
      ? session.startRating
      : progression.currentPuzzleRating;

    const puzzle = await this.buffer.getNext({
      sessionId,
      userId,
      rating: servingRating,
      theme: session.theme,
    });
    if (!puzzle) throw new NotFoundException('no puzzles available');

    return {
      puzzle,
      currentRating: servingRating,
      session: {
        id: session.id,
        startedAt,
        durationSec: session.durationSec,
        style,
        mode: session.mode,
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

    const style = normalizeStyle(session.style);

    // Count the current streak (run of correct attempts ending at the one
    // just recorded). Needed both for the rating multiplier and for the
    // frontend's visual feedback. Scan enough history to find where the
    // streak broke even for long runs.
    const recent = await this.prisma.trainingAttempt.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { correct: true },
    });
    let streak = 0;
    for (const a of recent) {
      if (a.correct) streak++;
      else break;
    }

    // Theme sessions are unrated — skip the rating step entirely and keep the
    // user's progression untouched. We still want attempts + review items
    // recorded above, so they show up in history.
    if (session.mode === 'theme') {
      return { newRating: session.startRating, step: 0, streak };
    }

    const windowAttempts = await this.prisma.trainingAttempt.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: WINDOW,
    });
    const progression = await this.styleProgression(userId, style);
    const step = computeRatingStep(
      progression.currentPuzzleRating,
      windowAttempts.map((a) => ({
        correct: a.correct,
        responseMs: a.responseMs,
        puzzleRating: a.puzzleRating,
      })),
      streak,
    );
    const next = Math.max(MIN_RATING, Math.min(MAX_RATING, progression.currentPuzzleRating + step));
    await this.prisma.userStyleProgression.update({
      where: { userId_style: { userId, style } },
      data: { currentPuzzleRating: next },
    });

    return { newRating: next, step, streak };
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

    const style = normalizeStyle(session.style);

    // Theme sessions are unrated — no unlock check, no reward.
    if (session.mode === 'theme') {
      await this.buffer.clearSession(sessionId);
      return {
        ...(await this.summary(sessionId)),
        unlocked: false,
        style,
      };
    }

    const progression = await this.styleProgression(userId, style);
    const check = evaluateUnlock(style, stats, session.durationSec, session.startRating);
    if (check.met) {
      await this.prisma.userStyleProgression.update({
        where: { userId_style: { userId, style } },
        data: { unlockedStartRating: progression.unlockedStartRating + UNLOCK_REWARD },
      });
    }

    await this.buffer.clearSession(sessionId);
    return {
      ...(await this.summary(sessionId)),
      unlocked: check.met,
      unlockCheck: check,
      style,
    };
  }

  /** Delete a finished session (used by the list's swipe-to-delete). */
  async remove(userId: string, sessionId: string) {
    const session = await this.ownedSession(userId, sessionId);
    await this.prisma.trainingSession.delete({ where: { id: session.id } });
    return { ok: true };
  }

  /**
   * Returns puzzles from this session that the user failed or solved too
   * slowly, ready to be drilled in a separate review runner. "Slow" is
   * adaptive — 1.5x the session's own average response time — so a fast
   * solver doesn't get flagged for a 7s puzzle while a deliberate solver
   * isn't punished for 15s.
   */
  async reviewItems(userId: string, sessionId: string) {
    await this.ownedSession(userId, sessionId);
    const attempts = await this.prisma.trainingAttempt.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { puzzleId: true, correct: true, responseMs: true, puzzleRating: true },
    });
    if (attempts.length === 0) return { items: [] };

    const avgMs = attempts.reduce((s, a) => s + a.responseMs, 0) / attempts.length;
    const slowCutoff = Math.max(avgMs * 1.5, 5_000);

    // Flag failures unconditionally; flag slow solves using the adaptive
    // cutoff. If a puzzle appears twice, keep the worst reason.
    const flagged = new Map<string, { puzzleId: string; reason: 'failed' | 'slow'; responseMs: number; puzzleRating: number }>();
    for (const a of attempts) {
      const reason: 'failed' | 'slow' | null = !a.correct
        ? 'failed'
        : (a.responseMs > slowCutoff ? 'slow' : null);
      if (!reason) continue;
      const prev = flagged.get(a.puzzleId);
      if (!prev || (prev.reason === 'slow' && reason === 'failed')) {
        flagged.set(a.puzzleId, { puzzleId: a.puzzleId, reason, responseMs: a.responseMs, puzzleRating: a.puzzleRating });
      }
    }
    if (flagged.size === 0) return { items: [] };

    const puzzles = await this.prisma.puzzle.findMany({
      where: { id: { in: [...flagged.keys()] } },
      select: {
        id: true, fen: true, moves: true, rating: true,
        themes: { include: { theme: { select: { slug: true } } } },
      },
    });
    const byId = new Map(puzzles.map((p) => [p.id, p]));

    // Preserve the attempt order so the review queue feels chronological.
    const items = [...flagged.values()]
      .map((f) => {
        const p = byId.get(f.puzzleId);
        if (!p) return null;
        return {
          puzzleId: f.puzzleId,
          reason: f.reason,
          responseMs: f.responseMs,
          rating: p.rating,
          fen: p.fen,
          moves: p.moves,
          themes: p.themes.map((pt) => pt.theme.slug),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { items };
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

  /**
   * Loads the per-style progression row, creating a default one if somehow
   * missing (e.g. a user imported before the backfill migration ran).
   */
  private async styleProgression(userId: string, style: TrainingStyle) {
    const existing = await this.prisma.userStyleProgression.findUnique({
      where: { userId_style: { userId, style } },
    });
    if (existing) return existing;
    return this.prisma.userStyleProgression.create({
      data: { userId, style },
    });
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
      style: s.style,
    };
  }
}

function normalizeStyle(raw: string): TrainingStyle {
  return isTrainingStyle(raw) ? raw : 'blitz';
}
