import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Challenge, Prisma, StormRun } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExperienceService } from '../experience/experience.service';
import { OfflineService } from '../offline/offline.service';
import { PuzzleBufferService } from '../puzzles/puzzle-buffer.service';
import { trainingXp } from '../sessions/progress';
import {
  ChallengeCreateDto,
  STORM_LIVES,
  STREAM_LENGTH,
  StormRunDto,
  type StormFormat,
} from './dto';

// Puzzle Storm and the async Race (docs/mobile/STORM.md). Mobile-only; the
// web never calls these routes. Nothing here touches a rating.

/** Solo Storm's ladder starts here for everyone, so friends' scores compare. */
export const SOLO_BASE = 1000;
const LADDER_SPAN = 1600;
const LADDER_TAU = 50;
/** Ids are drawn from a pool per 50-rating bucket. */
const BUCKET = 50;
const POOL_PER_BUCKET = 300;
const POOL_TTL_MS = 6 * 3600_000;
/** Storm puzzles: well liked, well played, short (setup + up to 3 player moves). */
const MIN_POPULARITY = 85;
const MIN_PLAYS = 300;
const MAX_DEVIATION = 90;
const MAX_PLIES = 6;
const CHALLENGE_TTL_MS = 24 * 3600_000;
const CHALLENGES_PER_DAY = 30;
const FINISHED_SHOWN = 10;
const DEFAULT_RATING = 1200;
/** Longest a run may last: the clock plus every combo bonus a stream can buy, else 2 h (Survival). */
const RUN_CAP_MS: Record<StormFormat, number> = { time3: 270_000, time5: 390_000, survival: 2 * 3600_000 };
/** Slack between the phone's clock and ours. */
const CLOCK_SLACK_MS = 30_000;

/** Target rating of the i-th puzzle of a stream from `base` (core stormLadder). */
export function ladder(i: number, base: number): number {
  return Math.round((base + LADDER_SPAN * (1 - Math.exp(-i / LADDER_TAU))) / 10) * 10;
}

/** A Race's base under both players' ratings (core raceBase). */
export function raceBase(a: number, b: number): { base: number; avg: number } {
  const avg = Math.round((a + b) / 2);
  return { base: Math.min(1800, Math.max(600, Math.round((avg - 600) / 10) * 10)), avg };
}

type Result = { i: number; ok: boolean; ms: number };
type UserCard = { id: string; nickname: string; displayName: string | null; avatarUrl: string | null };
const USER_CARD = { id: true, nickname: true, displayName: true, avatarUrl: true } as const;

/** Local midnight of the day `daysBack` before today, as a UTC instant. */
function localMidnight(tzOffsetMin: number, daysBack = 0): Date {
  const local = new Date(Date.now() - tzOffsetMin * 60_000);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - daysBack * 86_400_000;
  return new Date(day + tzOffsetMin * 60_000);
}

/** Days since Monday in the player's local calendar. */
function sinceMonday(tzOffsetMin: number): number {
  const local = new Date(Date.now() - tzOffsetMin * 60_000);
  return (local.getUTCDay() + 6) % 7;
}

@Injectable()
export class StormService implements OnModuleInit {
  private readonly log = new Logger(StormService.name);
  private readonly pool = new Map<number, { at: number; rows: Promise<{ id: string; rating: number }[]> }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly buffer: PuzzleBufferService,
    private readonly experience: ExperienceService,
    private readonly offline: OfflineService,
  ) {}

  /** Warm the solo ladder's buckets in the background; boot does not wait. */
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => {
      const keys = [...new Set(Array.from({ length: STREAM_LENGTH }, (_, i) => this.bucketOf(ladder(i, SOLO_BASE))))];
      void (async () => {
        for (const k of keys) await this.bucket(k).catch(() => undefined);
        this.log.log(`storm pool warm: ${keys.length} buckets`);
      })();
    }, 5_000);
  }

  // ─── Streams ───────────────────────────────────────────────────────────

  private bucketOf(rating: number): number {
    return Math.round(rating / BUCKET) * BUCKET;
  }

  private bucket(key: number): Promise<{ id: string; rating: number }[]> {
    const hit = this.pool.get(key);
    if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.rows;
    const lo = key - BUCKET / 2;
    const hi = key + BUCKET / 2 - 1;
    const rows = this.prisma.$queryRaw<{ id: string; rating: number }[]>`
      SELECT p."id", p."rating" FROM "Puzzle" p
      WHERE p."rating" BETWEEN ${lo} AND ${hi}
        AND p."popularity" >= ${MIN_POPULARITY}
        AND p."nbPlays" >= ${MIN_PLAYS}
        AND p."ratingDeviation" <= ${MAX_DEVIATION}
        AND array_length(string_to_array(p."moves", ' '), 1) <= ${MAX_PLIES}
      ORDER BY random()
      LIMIT ${POOL_PER_BUCKET}
    `;
    this.pool.set(key, { at: Date.now(), rows });
    rows.catch(() => this.pool.delete(key));
    return rows;
  }

  /** 100 distinct puzzle ids on the ladder from `base`, in rising rating. */
  private async pickStream(base: number): Promise<string[]> {
    // Load every bucket the ladder may touch at once (a cold Race base is ~30 scans).
    const keys = new Set<number>();
    for (let i = 0; i < STREAM_LENGTH; i++) {
      const key = this.bucketOf(ladder(i, base));
      for (const k of [key, key + BUCKET, key - BUCKET, key + 2 * BUCKET]) keys.add(k);
    }
    await Promise.all([...keys].map((k) => this.bucket(k).catch(() => [])));
    const used = new Set<string>();
    const picked: { id: string; rating: number }[] = [];
    for (let i = 0; i < STREAM_LENGTH; i++) {
      const key = this.bucketOf(ladder(i, base));
      // The bucket, then its neighbours when it is thin or used up.
      for (const k of [key, key + BUCKET, key - BUCKET, key + 2 * BUCKET]) {
        const free = (await this.bucket(k).catch(() => [])).filter((r) => !used.has(r.id));
        if (free.length === 0) continue;
        const r = free[Math.floor(Math.random() * free.length)];
        used.add(r.id);
        picked.push(r);
        break;
      }
    }
    return picked.sort((a, b) => a.rating - b.rating).map((r) => r.id);
  }

  private async streamOut(stream: { id: string; base: number; puzzleIds: string[] }) {
    const hydrated = await this.buffer.hydrate(stream.puzzleIds);
    // Indices must match the stored ids: a puzzle gone since cuts the stream there.
    const gap = hydrated.findIndex((p, i) => p.id !== stream.puzzleIds[i]);
    const puzzles = gap < 0 ? hydrated : hydrated.slice(0, gap);
    return {
      streamId: stream.id,
      base: stream.base,
      puzzles: puzzles.map(({ id, fen, moves, rating, themes }) => ({ id, fen, moves, rating, themes })),
    };
  }

  private async createStream(userId: string, base: number, tx: Prisma.TransactionClient = this.prisma) {
    const puzzleIds = await this.pickStream(base);
    if (puzzleIds.length < 20) throw new HttpException('not enough puzzles', HttpStatus.SERVICE_UNAVAILABLE);
    return tx.stormStream.create({ data: { userId, base, puzzleIds } });
  }

  /** A fresh solo stream, or a challenge's stream for its two players. */
  async stream(userId: string, challengeId?: string) {
    if (!challengeId) return this.streamOut(await this.createStream(userId, SOLO_BASE));
    const c = await this.challengeFor(userId, challengeId);
    const stream = await this.prisma.stormStream.findUniqueOrThrow({ where: { id: c.streamId } });
    return this.streamOut(stream);
  }

  async streamById(userId: string, id: string) {
    const stream = await this.prisma.stormStream.findUnique({ where: { id } });
    if (!stream) throw new NotFoundException('stream not found');
    if (stream.userId !== userId) {
      const shared = await this.prisma.challenge.findFirst({
        where: { streamId: id, OR: [{ challengerId: userId }, { opponentId: userId }] },
        select: { id: true },
      });
      if (!shared) throw new NotFoundException('stream not found');
    }
    return this.streamOut(stream);
  }

  // ─── Runs ──────────────────────────────────────────────────────────────

  private checkResults(dto: StormRunDto, streamLength: number): Result[] {
    const results = dto.results.map((r) => ({ i: r.i, ok: r.ok, ms: r.ms }));
    const ok = results.filter((r) => r.ok).length;
    const consistent =
      results.every((r, k) => r.i === k && r.i < streamLength) &&
      ok === dto.score &&
      results.length - ok === dto.mistakes &&
      dto.bestCombo <= dto.score &&
      dto.lastSolveMs <= dto.durationMs &&
      dto.mistakes <= STORM_LIVES &&
      dto.durationMs <= RUN_CAP_MS[dto.format] &&
      results.every((r) => r.ms <= dto.durationMs);
    if (!consistent) throw new BadRequestException('run does not add up');
    return results;
  }

  async saveRun(userId: string, dto: StormRunDto) {
    const dup = await this.replay(userId, dto);
    if (dup) return dup;

    const stream = await this.prisma.stormStream.findUnique({ where: { id: dto.streamId } });
    if (!stream) throw new NotFoundException('stream not found');
    let challenge: Challenge | null = null;
    if (dto.challengeId) {
      challenge = await this.challengeFor(userId, dto.challengeId);
      const mine = challenge.challengerId === userId;
      const open = mine ? challenge.status === 'draft' : this.statusOf(challenge) === 'pending';
      if (challenge.streamId !== stream.id || challenge.format !== dto.format) throw new BadRequestException('wrong stream');
      if (!open) throw new ConflictException('challenge closed');
    } else {
      // Solo Storm is 3 minutes, one run per stream (a replay would know the answers).
      if (stream.userId !== userId) throw new NotFoundException('stream not found');
      if (dto.format !== 'time3') throw new BadRequestException('solo runs are 3 minutes');
      if (await this.prisma.stormRun.count({ where: { streamId: stream.id, userId, challengeId: null } })) {
        throw new ConflictException('stream already played');
      }
    }
    const results = this.checkResults(dto, stream.puzzleIds.length);
    // A stream I fetched myself bounds the run's length (XP comes from it).
    const own = stream.userId === userId && (!challenge || challenge.challengerId === userId);
    if (own && dto.durationMs > Date.now() - stream.createdAt.getTime() + CLOCK_SLACK_MS) {
      throw new BadRequestException('run longer than its stream');
    }

    const played = stream.puzzleIds.slice(0, results.length);
    const ratings = await this.prisma.puzzle.findMany({ where: { id: { in: played } }, select: { id: true, rating: true } });
    const ratingOf = new Map(ratings.map((r) => [r.id, r.rating]));
    const solved = results.filter((r) => r.ok).map((r) => ratingOf.get(stream.puzzleIds[r.i]) ?? 0);
    const hardest = solved.length > 0 ? Math.max(...solved) : null;
    const previousBest = challenge ? null : await this.best(userId);

    const saved = await this.prisma.$transaction(async (tx) => {
      const run = await tx.stormRun.create({
        data: {
          clientId: dto.clientId,
          userId,
          streamId: stream.id,
          format: dto.format,
          challengeId: challenge?.id ?? null,
          score: dto.score,
          mistakes: dto.mistakes,
          bestCombo: dto.bestCombo,
          durationMs: dto.durationMs,
          lastSolveMs: dto.lastSolveMs,
          hardest,
          results,
        },
      });

      for (const r of results.filter((x) => !x.ok)) {
        const puzzleId = stream.puzzleIds[r.i];
        await tx.reviewItem.upsert({
          where: { userId_puzzleId: { userId, puzzleId } },
          create: { userId, puzzleId },
          update: { resolvedAt: null },
        });
      }

      // XP from the whole Storm time, so short runs still add up to minutes.
      const total = await tx.stormRun.aggregate({ where: { userId }, _sum: { durationMs: true } });
      const totalMs = total._sum.durationMs ?? 0;
      const gained = trainingXp(totalMs) - trainingXp(totalMs - dto.durationMs);
      const xp = await this.experience.award(userId, { source: 'storm', xp: gained, trainingSec: dto.durationMs / 1000 }, tx);

      if (challenge) {
        // Conditional on the state read above: a decline, an expiry or the
        // other device's run in between rolls this run back.
        const now = new Date();
        const moved = challenge.challengerId === userId
          ? await tx.challenge.updateMany({
              where: { id: challenge.id, status: 'draft' },
              data: { status: 'pending', challengerRunId: run.id, sentAt: now, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) },
            })
          : await tx.challenge.updateMany({
              where: { id: challenge.id, status: 'pending', expiresAt: { gt: now } },
              data: { status: 'finished', opponentRunId: run.id, finishedAt: now },
            });
        if (moved.count === 0) throw new ConflictException('challenge closed');
      }
      return { run, xp };
    }).catch(async (e: unknown) => {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      // The same run sent twice at once: the first one's answer.
      const again = await this.replay(userId, dto);
      if (again) return { replayed: again };
      // A second run in the same challenge (another device) loses.
      throw new ConflictException('already played');
    });
    if ('replayed' in saved) return saved.replayed;

    const streak = dto.localDay && dto.tzOffsetMin != null
      ? await this.offline.applyStreak(userId, [{ localDay: dto.localDay }], dto.tzOffsetMin)
      : null;
    return this.runSaved(userId, saved.run, saved.xp, streak, dto.tzOffsetMin ?? 0, previousBest);
  }

  /** A run already stored under this clientId: the same answer again. */
  private async replay(userId: string, dto: StormRunDto) {
    const dup = await this.prisma.stormRun.findUnique({ where: { clientId: dto.clientId } });
    if (!dup) return null;
    if (dup.userId !== userId) throw new ConflictException('clientId taken');
    return this.runSaved(userId, dup, null, null, dto.tzOffsetMin ?? 0);
  }

  private async runSaved(
    userId: string,
    run: StormRun,
    xp: Awaited<ReturnType<ExperienceService['award']>> | null,
    streak: { days: number; outcome: string } | null,
    tzOffsetMin: number,
    previousBest?: { score: number; at: string } | null,
  ) {
    const solo = run.challengeId == null;
    const prev = solo ? (previousBest !== undefined ? previousBest : await this.best(userId, run.createdAt)) : null;
    let friendsRank: number | null = null;
    let friendsCount = 0;
    if (solo) {
      const week = await this.week(userId, tzOffsetMin);
      friendsCount = week.length;
      const at = week.findIndex((r) => r.me);
      friendsRank = at >= 0 ? at + 1 : null;
    }
    const challenge = run.challengeId
      ? this.summaryOf(userId, await this.prisma.challenge.findUniqueOrThrow({ where: { id: run.challengeId }, include: CHALLENGE_INCLUDE }))
      : (await this.dareOf(userId, run.id));
    return {
      runId: run.id,
      previousBest: prev,
      isBest: solo && run.score > 0 && (!prev || run.score > prev.score),
      friendsRank,
      friendsCount,
      xp: xp ? { gained: xp.gained, before: xp.before, after: xp.after } : null,
      streak: streak ? { days: streak.days, outcome: streak.outcome } : null,
      ...(challenge ? { challenge } : {}),
    };
  }

  private async dareOf(userId: string, runId: string) {
    const c = await this.prisma.challenge.findFirst({ where: { challengerRunId: runId }, include: CHALLENGE_INCLUDE });
    return c ? this.summaryOf(userId, c) : null;
  }

  /** The best solo score (first time reached), optionally before an instant. */
  private async best(userId: string, before?: Date) {
    const r = await this.prisma.stormRun.findFirst({
      where: { userId, challengeId: null, format: 'time3', ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
      select: { score: true, createdAt: true },
    });
    return r ? { score: r.score, at: r.createdAt.toISOString() } : null;
  }

  private async friendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: 'accepted', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  }

  /** Me and my friends: the best solo score since local Monday, highest first. */
  private async week(userId: string, tzOffsetMin: number) {
    const ids = [userId, ...(await this.friendIds(userId))];
    const since = localMidnight(tzOffsetMin, sinceMonday(tzOffsetMin));
    const rows = await this.prisma.stormRun.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, challengeId: null, format: 'time3', createdAt: { gte: since } },
      _max: { score: true },
    });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: USER_CARD });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows
      .filter((r) => byId.has(r.userId))
      .map((r) => ({ user: byId.get(r.userId)!, score: r._max.score ?? 0, me: r.userId === userId }))
      // Ties: me first, then by nickname.
      .sort((a, b) => b.score - a.score || Number(b.me) - Number(a.me) || a.user.nickname.localeCompare(b.user.nickname));
  }

  async summary(userId: string, tzOffsetMin = 0) {
    const [best, todayRows, week] = await Promise.all([
      this.best(userId),
      this.prisma.stormRun.aggregate({
        where: { userId, challengeId: null, format: 'time3', createdAt: { gte: localMidnight(tzOffsetMin) } },
        _max: { score: true },
        _count: true,
      }),
      this.week(userId, tzOffsetMin),
    ]);
    return { best, today: { best: todayRows._max.score ?? 0, runs: todayRows._count }, week };
  }

  // ─── Challenges ────────────────────────────────────────────────────────

  private statusOf(c: Pick<Challenge, 'status' | 'expiresAt'>): string {
    return c.status === 'pending' && c.expiresAt && c.expiresAt.getTime() <= Date.now() ? 'expired' : c.status;
  }

  private async challengeFor(userId: string, id: string): Promise<Challenge> {
    const c = await this.prisma.challenge.findUnique({ where: { id } });
    // A draft is the challenger's alone until their run is in.
    const visible = c && (c.challengerId === userId || (c.opponentId === userId && c.status !== 'draft'));
    if (!visible) throw new NotFoundException('challenge not found');
    return c;
  }

  /** Each player's rating: their highest style rating (else the global one, else 1200). */
  private async ratings(ids: string[]): Promise<Map<string, number>> {
    const [styles, globals] = await Promise.all([
      this.prisma.userStyleProgression.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { currentPuzzleRating: true } }),
      this.prisma.userProgression.findMany({ where: { userId: { in: ids } }, select: { userId: true, currentPuzzleRating: true } }),
    ]);
    const out = new Map<string, number>();
    for (const id of ids) {
      out.set(
        id,
        styles.find((s) => s.userId === id)?._max.currentPuzzleRating
          ?? globals.find((g) => g.userId === id)?.currentPuzzleRating
          ?? DEFAULT_RATING,
      );
    }
    return out;
  }

  async create(userId: string, dto: ChallengeCreateDto) {
    if (dto.opponentId === userId) throw new BadRequestException('not yourself');
    if (!(await this.friendIds(userId)).includes(dto.opponentId)) throw new ForbiddenException('friends only');
    const today = await this.prisma.challenge.count({
      where: { challengerId: userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (today >= CHALLENGES_PER_DAY) throw new HttpException('too many challenges today', HttpStatus.TOO_MANY_REQUESTS);
    const note = dto.note?.trim() || null;
    const rating = await this.ratings([userId, dto.opponentId]);
    const { base, avg } = raceBase(rating.get(userId)!, rating.get(dto.opponentId)!);

    if (dto.runId) {
      // A dare: my finished solo run is the challenger's run.
      const run = await this.prisma.stormRun.findUnique({ where: { id: dto.runId } });
      if (!run || run.userId !== userId || run.challengeId) throw new NotFoundException('run not found');
      const now = new Date();
      const c = await this.prisma.challenge.create({
        data: {
          challengerId: userId,
          opponentId: dto.opponentId,
          format: run.format,
          streamId: run.streamId,
          avgRating: avg,
          note,
          status: 'pending',
          challengerRunId: run.id,
          sentAt: now,
          expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
        },
        include: CHALLENGE_INCLUDE,
      });
      return { challenge: this.summaryOf(userId, c), stream: null };
    }

    const stream = await this.createStream(userId, base);
    const c = await this.prisma.challenge.create({
      data: { challengerId: userId, opponentId: dto.opponentId, format: dto.format, streamId: stream.id, avgRating: avg, note },
      include: CHALLENGE_INCLUDE,
    });
    return { challenge: this.summaryOf(userId, c), stream: await this.streamOut(stream) };
  }

  async list(userId: string) {
    const now = new Date();
    const [incoming, outgoing, finished] = await Promise.all([
      this.prisma.challenge.findMany({
        where: { opponentId: userId, status: 'pending', expiresAt: { gt: now }, opponentHiddenAt: null },
        include: CHALLENGE_INCLUDE,
        orderBy: { sentAt: 'desc' },
      }),
      this.prisma.challenge.findMany({
        where: { challengerId: userId, status: 'pending', expiresAt: { gt: now }, challengerHiddenAt: null },
        include: CHALLENGE_INCLUDE,
        orderBy: { sentAt: 'desc' },
      }),
      this.prisma.challenge.findMany({
        where: {
          OR: [
            { challengerId: userId, challengerHiddenAt: null },
            { opponentId: userId, opponentHiddenAt: null },
          ],
          AND: [{ OR: [{ status: { in: ['finished', 'declined'] } }, { status: 'pending', expiresAt: { lte: now } }] }],
        },
        include: CHALLENGE_INCLUDE,
        orderBy: { sentAt: 'desc' },
        take: FINISHED_SHOWN,
      }),
    ]);
    const out = (rows: ChallengeRow[]) => rows.map((c) => this.summaryOf(userId, c));
    return { incoming: out(incoming), outgoing: out(outgoing), finished: out(finished) };
  }

  async detail(userId: string, id: string) {
    const c = await this.prisma.challenge.findUnique({ where: { id }, include: CHALLENGE_INCLUDE });
    if (!c || !(c.challengerId === userId || (c.opponentId === userId && c.status !== 'draft'))) {
      throw new NotFoundException('challenge not found');
    }
    const [stream, rating] = await Promise.all([
      this.prisma.stormStream.findUniqueOrThrow({ where: { id: c.streamId } }),
      this.ratings([c.challengerId, c.opponentId]),
    ]);
    const rows = await this.prisma.puzzle.findMany({ where: { id: { in: stream.puzzleIds } }, select: { id: true, rating: true } });
    const ratingOf = new Map(rows.map((r) => [r.id, r.rating]));
    const meIsChallenger = c.challengerId === userId;
    const me = meIsChallenger ? c.challenger : c.opponent;
    const runView = (r: StormRun | null) =>
      r && {
        score: r.score,
        mistakes: r.mistakes,
        bestCombo: r.bestCombo,
        durationMs: r.durationMs,
        lastSolveMs: r.lastSolveMs,
        hardest: r.hardest,
        results: r.results as Result[],
      };
    const summary = this.summaryOf(userId, c);
    // The other player's run stays hidden until I have played mine.
    const myRun = meIsChallenger ? c.challengerRun : c.opponentRun;
    const theirRun = meIsChallenger ? c.opponentRun : c.challengerRun;
    const showTheirs = myRun != null;
    return {
      ...summary,
      streamId: c.streamId,
      avgRating: c.avgRating,
      me: { ...me, rating: rating.get(me.id)! },
      other: { ...summary.other, rating: rating.get(summary.other.id)! },
      ratings: stream.puzzleIds.map((p) => ratingOf.get(p) ?? 0),
      myRun: runView(myRun),
      theirRun: showTheirs ? runView(theirRun) : null,
    };
  }

  async decline(userId: string, id: string) {
    const c = await this.challengeFor(userId, id);
    if (c.opponentId !== userId || this.statusOf(c) !== 'pending') throw new ConflictException('cannot decline');
    const now = new Date();
    const moved = await this.prisma.challenge.updateMany({
      where: { id, status: 'pending', expiresAt: { gt: now } },
      data: { status: 'declined', finishedAt: now },
    });
    if (moved.count === 0) throw new ConflictException('cannot decline');
    const row = await this.prisma.challenge.findUniqueOrThrow({ where: { id }, include: CHALLENGE_INCLUDE });
    return this.summaryOf(userId, row);
  }

  /**
   * Takes a challenge off my list (owner, 2026-11-04). Mine and not played
   * by the friend yet (draft / pending): withdrawn for both. Theirs and
   * pending: declined. Anything over (finished, declined, expired,
   * cancelled): hidden from my list only.
   */
  async remove(userId: string, id: string) {
    const c = await this.challengeFor(userId, id);
    const mine = c.challengerId === userId;
    const status = this.statusOf(c);
    const now = new Date();
    if (mine && (status === 'draft' || status === 'pending')) {
      const moved = await this.prisma.challenge.updateMany({
        where: { id, status: { in: ['draft', 'pending'] }, opponentRunId: null },
        data: { status: 'cancelled', finishedAt: now, challengerHiddenAt: now },
      });
      // The friend played meanwhile: it is finished, so just hide it.
      if (moved.count === 0) await this.prisma.challenge.update({ where: { id }, data: { challengerHiddenAt: now } });
    } else if (!mine && status === 'pending') {
      await this.prisma.challenge.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'declined', finishedAt: now, opponentHiddenAt: now },
      });
      await this.prisma.challenge.update({ where: { id }, data: { opponentHiddenAt: now } });
    } else {
      await this.prisma.challenge.update({ where: { id }, data: mine ? { challengerHiddenAt: now } : { opponentHiddenAt: now } });
    }
    return { ok: true as const };
  }

  private summaryOf(userId: string, c: ChallengeRow) {
    const meIsChallenger = c.challengerId === userId;
    const mine = meIsChallenger ? c.challengerRun : c.opponentRun;
    const theirs = meIsChallenger ? c.opponentRun : c.challengerRun;
    const status = this.statusOf(c);
    let verdict: 'win' | 'loss' | 'draw' | null = null;
    let byTime = false;
    if (status === 'finished' && mine && theirs) {
      if (mine.score !== theirs.score) verdict = mine.score > theirs.score ? 'win' : 'loss';
      else if (mine.score === 0 || mine.lastSolveMs === theirs.lastSolveMs) verdict = 'draw';
      else {
        verdict = mine.lastSolveMs < theirs.lastSolveMs ? 'win' : 'loss';
        byTime = true;
      }
    }
    const other: UserCard = meIsChallenger ? c.opponent : c.challenger;
    return {
      id: c.id,
      format: c.format as StormFormat,
      status,
      role: meIsChallenger ? ('challenger' as const) : ('opponent' as const),
      // Lists carry no rating (a query per row); the detail fills it in.
      other: { ...other, rating: 0 },
      note: c.note,
      myScore: mine?.score ?? null,
      // The challenger's score is the point of the invite; mine waits for my run.
      theirScore: theirs && (mine || !meIsChallenger) ? theirs.score : null,
      verdict,
      byTime,
      createdAt: (c.sentAt ?? c.createdAt).toISOString(),
      expiresAt: c.expiresAt?.toISOString() ?? null,
    };
  }
}

const CHALLENGE_INCLUDE = {
  challenger: { select: USER_CARD },
  opponent: { select: USER_CARD },
  challengerRun: true,
  opponentRun: true,
} as const;

type ChallengeRow = Prisma.ChallengeGetPayload<{ include: typeof CHALLENGE_INCLUDE }>;
