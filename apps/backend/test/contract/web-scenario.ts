/**
 * The web contract: every request shape apps/frontend/src sends, in the
 * order a real user produces them, replayed through a pluggable
 * transport. Used by
 *   - test/e2e/web-contract.e2e-spec.ts (supertest, in-process, golden snapshot)
 *   - tools/contract/legacy-smoke.ts     (fetch against two running servers, diff)
 *
 * Each step records method, route template, status code and the
 * response SHAPE (keys + value kinds, see helpers/shape.ts), plus the
 * error `message` for 4xx/5xx because the web renders it verbatim.
 * Volatile values (ids, timestamps, ratings of random picks) are never
 * recorded.
 *
 * Request bodies mirror the frontend call sites exactly (file refs in
 * the step labels). Keep this file free of Nest/Prisma imports so the
 * legacy smoke can run it with plain fetch.
 */
import { shapeOf, Shape } from '../helpers/shape';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type ContractRequest = { method: Method; path: string; token?: string | null; body?: unknown };
export type ContractResponse = { status: number; body: unknown };
export type ContractTransport = (req: ContractRequest) => Promise<ContractResponse>;

/**
 * Optional side doors for things the web can only do by waiting (a
 * full-duration session) or that need DB access (admin flag). Without a
 * hook the dependent steps are recorded as `skipped`.
 */
export type ScenarioHooks = {
  /** Shift a live session's startedAt back so finish counts as full duration. */
  backdateSession?: (sessionId: string, seconds: number) => Promise<void>;
  /**
   * Make /next serve a deterministic puzzle order for this session:
   * `mixed` = ~1200-rated puzzles, `fork` = fork-tagged ~1200 puzzles.
   */
  primeQueue?: (sessionId: string, kind: 'mixed' | 'fork') => Promise<void>;
  /** Flip User.isAdmin (no API for it by design). */
  makeAdmin?: (userId: string) => Promise<void>;
};

export type StepRecord = {
  step: string;
  method: Method;
  route: string;
  status: number | 'skipped';
  shape?: Shape;
  message?: unknown;
};

export type ScenarioResult = {
  steps: StepRecord[];
  /** Ids created along the way, for cleanup and extra assertions. */
  ctx: {
    userA?: { id: string; nickname: string; token: string };
    userB?: { id: string; nickname: string; token: string };
    loginToken?: string;
  };
};

/** Same algorithm as apps/frontend formatLocalDate: the user's local YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 1x1 transparent PNG — what a cropped avatar upload looks like on the wire.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export async function runWebScenario(
  send: ContractTransport,
  hooks: ScenarioHooks = {},
  opts: { suffix?: string; password?: string } = {},
): Promise<ScenarioResult> {
  const steps: StepRecord[] = [];
  const ctx: ScenarioResult['ctx'] = {};
  const suffix = opts.suffix ?? '';
  const pw = opts.password ?? 'Passw0rd1';
  const pw2 = 'Passw0rd2';
  const nickA = `webA${suffix}`.slice(0, 20);
  const nickB = `webB${suffix}`.slice(0, 20);

  async function call(
    step: string,
    method: Method,
    route: string,
    path: string,
    token?: string | null,
    body?: unknown,
  ): Promise<ContractResponse> {
    const res = await send({ method, path, token, body });
    const rec: StepRecord = { step, method, route, status: res.status, shape: shapeOf(res.body) };
    if (res.status >= 400 && res.body && typeof res.body === 'object') {
      rec.message = (res.body as { message?: unknown }).message;
    }
    steps.push(rec);
    return res;
  }
  const skip = (step: string, method: Method, route: string) =>
    steps.push({ step, method, route, status: 'skipped' });
  const obj = (r: ContractResponse) => (r.body ?? {}) as Record<string, any>;

  // ---- auth (app/register/page.tsx, app/login/page.tsx) -------------------
  const reg = await call('register', 'POST', '/auth/register', '/auth/register', null, {
    nickname: nickA, password: pw, repeatPassword: pw, language: 'en',
  });
  const tokenA0 = obj(reg).token as string;
  await call('register: invalid nickname + weak password', 'POST', '/auth/register', '/auth/register', null, {
    nickname: 'a', password: 'short', repeatPassword: 'short', language: 'en',
  });
  await call('register: passwords differ', 'POST', '/auth/register', '/auth/register', null, {
    nickname: `${nickA}x`.slice(0, 20), password: pw, repeatPassword: `${pw}x`, language: 'uk',
  });
  await call('register: nickname taken', 'POST', '/auth/register', '/auth/register', null, {
    nickname: nickA, password: pw, repeatPassword: pw, language: 'en',
  });
  const login = await call('login', 'POST', '/auth/login', '/auth/login', null, { nickname: nickA, password: pw });
  let tA = (obj(login).token as string) ?? tokenA0;
  ctx.loginToken = tA;
  await call('login: wrong password', 'POST', '/auth/login', '/auth/login', null, { nickname: nickA, password: 'nope12345' });
  await call('login: unknown user', 'POST', '/auth/login', '/auth/login', null, { nickname: `zz${nickA}`.slice(0, 20), password: pw });
  await call('auth/me', 'GET', '/auth/me', '/auth/me', tA);
  await call('auth/me: no token', 'GET', '/auth/me', '/auth/me', null);
  await call('auth/me: garbage token', 'GET', '/auth/me', '/auth/me', 'not.a.jwt');

  // ---- profile + settings (lib/providers.tsx, settings/page.tsx, Onboarding, ProfileEditor)
  const me = await call('users/me', 'GET', '/users/me', '/users/me', tA);
  const idA = obj(me).id as string;
  ctx.userA = { id: idA, nickname: nickA, token: tA };
  await call('users/me: no token', 'GET', '/users/me', '/users/me', null);
  await call('settings: onboarding done', 'PATCH', '/users/me/settings', '/users/me/settings', tA, { onboardingCompleted: true });
  await call('settings: multi-field save', 'PATCH', '/users/me/settings', '/users/me/settings', tA, {
    pieceSet: 'cburnett', boardTheme: 'green', soundEnabled: false, language: 'uk', fixedColor: 'white',
    animationSpeed: 'fast', knightArrow: 'straight', showStreak: false, mirrorView: true, focusMode: true,
    reviewAutoAdvance: true, accentColor: '#22c55e', soundPack: 'wood',
  });
  await call('settings: invalid enum', 'PATCH', '/users/me/settings', '/users/me/settings', tA, { fixedColor: 'purple' });
  await call('profile: save', 'PATCH', '/users/me/profile', '/users/me/profile', tA, {
    displayName: 'Web A', bio: 'contract test', country: 'UA',
  });
  await call('profile: clear fields', 'PATCH', '/users/me/profile', '/users/me/profile', tA, { displayName: '', country: '' });
  await call('profile: bad country', 'PATCH', '/users/me/profile', '/users/me/profile', tA, { country: 'Ukraine' });
  await call('avatar: upload png', 'POST', '/users/me/avatar', '/users/me/avatar', tA, { dataUrl: TINY_PNG });
  await call('avatar: bad format', 'POST', '/users/me/avatar', '/users/me/avatar', tA, { dataUrl: 'data:image/gif;base64,R0lG' });

  // change-password (settings/page.tsx). 401 on a wrong current password is today's (buggy) behaviour; B5 changes it deliberately.
  await call('change-password: wrong current', 'POST', '/auth/change-password', '/auth/change-password', tA, {
    currentPassword: 'wrong-pass1', newPassword: pw2,
  });
  await call('change-password: same as current', 'POST', '/auth/change-password', '/auth/change-password', tA, {
    currentPassword: pw, newPassword: pw,
  });
  await call('change-password: weak new', 'POST', '/auth/change-password', '/auth/change-password', tA, {
    currentPassword: pw, newPassword: 'short',
  });
  await call('change-password: ok', 'POST', '/auth/change-password', '/auth/change-password', tA, {
    currentPassword: pw, newPassword: pw2,
  });
  await call('login: old password after change', 'POST', '/auth/login', '/auth/login', null, { nickname: nickA, password: pw });
  const relogin = await call('login: new password', 'POST', '/auth/login', '/auth/login', null, { nickname: nickA, password: pw2 });
  tA = (obj(relogin).token as string) ?? tA;
  ctx.userA.token = tA;

  // ---- play setup (play/page.tsx, ThemePicker) ----------------------------
  await call('analytics/themes (theme picker)', 'GET', '/analytics/themes', '/analytics/themes', tA);
  await call('sessions: over unlock cap? (calibrating ignores)', 'POST', '/sessions', '/sessions', tA, {
    startRating: 3000, durationSec: 60, mode: 'mixed', style: 'rapid',
  }).then(async (r) => {
    // Calibration overrides startRating, so this succeeds; discard it so it leaves no trace.
    const sid = obj(r).sessionId as string | undefined;
    if (sid) await call('finish: discard (save=false)', 'POST', '/sessions/:id/finish', `/sessions/${sid}/finish?save=false&localDate=${localDate()}`, tA);
  });
  await call('sessions: invalid body', 'POST', '/sessions', '/sessions', tA, {
    startRating: 100, durationSec: 5, mode: 'blitz', style: 'classical',
  });

  // Session 1: rated blitz, full duration (unlock/demote/calibration payload).
  const s1 = await call('sessions: create mixed', 'POST', '/sessions', '/sessions', tA, {
    startRating: 1200, durationSec: 60, mode: 'mixed', style: 'blitz',
  });
  const sid1 = obj(s1).sessionId as string;
  if (hooks.primeQueue) await hooks.primeQueue(sid1, 'mixed');
  // play/[id]/page.tsx: http.post(`/sessions/${id}/next`) with no body.
  const n1 = await call('next', 'POST', '/sessions/:id/next', `/sessions/${sid1}/next`, tA);
  const p1 = obj(n1).puzzle?.id as string;
  await call('attempt: correct', 'POST', '/sessions/:id/attempt', `/sessions/${sid1}/attempt`, tA, {
    puzzleId: p1, correct: true, responseMs: 3500,
  });
  const n2 = await call('next (2)', 'POST', '/sessions/:id/next', `/sessions/${sid1}/next`, tA);
  const p2 = obj(n2).puzzle?.id as string;
  await call('attempt: wrong', 'POST', '/sessions/:id/attempt', `/sessions/${sid1}/attempt`, tA, {
    puzzleId: p2, correct: false, responseMs: 9000,
  });
  await call('attempt: invalid body', 'POST', '/sessions/:id/attempt', `/sessions/${sid1}/attempt`, tA, {
    puzzleId: p2, correct: 'yes', responseMs: -1,
  });
  await call('attempt: unknown puzzle', 'POST', '/sessions/:id/attempt', `/sessions/${sid1}/attempt`, tA, {
    puzzleId: 'zzzzz', correct: true, responseMs: 1000,
  });
  await call('next: unknown session', 'POST', '/sessions/:id/next', '/sessions/does-not-exist/next', tA);
  if (hooks.backdateSession) {
    await hooks.backdateSession(sid1, 75);
    await call('finish: full duration (save)', 'POST', '/sessions/:id/finish', `/sessions/${sid1}/finish?localDate=${localDate()}`, tA);
  } else {
    skip('finish: full duration (save)', 'POST', '/sessions/:id/finish');
  }
  await call('finish: already finished', 'POST', '/sessions/:id/finish', `/sessions/${sid1}/finish?localDate=${localDate()}`, tA);
  await call('next: session ended', 'POST', '/sessions/:id/next', `/sessions/${sid1}/next`, tA);
  await call('attempt: session ended', 'POST', '/sessions/:id/attempt', `/sessions/${sid1}/attempt`, tA, {
    puzzleId: p1, correct: true, responseMs: 1000,
  });

  // Session 2: early exit (Save from the exit dialog mid-session).
  const s2 = await call('sessions: create (early exit)', 'POST', '/sessions', '/sessions', tA, {
    startRating: 1200, durationSec: 300, mode: 'mixed', style: 'blitz',
  });
  const sid2 = obj(s2).sessionId as string;
  if (hooks.primeQueue) await hooks.primeQueue(sid2, 'mixed');
  const n3 = await call('next (s2)', 'POST', '/sessions/:id/next', `/sessions/${sid2}/next`, tA);
  await call('attempt (s2)', 'POST', '/sessions/:id/attempt', `/sessions/${sid2}/attempt`, tA, {
    puzzleId: obj(n3).puzzle?.id, correct: true, responseMs: 2500,
  });
  await call('finish: early exit (save)', 'POST', '/sessions/:id/finish', `/sessions/${sid2}/finish?localDate=${localDate()}`, tA);

  // Session 3: theme mode (unrated), finish with a malformed localDate (streak untouched → null).
  const s3 = await call('sessions: create theme', 'POST', '/sessions', '/sessions', tA, {
    startRating: 1200, durationSec: 60, mode: 'theme', style: 'bullet', theme: 'fork',
  });
  const sid3 = obj(s3).sessionId as string;
  if (hooks.primeQueue) await hooks.primeQueue(sid3, 'fork');
  const n4 = await call('next (theme)', 'POST', '/sessions/:id/next', `/sessions/${sid3}/next`, tA);
  await call('attempt (theme)', 'POST', '/sessions/:id/attempt', `/sessions/${sid3}/attempt`, tA, {
    puzzleId: obj(n4).puzzle?.id, correct: false, responseMs: 4000,
  });
  await call('finish: theme, bad localDate', 'POST', '/sessions/:id/finish', `/sessions/${sid3}/finish?localDate=2026-02-31`, tA);

  // Session 4: discard with attempts (exit dialog → Discard).
  const s4 = await call('sessions: create (discard)', 'POST', '/sessions', '/sessions', tA, {
    startRating: 1200, durationSec: 60, mode: 'mixed', style: 'blitz',
  });
  const sid4 = obj(s4).sessionId as string;
  const fp4 = obj(s4).firstPuzzle?.puzzle?.id as string | undefined;
  if (fp4) {
    await call('attempt (s4, first puzzle)', 'POST', '/sessions/:id/attempt', `/sessions/${sid4}/attempt`, tA, {
      puzzleId: fp4, correct: false, responseMs: 5000,
    });
  }
  await call('finish: discard with attempts', 'POST', '/sessions/:id/finish', `/sessions/${sid4}/finish?save=false&localDate=${localDate()}`, tA);
  await call('session detail: discarded', 'GET', '/sessions/:id', `/sessions/${sid4}`, tA);

  // ---- session detail + review (sessions/[id], review pages) -------------
  await call('session detail', 'GET', '/sessions/:id', `/sessions/${sid1}`, tA);
  await call('session review-items', 'GET', '/sessions/:id/review-items', `/sessions/${sid1}/review-items`, tA);
  await call('session review-items (early)', 'GET', '/sessions/:id/review-items', `/sessions/${sid2}/review-items`, tA);
  await call('puzzle viewer: attempted', 'GET', '/puzzles/:puzzleId', `/puzzles/${p1}`, tA);
  await call('puzzle viewer: never attempted', 'GET', '/puzzles/:puzzleId', '/puzzles/zzzzz', tA);
  await call('review themes', 'GET', '/review/themes', '/review/themes', tA);
  await call('review list', 'GET', '/review', '/review', tA);
  await call('review list by theme', 'GET', '/review?theme=', '/review?theme=fork', tA);
  await call('review puzzle', 'GET', '/review/:puzzleId', `/review/${p2}`, tA);
  await call('review puzzle: not queued', 'GET', '/review/:puzzleId', `/review/${p1}`, tA);
  await call('review resolve', 'POST', '/review/:puzzleId/resolve', `/review/${p2}/resolve`, tA);
  await call('review list after resolve', 'GET', '/review', '/review', tA);

  // ---- analytics (dashboard, analytics/page.tsx) --------------------------
  await call('analytics overview', 'GET', '/analytics', '/analytics', tA);
  await call('analytics overview ?style', 'GET', '/analytics?style=', '/analytics?style=blitz', tA);
  await call('analytics themes ?style', 'GET', '/analytics/themes?style=', '/analytics/themes?style=blitz', tA);
  await call('analytics recommendations ?style', 'GET', '/analytics/recommendations?style=', '/analytics/recommendations?style=blitz', tA);
  await call('analytics recommendations', 'GET', '/analytics/recommendations', '/analytics/recommendations', tA);
  await call('analytics timeline', 'GET', '/analytics/timeline?days=', '/analytics/timeline?days=365', tA);

  // ---- social (friends, UserSearch, FriendActionButton, profile, leaderboard)
  const regB = await call('register B', 'POST', '/auth/register', '/auth/register', null, {
    nickname: nickB, password: pw, repeatPassword: pw, language: 'uk',
  });
  const tB = obj(regB).token as string;
  const idB = obj(regB).user?.id as string;
  ctx.userB = { id: idB, nickname: nickB, token: tB };
  await call('leaderboard global', 'GET', '/leaderboard', '/leaderboard?style=blitz&scope=global&limit=100', tA);
  await call('leaderboard friends (none)', 'GET', '/leaderboard', '/leaderboard?style=blitz&scope=friends&limit=100', tA);
  await call('user search', 'GET', '/users/search?q=', `/users/search?q=${encodeURIComponent(nickB.slice(0, 4))}`, tA);
  await call('user search: empty', 'GET', '/users/search?q=', '/users/search?q=', tA);
  await call('friendship state: none', 'GET', '/users/by-nickname/:nickname/friendship', `/users/by-nickname/${nickB}/friendship`, tA);
  await call('friend request', 'POST', '/friends/request', '/friends/request', tA, { nickname: nickB });
  await call('friend request: duplicate', 'POST', '/friends/request', '/friends/request', tA, { nickname: nickB });
  await call('friend request: self', 'POST', '/friends/request', '/friends/request', tA, { nickname: nickA });
  await call('friend request: unknown', 'POST', '/friends/request', '/friends/request', tA, { nickname: 'nobody_here' });
  await call('friend request: invalid nickname', 'POST', '/friends/request', '/friends/request', tA, { nickname: 'x' });
  await call('friendship state: outgoing', 'GET', '/users/by-nickname/:nickname/friendship', `/users/by-nickname/${nickB}/friendship`, tA);
  const pending = await call('friends pending (B)', 'GET', '/friends/pending', '/friends/pending', tB);
  const incoming = (obj(pending).incoming ?? []) as Array<{ id?: string; friendshipId?: string }>;
  const reqId = incoming[0]?.id ?? incoming[0]?.friendshipId;
  // friends/page.tsx sends {}; FriendActionButton sends no body. Record both.
  await call('friend accept (B, body {})', 'POST', '/friends/:id/accept', `/friends/${reqId}/accept`, tB, {});
  await call('friend accept again (no body)', 'POST', '/friends/:id/accept', `/friends/${reqId}/accept`, tB);
  await call('friends list (A)', 'GET', '/friends', '/friends', tA);
  await call('friends list (B)', 'GET', '/friends', '/friends', tB);
  await call('leaderboard friends', 'GET', '/leaderboard', '/leaderboard?style=blitz&scope=friends&limit=100', tA);
  await call('leaderboard rapid global', 'GET', '/leaderboard', '/leaderboard?style=rapid&scope=global&limit=100', tB);
  await call('friendship state: friends', 'GET', '/users/by-nickname/:nickname/friendship', `/users/by-nickname/${nickA}/friendship`, tB);
  await call('unfriend by user', 'DELETE', '/friends/by-user/:otherId', `/friends/by-user/${idB}`, tA);
  const again = await call('friend request (again)', 'POST', '/friends/request', '/friends/request', tA, { nickname: nickB });
  const againId = (obj(again).id ?? obj(again).friendshipId) as string | undefined;
  await call('friend reject (B)', 'DELETE', '/friends/:id', `/friends/${againId}`, tB);
  await call('friend reject: unknown id', 'DELETE', '/friends/:id', '/friends/does-not-exist', tB);

  await call('public profile', 'GET', '/users/by-nickname/:nickname', `/users/by-nickname/${nickA}`, tB);
  await call('public profile: anonymous', 'GET', '/users/by-nickname/:nickname', `/users/by-nickname/${nickA}`, null);
  await call('public profile: unknown', 'GET', '/users/by-nickname/:nickname', '/users/by-nickname/nobody_here', tB);
  await call('public themes', 'GET', '/users/by-nickname/:nickname/themes', `/users/by-nickname/${nickA}/themes`, tB);
  await call('public timeline', 'GET', '/users/by-nickname/:nickname/timeline', `/users/by-nickname/${nickA}/timeline`, tB);

  // ---- achievements (AchievementsGrid) -----------------------------------
  await call('achievements', 'GET', '/achievements', '/achievements', tA);
  await call('achievements evaluate', 'POST', '/achievements/evaluate', '/achievements/evaluate', tA, {});
  await call('achievements star-confirm', 'POST', '/achievements/star-confirm', '/achievements/star-confirm', tA, {});
  await call('achievements star-confirm again', 'POST', '/achievements/star-confirm', '/achievements/star-confirm', tA, {});

  // ---- dashboard swipe-delete, reset progress (dashboard, settings) ------
  await call('session delete', 'DELETE', '/sessions/:id', `/sessions/${sid2}`, tA);
  await call('session delete: gone', 'DELETE', '/sessions/:id', `/sessions/${sid2}`, tA);
  await call('session detail: other user', 'GET', '/sessions/:id', `/sessions/${sid1}`, tB);
  await call('reset progress', 'POST', '/users/me/reset-progress', '/users/me/reset-progress', tA);
  await call('users/me after reset', 'GET', '/users/me', '/users/me', tA);

  // ---- admin (admin/page.tsx) --------------------------------------------
  await call('admin: non-admin', 'GET', '/admin/activity?days=', '/admin/activity?days=30', tB);
  if (hooks.makeAdmin) {
    await hooks.makeAdmin(idA);
    await call('admin activity', 'GET', '/admin/activity?days=', '/admin/activity?days=30', tA);
    await call('admin users', 'GET', '/admin/users', `/admin/users?q=${encodeURIComponent(nickB.slice(0, 4))}&limit=50&offset=0`, tA);
    await call('admin set password', 'POST', '/admin/users/:id/password', `/admin/users/${idB}/password`, tA, { password: 'Adm1nSet99' });
    await call('admin delete self', 'DELETE', '/admin/users/:id', `/admin/users/${idA}`, tA);
    await call('admin delete user', 'DELETE', '/admin/users/:id', `/admin/users/${idB}`, tA);
    await call('deleted user token', 'GET', '/users/me', '/users/me', tB);
  } else {
    for (const s of ['admin activity', 'admin users', 'admin set password', 'admin delete self', 'admin delete user', 'deleted user token']) {
      skip(s, 'GET', '/admin/*');
    }
  }

  return { steps, ctx };
}
