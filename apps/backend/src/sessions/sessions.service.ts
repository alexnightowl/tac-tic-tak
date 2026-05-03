import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PuzzleBufferService } from '../puzzles/puzzle-buffer.service';
import { AttemptDto, CreateSessionDto } from './dto';
import { computeRatingStep, deriveSessionStats } from './rating';
import {
  evaluateUnlock,
  evaluateDemote,
  evaluateCalibration,
  isTrainingStyle,
  TrainingStyle,
  UNLOCK_REWARD,
  DEMOTE_PEAK_BAND,
} from './unlock';
import { applyStreakOnPlay, isValidDay, StreakState } from './streak';
import { AchievementsService } from '../achievements/achievements.service';

const WINDOW = 4;
const MIN_RATING = 400;
const MAX_RATING = 3000;

@Injectable()
export class SessionsService {
  private readonly log = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buffer: PuzzleBufferService,
    private readonly achievements: AchievementsService,
  ) {}

  async create(userId: string, dto: CreateSessionDto) {
    const styleRow = await this.styleProgression(userId, dto.style);

    // Calibration sessions ignore whatever startRating the client sent
    // and use the server-controlled progression rating instead. Without
    // this, a player could pick a low rating, sail through 5 easy
    // sessions, and call calibration "done" at a rating that doesn't
    // reflect their real strength. UI hides the picker during
    // calibration too — this is the belt to that suspenders.
    const calibrating =
      dto.mode !== 'theme' && styleRow.calibrationSessionsLeft > 0;
    const startRating = calibrating ? styleRow.currentPuzzleRating : dto.startRating;

    // The +200 unlock-cap check only applies in stable mode. During
    // calibration the player's currentPuzzleRating is allowed to
    // overshoot the unlock cap (which is still anchored at the
    // brand-new-account default) — that's literally how we discover
    // their level. We're using `startRating` (post-override) here so
    // the comparison is against the value that's actually going to
    // be persisted on the session row.
    if (dto.mode !== 'theme' && !calibrating && startRating > styleRow.unlockedStartRating + 200) {
      throw new BadRequestException(`startRating exceeds unlocked cap (${styleRow.unlockedStartRating})`);
    }

    const session = await this.prisma.trainingSession.create({
      data: {
        userId,
        mode: dto.mode,
        style: dto.style,
        theme: dto.theme ?? null,
        startRating,
        durationSec: dto.durationSec,
      },
    });
    if (dto.mode !== 'theme') {
      await this.prisma.userStyleProgression.update({
        where: { userId_style: { userId, style: dto.style } },
        data: { currentPuzzleRating: startRating, startPuzzleRating: startRating },
      });
    }

    // Pop the first puzzle synchronously and embed it in the response so
    // the client doesn't pay a second round-trip to /next before showing
    // the board. Previously we fire-and-forgot the warm, then the client
    // raced to /next and often hit a cold queue that had to preload from
    // Postgres with an ORDER BY random() over a multi-million-row table
    // — the slow first-puzzle problem.
    // Both theme-mode and rated sessions serve at the resolved
    // startRating: rated sessions just had their currentPuzzleRating
    // bumped to it above (or kept at the calibration-controlled value).
    const servingRating = startRating;
    let firstPuzzle: Awaited<ReturnType<typeof this.buffer.getNext>> = null;
    try {
      firstPuzzle = await this.buffer.getNext({
        sessionId: session.id,
        userId,
        rating: servingRating,
        theme: dto.theme ?? null,
      });
    } catch (e: unknown) {
      this.log.error(`initial preload failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Reset startedAt to NOW — the client is about to see the first
    // puzzle on this response, not when the row was inserted. Matches
    // what /next did on first call before this change.
    const startedAt = new Date();
    await this.prisma.trainingSession.update({
      where: { id: session.id },
      data: { startedAt },
    });

    return {
      sessionId: session.id,
      startedAt,
      durationSec: session.durationSec,
      style: dto.style,
      // NextResponse-shaped payload. Client uses this directly instead
      // of issuing POST /sessions/:id/next for the first puzzle. Null
      // if preload failed — client falls back to /next.
      firstPuzzle: firstPuzzle
        ? {
            puzzle: firstPuzzle,
            currentRating: servingRating,
            session: {
              id: session.id,
              startedAt,
              durationSec: session.durationSec,
              style: dto.style,
              mode: session.mode,
            },
          }
        : null,
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

  async finish(
    userId: string,
    sessionId: string,
    opts: { save?: boolean; localDate?: string } = {},
  ) {
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

    // Daily-streak update happens for any saved session — theme,
    // calibration, early-exit, full duration. The point is "did
    // the player open the app and play today?", not "did they
    // qualify for level-up?". See sessions/streak.ts for rules.
    const streakOutcome = await this.tickStreak(userId, opts.localDate);

    const style = normalizeStyle(session.style);

    // Theme sessions are unrated — no unlock check, no reward.
    if (session.mode === 'theme') {
      await this.buffer.clearSession(sessionId);
      const newAchievements = await this.achievements.evaluate(userId);
      return {
        ...(await this.summary(sessionId)),
        unlocked: false,
        streak: streakOutcome,
        achievementsUnlocked: newAchievements,
        style,
      };
    }

    // Early-exit guard. The play runner only calls `finish` two ways:
    // (a) timer naturally expired, (b) user pressed the exit dialog's
    // "Save" button mid-session. Server-side we tell them apart by
    // elapsed time vs declared duration — trusting a client flag would
    // let a tampered client farm level-ups by ending after one good
    // puzzle. 3s grace covers clock drift and the network round-trip
    // between the client's "time's up" tick and this handler.
    const elapsedSec = (Date.now() - session.startedAt.getTime()) / 1000;
    const earlyExit = elapsedSec < session.durationSec - 3;
    if (earlyExit) {
      await this.buffer.clearSession(sessionId);
      const newAchievements = await this.achievements.evaluate(userId);
      return {
        ...(await this.summary(sessionId)),
        unlocked: false,
        early: true,
        streak: streakOutcome,
        achievementsUnlocked: newAchievements,
        style,
      };
    }

    const progression = await this.styleProgression(userId, style);
    // Criteria check runs in either mode — UI uses it for the in-
    // session progress bar regardless of whether unlock fires.
    const check = evaluateUnlock(style, stats, session.durationSec, session.startRating);

    let nextUnlocked = progression.unlockedStartRating;
    let nextWeakStreak = progression.weakSessionStreak;
    let nextCalibrationLeft = progression.calibrationSessionsLeft;
    let unlocked = false;
    let demoted = false;
    let demoteResponse: {
      atPeak: boolean;
      weak: boolean;
      criteriaMet: number;
      streakAfter: number;
      threshold: number;
      penalty: number;
      unlockedStartRating: number;
    } | null = null;
    let calibrationResponse: {
      active: boolean;
      sessionsLeftBefore: number;
      sessionsLeftAfter: number;
      ceilingBefore: number;
      ceilingAfter: number;
      delta: number;
    } | null = null;

    if (progression.calibrationSessionsLeft > 0) {
      // Provisional period — criteria-driven step from the rating the
      // player actually tried this session. No weak-streak accounting
      // (reset for safety). The UI doesn't render a calibration card
      // explicitly — outcomes are routed to the standard
      // unlocked/demoted cards based on direction so the player just
      // sees a normal session summary with a "?" next to their rating
      // until calibration ends.
      const cal = evaluateCalibration(
        progression.unlockedStartRating,
        progression.startPuzzleRating,
        session.startRating,
        check,
        progression.calibrationSessionsLeft,
      );
      nextUnlocked = cal.ceilingAfter;
      nextCalibrationLeft = cal.sessionsLeftAfter;
      nextWeakStreak = 0;
      calibrationResponse = {
        active: cal.active,
        sessionsLeftBefore: cal.sessionsLeftBefore,
        sessionsLeftAfter: cal.sessionsLeftAfter,
        ceilingBefore: cal.ceilingBefore,
        ceilingAfter: cal.ceilingAfter,
        delta: cal.delta,
      };

      // Mirror the calibration outcome onto the standard
      // unlocked/demoted flags so the UI can reuse the existing
      // outcome cards. 4 of 4 criteria → unlocked (+50). Strict
      // ceiling drop → demoted card (the rose-coloured "cap
      // adjusted" UI). Holds (0 / +50 with no movement, e.g. floor
      // clamp) just show the criteria progress card with no
      // celebration.
      if (cal.delta > 0) {
        unlocked = true;
      } else if (cal.delta < 0) {
        demoted = true;
        demoteResponse = {
          atPeak: true,
          weak: true,
          criteriaMet: cal.criteriaMet,
          streakAfter: 0,
          threshold: 1,
          penalty: -cal.delta,
          unlockedStartRating: nextUnlocked,
        };
      }
    } else {
      // Stable mode. Unlock requires criteria-met AND a session
      // started inside the peak band; sessions in the comfort zone
      // can't farm the ceiling. Demote already enforces the same
      // band on its side, keeping things symmetric.
      const atPeak =
        session.startRating >= progression.unlockedStartRating - DEMOTE_PEAK_BAND;
      unlocked = check.met && atPeak;

      const demote = evaluateDemote(
        unlocked,
        check,
        session.startRating,
        progression.unlockedStartRating,
        progression.weakSessionStreak,
      );
      demoted = demote.demoted;

      if (unlocked) {
        nextUnlocked = progression.unlockedStartRating + UNLOCK_REWARD;
        nextWeakStreak = 0;
      } else if (demote.demoted) {
        nextUnlocked = Math.max(
          progression.startPuzzleRating,
          progression.unlockedStartRating - demote.penalty,
        );
        nextWeakStreak = demote.streakAfter;
      } else {
        nextWeakStreak = demote.streakAfter;
      }

      demoteResponse = {
        atPeak: demote.atPeak,
        weak: demote.weak,
        criteriaMet: demote.criteriaMet,
        streakAfter: demote.streakAfter,
        threshold: 2,
        penalty: demote.penalty,
        unlockedStartRating: nextUnlocked,
      };
    }

    if (
      nextUnlocked !== progression.unlockedStartRating ||
      nextWeakStreak !== progression.weakSessionStreak ||
      nextCalibrationLeft !== progression.calibrationSessionsLeft
    ) {
      await this.prisma.userStyleProgression.update({
        where: { userId_style: { userId, style } },
        data: {
          unlockedStartRating: nextUnlocked,
          weakSessionStreak: nextWeakStreak,
          calibrationSessionsLeft: nextCalibrationLeft,
        },
      });
    }

    await this.buffer.clearSession(sessionId);
    const newAchievements = await this.achievements.evaluate(userId);
    return {
      ...(await this.summary(sessionId)),
      unlocked,
      unlockCheck: check,
      demoted,
      demoteCheck: demoteResponse,
      calibration: calibrationResponse,
      streak: streakOutcome,
      achievementsUnlocked: newAchievements,
      style,
    };
  }

  /**
   * Apply today's session to the user's daily streak. The client
   * provides its local 'YYYY-MM-DD' (we don't store TZ on User).
   * If the day param is missing or malformed, we leave the streak
   * untouched and return null — better than guessing UTC and
   * ticking the wrong day for someone several timezones west.
   */
  private async tickStreak(
    userId: string,
    localDate: string | undefined,
  ): Promise<{
    days: number;
    freezes: number;
    lastDay: string | null;
    freezeRegenAt: string | null;
    outcome: 'same-day' | 'continued' | 'frozen' | 'reset' | 'started' | 'skipped';
  } | null> {
    if (!localDate || !isValidDay(localDate)) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        streakDays: true,
        streakFreezes: true,
        streakLastDay: true,
        streakFreezeRegenAt: true,
      },
    });
    if (!user) return null;

    const before: StreakState = {
      streakDays: user.streakDays,
      streakFreezes: user.streakFreezes,
      streakLastDay: user.streakLastDay,
      streakFreezeRegenAt: user.streakFreezeRegenAt,
    };
    const { next, outcome } = applyStreakOnPlay(before, localDate);

    if (
      next.streakDays !== before.streakDays ||
      next.streakFreezes !== before.streakFreezes ||
      next.streakLastDay !== before.streakLastDay ||
      next.streakFreezeRegenAt !== before.streakFreezeRegenAt
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          streakDays: next.streakDays,
          streakFreezes: next.streakFreezes,
          streakLastDay: next.streakLastDay,
          streakFreezeRegenAt: next.streakFreezeRegenAt,
        },
      });
    }

    return {
      days: next.streakDays,
      freezes: next.streakFreezes,
      lastDay: next.streakLastDay,
      freezeRegenAt: next.streakFreezeRegenAt,
      outcome,
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
