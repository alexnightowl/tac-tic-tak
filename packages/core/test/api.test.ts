import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  buildQuery,
  createApiClient,
  createEndpoints,
  errorMessage,
  isDiscarded,
  queryKeys,
  type FetchInit,
  type FetchLike,
  type FetchResponseLike,
  type AbortSignalLike,
} from '../src/api';

type Call = { url: string; init: FetchInit };

function res(status: number, body?: unknown, statusText = ''): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  };
}

function fakeFetch(...responses: Array<FetchResponseLike | ((c: Call) => Promise<FetchResponseLike>)>) {
  const calls: Call[] = [];
  let i = 0;
  const impl: FetchLike = async (url, init) => {
    const c = { url, init };
    calls.push(c);
    const r = responses[Math.min(i++, responses.length - 1)];
    return typeof r === 'function' ? r(c) : r;
  };
  return { impl, calls };
}

/** Awaits a rejection typed as ApiError. */
async function fail(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected a rejection');
}

function hang(): FetchLike {
  return (_url, init) =>
    new Promise((_resolve, reject) => {
      if (init.signal?.aborted) reject(new Error('Aborted'));
      init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    });
}

const Ctrl = (globalThis as unknown as { AbortController: new () => { signal: AbortSignalLike; abort(): void } })
  .AbortController;

function client(f: FetchLike, token: string | null = null, extra: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  return createApiClient({ baseUrl: 'http://api.test/api/', getToken: () => token, fetchImpl: f, ...extra });
}

describe('createApiClient: request shape', () => {
  it('joins the base url, sends JSON headers, bearer and extra headers', async () => {
    const { impl, calls } = fakeFetch(res(200, { ok: true }));
    const c = client(impl, 'tok', { headers: () => ({ 'X-Platform': 'ios', 'X-App-Version': '0.1.0' }) });
    await expect(c.post('/auth/login', { a: 1 })).resolves.toEqual({ ok: true });
    expect(calls[0].url).toBe('http://api.test/api/auth/login');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBe('{"a":1}');
    expect(calls[0].init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok',
      'X-Platform': 'ios',
      'X-App-Version': '0.1.0',
    });
  });

  it('omits Authorization without a token and the body when none is given', async () => {
    const { impl, calls } = fakeFetch(res(200, {}));
    await client(impl).post('/sessions/x/next');
    expect(calls[0].init.headers.Authorization).toBeUndefined();
    expect(calls[0].init.body).toBeUndefined();
  });

  it('awaits an async token source', async () => {
    const { impl, calls } = fakeFetch(res(200, {}));
    const c = createApiClient({ baseUrl: 'http://a', getToken: async () => 'later', fetchImpl: impl });
    await c.get('/users/me');
    expect(calls[0].init.headers.Authorization).toBe('Bearer later');
  });

  it('returns undefined for 204', async () => {
    const { impl } = fakeFetch(res(204));
    await expect(client(impl).del('/x')).resolves.toBeUndefined();
  });
});

describe('createApiClient: errors', () => {
  it('uses body.message when it is a string', async () => {
    const { impl } = fakeFetch(res(401, { statusCode: 401, message: 'invalid credentials' }, 'Unauthorized'));
    const err = await fail(client(impl).post('/auth/login', {}));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('invalid credentials');
    expect(err.status).toBe(401);
    expect(err.kind).toBe('http');
  });

  it('stringifies an array message (ValidationPipe) like the web', async () => {
    const { impl } = fakeFetch(res(400, { message: ['a', 'b'], error: 'Bad Request' }));
    await expect(client(impl).post('/auth/register', {})).rejects.toThrow('["a","b"]');
  });

  it('falls back to statusText, then HTTP <status>, on a non-JSON body', async () => {
    expect(errorMessage(null, 502, 'Bad Gateway')).toBe('Bad Gateway');
    expect(errorMessage(null, 502, '')).toBe('HTTP 502');
    const { impl } = fakeFetch(res(500, undefined, 'Internal Server Error'));
    await expect(client(impl).get('/x')).rejects.toThrow('Internal Server Error');
  });

  it('wraps a network failure', async () => {
    const impl: FetchLike = async () => {
      throw new TypeError('Network request failed');
    };
    const err = await fail(client(impl).get('/x'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('network');
    expect(err.status).toBe(0);
  });

  it('aborts after timeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const p = fail(client(hang(), null, { timeoutMs: 50 }).get('/slow'));
      await vi.advanceTimersByTimeAsync(60);
      const err = await p;
      expect(err.kind).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('honours a caller signal', async () => {
    const ctrl = new Ctrl();
    const p = fail(client(hang()).get('/x', { signal: ctrl.signal }));
    await Promise.resolve();
    ctrl.abort();
    expect((await p).kind).toBe('aborted');
    // Already aborted before the call: never reaches fetch.
    const pre = new Ctrl();
    pre.abort();
    expect((await fail(client(hang()).get('/x', { signal: pre.signal }))).kind).toBe('aborted');
  });
});

describe('createApiClient: 401 handling', () => {
  it('a 401 without a token is only a form error', async () => {
    const onUnauthorized = vi.fn();
    const { impl } = fakeFetch(res(401, { message: 'invalid credentials' }));
    await expect(client(impl, null, { onUnauthorized }).post('/auth/login', {})).rejects.toThrow('invalid credentials');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('a burst of 401s with a token fires onUnauthorized once', async () => {
    const onUnauthorized = vi.fn();
    const { impl } = fakeFetch(res(401, { message: 'Unauthorized' }));
    const c = client(impl, 'stale', { onUnauthorized });
    await Promise.allSettled([c.get('/a'), c.get('/b'), c.get('/c')]);
    await c.get('/d').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('re-arms for a new token', async () => {
    const onUnauthorized = vi.fn();
    let token = 'one';
    const { impl } = fakeFetch(res(401, {}));
    const c = createApiClient({ baseUrl: 'http://a', getToken: () => token, fetchImpl: impl, onUnauthorized });
    await c.get('/x').catch(() => {});
    token = 'two';
    await c.get('/x').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('ignores a late 401 for a token that was replaced mid-flight', async () => {
    const onUnauthorized = vi.fn();
    let token: string | null = 'old';
    const { impl } = fakeFetch(async () => {
      token = 'new'; // logged in again while the request was in flight
      return res(401, {});
    });
    const c = createApiClient({ baseUrl: 'http://a', getToken: () => token, fetchImpl: impl, onUnauthorized });
    await c.get('/x').catch(() => {});
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('endpoints', () => {
  it('finish encodes save=false only on discard, localDate always (web order)', async () => {
    const { impl, calls } = fakeFetch(res(200, { discarded: true }), res(200, { sessionId: 's', solved: 1 }));
    const api = createEndpoints(client(impl, 't'));
    const r1 = await api.sessions.finish('s1', { save: false, localDate: '2026-10-25' });
    expect(calls[0].url).toBe('http://api.test/api/sessions/s1/finish?save=false&localDate=2026-10-25');
    expect(calls[0].init.method).toBe('POST');
    expect(isDiscarded(r1)).toBe(true);
    const r2 = await api.sessions.finish('s1', { localDate: '2026-10-25' });
    expect(calls[1].url).toBe('http://api.test/api/sessions/s1/finish?localDate=2026-10-25');
    expect(isDiscarded(r2)).toBe(false);
  });

  it('routes and methods', async () => {
    const { impl, calls } = fakeFetch(res(200, {}));
    const api = createEndpoints(client(impl, 't'));
    await api.auth.login({ nickname: 'n', password: 'p' });
    await api.auth.register({ nickname: 'n', password: 'p', repeatPassword: 'p', language: 'uk' });
    await api.users.me();
    await api.sessions.create({ startRating: 1200, durationSec: 60, mode: 'mixed', style: 'blitz' });
    await api.sessions.next('a/b');
    await api.sessions.attempt('s', { puzzleId: 'p', correct: true, responseMs: 900 });
    await api.sessions.detail('s');
    expect(calls.map((c) => `${c.init.method} ${c.url.replace('http://api.test/api', '')}`)).toEqual([
      'POST /auth/login',
      'POST /auth/register',
      'GET /users/me',
      'POST /sessions',
      'POST /sessions/a%2Fb/next',
      'POST /sessions/s/attempt',
      'GET /sessions/s',
    ]);
    expect(JSON.parse(calls[5].init.body!)).toEqual({ puzzleId: 'p', correct: true, responseMs: 900 });
  });
});

describe('helpers', () => {
  it('buildQuery skips nullish and encodes', () => {
    expect(buildQuery()).toBe('');
    expect(buildQuery({ a: undefined, b: null })).toBe('');
    expect(buildQuery({ q: 'a b', n: 2, f: false })).toBe('?q=a%20b&n=2&f=false');
  });

  it('query keys mirror the web literals', () => {
    expect(queryKeys.me()).toEqual(['me']);
    expect(queryKeys.overview()).toEqual(['overview']);
    expect(queryKeys.analytics('blitz')).toEqual(['analytics', 'blitz']);
    expect(queryKeys.session('id1')).toEqual(['session', 'id1']);
    expect(queryKeys.reviewList('__all__')).toEqual(['review-list', '__all__']);
    expect(queryKeys.leaderboard('rapid', 'global')).toEqual(['leaderboard', 'rapid', 'global']);
  });
});
