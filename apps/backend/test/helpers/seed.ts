import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { deriveSessionStats } from '../../src/sessions/rating';
import type { TrainingStyle } from '../../src/sessions/unlock';
import { fixturePuzzle } from './db';

export const DEFAULT_PASSWORD = 'Passw0rd1';

type StyleOverrides = Partial<{
  startPuzzleRating: number;
  currentPuzzleRating: number;
  unlockedStartRating: number;
  weakSessionStreak: number;
  calibrationSessionsLeft: number;
}>;

export type SeedUserOpts = {
  nickname: string;
  password?: string;
  language?: 'en' | 'uk';
  /** Per-style progression overrides; unspecified styles get schema defaults. */
  styles?: Partial<Record<TrainingStyle, StyleOverrides>>;
  settings?: Record<string, unknown>;
  streak?: Partial<{ streakDays: number; streakFreezes: number; streakLastDay: string | null; streakFreezeRegenAt: string | null }>;
  verified?: boolean;
  isAdmin?: boolean;
};

export type SeededUser = { id: string; nickname: string; password: string };

/** Creates a user the same way /auth/register does (settings + progression + 3 style rows). */
export async function createUser(prisma: PrismaClient, opts: SeedUserOpts): Promise<SeededUser> {
  const password = opts.password ?? DEFAULT_PASSWORD;
  // Cost 4 keeps seeding fast; bcrypt.compare reads the cost from the hash.
  const passwordHash = await bcrypt.hash(password, 4);
  const styles: TrainingStyle[] = ['bullet', 'blitz', 'rapid'];
  const user = await prisma.user.create({
    data: {
      nickname: opts.nickname,
      passwordHash,
      verified: opts.verified ?? false,
      isAdmin: opts.isAdmin ?? false,
      ...(opts.streak ?? {}),
      settings: { create: { ...(opts.language ? { language: opts.language } : {}), ...(opts.settings ?? {}) } },
      progression: { create: {} },
      styleProgressions: {
        create: styles.map((style) => ({ style, ...(opts.styles?.[style] ?? {}) })),
      },
    },
  });
  return { id: user.id, nickname: user.nickname, password };
}

/** Signs a token identical in shape to AuthService.issueToken (same JwtService/secret/expiry). */
export function tokenFor(jwt: JwtService, user: { id: string; nickname: string }) {
  return jwt.sign({ sub: user.id, nickname: user.nickname });
}

export type SeedAttempt = { puzzleId: string; correct: boolean; responseMs: number };

/**
 * Inserts a finished session with its attempts directly (no API), stats
 * derived with the production deriveSessionStats so rows look real.
 */
export async function createFinishedSession(
  prisma: PrismaClient,
  userId: string,
  opts: {
    style?: TrainingStyle;
    mode?: 'mixed' | 'theme';
    theme?: string | null;
    startRating?: number;
    durationSec?: number;
    startedAt?: Date;
    attempts: SeedAttempt[];
  },
) {
  const durationSec = opts.durationSec ?? 300;
  const startedAt = opts.startedAt ?? new Date(Date.now() - durationSec * 1000 - 60_000);
  const startRating = opts.startRating ?? 1200;
  const rows = opts.attempts.map((a, i) => ({
    ...a,
    puzzleRating: fixturePuzzle(a.puzzleId).rating,
    createdAt: new Date(startedAt.getTime() + (i + 1) * 1000),
  }));
  const stats = deriveSessionStats(rows, startRating);
  const session = await prisma.trainingSession.create({
    data: {
      userId,
      mode: opts.mode ?? 'mixed',
      style: opts.style ?? 'blitz',
      theme: opts.theme ?? null,
      startRating,
      durationSec,
      startedAt,
      endedAt: new Date(startedAt.getTime() + durationSec * 1000),
      solvedCount: stats.solved,
      failedCount: stats.failed,
      accuracy: stats.accuracy,
      avgResponseMs: stats.avgResponseMs,
      peakRating: stats.peakRating,
    },
  });
  if (rows.length > 0) {
    await prisma.trainingAttempt.createMany({
      data: rows.map((r) => ({ ...r, sessionId: session.id, userId })),
    });
  }
  return session;
}

export async function createReviewItem(prisma: PrismaClient, userId: string, puzzleId: string, resolved = false) {
  return prisma.reviewItem.create({
    data: { userId, puzzleId, resolvedAt: resolved ? new Date() : null },
  });
}

export async function createFriendship(
  prisma: PrismaClient,
  requesterId: string,
  addresseeId: string,
  status: 'pending' | 'accepted' = 'accepted',
) {
  return prisma.friendship.create({
    data: { requesterId, addresseeId, status, acceptedAt: status === 'accepted' ? new Date() : null },
  });
}

/**
 * Replaces a session's Redis puzzle queue with the given fixture puzzles
 * so /next serves them in exactly this order (the buffer RPOPs; LPUSH
 * of a,b,c leaves c..a, so a is served first). Uses the buffer's own
 * cached-puzzle JSON shape.
 */
export async function primeQueue(redis: Redis, sessionId: string, puzzleIds: string[]) {
  const key = `session:${sessionId}:queue`;
  await redis.del(key);
  if (puzzleIds.length === 0) return;
  const payloads = puzzleIds.map((id) => {
    const p = fixturePuzzle(id);
    return JSON.stringify({
      id: p.id,
      fen: p.fen,
      moves: p.moves.split(' '),
      rating: p.rating,
      gameUrl: p.gameUrl,
      themes: [...p.themes],
    });
  });
  await redis.lpush(key, ...payloads);
}

/** Moves a live session's startedAt back so `finish` treats it as a full-duration (non-early) finish. */
export async function backdateSession(prisma: PrismaClient, sessionId: string, seconds: number) {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { startedAt: new Date(Date.now() - seconds * 1000) },
  });
}
