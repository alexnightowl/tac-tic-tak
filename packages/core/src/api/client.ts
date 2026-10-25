// Platform-agnostic port of apps/frontend/src/lib/api.ts. Core compiles
// against ES2022 only (no DOM lib), so fetch / AbortController / timers are
// typed structurally here and resolved from globalThis at call time.

export type AbortSignalLike = {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
};

type AbortControllerLike = { readonly signal: AbortSignalLike; abort(): void };

export type FetchInit = {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignalLike;
};

export type FetchResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
};

export type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponseLike>;

type Host = {
  fetch?: FetchLike;
  AbortController?: new () => AbortControllerLike;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};
const host = globalThis as unknown as Host;

export type ApiErrorKind = 'http' | 'timeout' | 'network' | 'aborted';

/**
 * Thrown for every failure. `message` matches what the web surfaced
 * (server `message`, arrays JSON-stringified, else statusText), so screens
 * can map it the same way; `status` is 0 for non-HTTP failures.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly body: unknown;
  constructor(message: string, status: number, kind: ApiErrorKind, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    this.body = body;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export type ApiClientOptions = {
  /** e.g. http://localhost:4000/api (no trailing slash needed). */
  baseUrl: string;
  /** May be async: the mobile token loads from secure-store at boot. */
  getToken: () => string | null | Promise<string | null>;
  /** A 401 for a request that carried the current token: the session is gone. */
  onUnauthorized?: () => void;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Extra headers on every request (X-Platform, X-App-Version…). */
  headers?: Record<string, string> | (() => Record<string, string>);
};

export type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignalLike;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type ApiClient = {
  request<T>(path: string, opts?: RequestOptions): Promise<T>;
  get<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  del<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
};

/** Insertion-ordered query string; undefined/null entries are skipped. */
export function buildQuery(q?: Query): string {
  if (!q) return '';
  const parts: string[] = [];
  for (const k of Object.keys(q)) {
    const v = q[k];
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Web rule: body.message (string, or an array stringified) else statusText. */
export function errorMessage(body: unknown, status: number, statusText: string): string {
  const msg = (body as { message?: unknown } | null)?.message;
  if (typeof msg === 'string') return msg;
  if (msg !== undefined && msg !== null) return JSON.stringify(msg);
  // RN fetch often leaves statusText empty; never throw a blank message.
  return statusText || `HTTP ${status}`;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const timeoutMs = opts.timeoutMs ?? 10_000;
  // The web's once-guard lived until the hard reload to /login. RN has no
  // reload, so the guard is keyed on the token: a burst of 401s for one
  // token fires once, and a fresh login re-arms it.
  let unauthorizedFor: string | null = null;

  async function request<T>(path: string, ro: RequestOptions = {}): Promise<T> {
    const doFetch = opts.fetchImpl ?? host.fetch;
    if (!doFetch) throw new ApiError('fetch unavailable', 0, 'network');
    const token = await opts.getToken();
    const extra = typeof opts.headers === 'function' ? opts.headers() : opts.headers;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extra ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(ro.headers ?? {}),
    };

    const Ctrl = host.AbortController;
    const ctrl = Ctrl ? new Ctrl() : null;
    let timedOut = false;
    const limit = ro.timeoutMs ?? timeoutMs;
    const timer = ctrl && limit > 0
      ? host.setTimeout(() => {
          timedOut = true;
          ctrl.abort();
        }, limit)
      : null;
    if (ro.signal?.aborted) {
      if (timer !== null) host.clearTimeout(timer);
      throw new ApiError('aborted', 0, 'aborted');
    }
    const onOuterAbort = () => ctrl?.abort();
    ro.signal?.addEventListener('abort', onOuterAbort);

    let res: FetchResponseLike;
    try {
      res = await doFetch(`${base}${path}${buildQuery(ro.query)}`, {
        method: ro.method ?? 'GET',
        headers,
        // Web: `body ? JSON.stringify(body) : undefined` (a falsy body is omitted).
        body: ro.body ? JSON.stringify(ro.body) : undefined,
        signal: ctrl?.signal ?? ro.signal,
      });
    } catch (e) {
      if (timedOut) throw new ApiError('timeout', 0, 'timeout');
      if (ro.signal?.aborted) throw new ApiError('aborted', 0, 'aborted');
      throw new ApiError(e instanceof Error && e.message ? e.message : 'network error', 0, 'network');
    } finally {
      if (timer !== null) host.clearTimeout(timer);
      ro.signal?.removeEventListener('abort', onOuterAbort);
    }

    if (!res.ok) {
      // A token was sent and rejected → the session is gone. Without a
      // token (login form) the 401 is the form's error, nothing else.
      // A late 401 for a token that has since been replaced is ignored.
      if (res.status === 401 && token && unauthorizedFor !== token) {
        const current = await opts.getToken();
        if (current === token && unauthorizedFor !== token) {
          unauthorizedFor = token;
          opts.onUnauthorized?.();
        }
      }
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // non-JSON error body → statusText
      }
      throw new ApiError(errorMessage(body, res.status, res.statusText), res.status, 'http', body);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    request,
    get: (path, o) => request(path, { ...o, method: 'GET' }),
    post: (path, body, o) => request(path, { ...o, method: 'POST', body }),
    patch: (path, body, o) => request(path, { ...o, method: 'PATCH', body }),
    del: (path, o) => request(path, { ...o, method: 'DELETE' }),
  };
}
