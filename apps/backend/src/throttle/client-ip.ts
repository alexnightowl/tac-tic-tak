import { isIP } from 'net';

type ReqLike = {
  ip?: string;
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
  app?: { get?: (setting: string) => unknown };
};

/**
 * The client IP used as a throttling key, or null when it is unknown.
 *
 * Behind nginx the socket address is the proxy's, so every visitor would
 * share one bucket. Express only resolves the real address from
 * X-Forwarded-For when `trust proxy` is set (B2 sets `trust proxy 1`).
 * Until then a request that arrived through a proxy (X-Forwarded-For is
 * present) has no trustworthy IP: per-IP limits are skipped for it
 * instead of throttling the whole site as one client. Per-user and
 * per-nickname limits still apply.
 *
 * IPv4-mapped IPv6 is unwrapped; IPv6 is keyed by its /64 prefix, the
 * smallest block a single subscriber normally gets.
 */
export function clientIp(req: ReqLike): string | null {
  const trustProxy = req.app?.get?.('trust proxy');
  if (!trustProxy && req.headers?.['x-forwarded-for'] !== undefined) return null;
  const raw = req.ip || req.socket?.remoteAddress;
  return raw ? normalizeIp(raw) : null;
}

export function normalizeIp(ip: string): string {
  const addr = ip.trim().replace(/^\[|\]$/g, '').split('%')[0];
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(addr);
  if (mapped) return mapped[1];
  if (isIP(addr) !== 6) return addr;
  const [head, tail] = addr.includes('::') ? addr.split('::') : [addr, undefined];
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}
