'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, KeyRound, Search, ShieldCheck } from 'lucide-react';
import { http, assetUrl } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AdminUserRow = {
  id: string;
  nickname: string;
  displayName: string | null;
  avatarUrl: string | null;
  country: string | null;
  createdAt: string;
  isAdmin: boolean;
  verified: boolean;
  sessionCount: number;
  attemptCount: number;
  lastSessionAt: string | null;
};

type UsersResponse = {
  total: number;
  limit: number;
  offset: number;
  users: AdminUserRow[];
};

type ActivityResponse = {
  days: number;
  totals: { totalUsers: number; sessionsToday: number; dau7: number; mau30: number };
  daily: { day: string; signups: number; sessions: number; activeUsers: number }[];
  recent: {
    id: string;
    nickname: string;
    displayName: string | null;
    avatarUrl: string | null;
    lastSessionAt: string;
    sessions7d: number;
  }[];
};

function relative(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA');
}

export default function AdminPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const settingsReady = useAppStore((s) => s.settingsReady);

  // The page itself is a hard gate — non-admins get bounced. Server
  // endpoints all 403 too, so this is purely a UX courtesy.
  useEffect(() => {
    if (settingsReady && user && !user.isAdmin) router.replace('/dashboard');
  }, [settingsReady, user, router]);

  // Hold first paint until we know whether the viewer is admin —
  // otherwise the page flashes for a frame before redirecting.
  if (!settingsReady || !user) return null;
  if (!user.isAdmin) return null;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-[color:var(--accent)]" />
        <h1 className="font-serif text-[32px] font-semibold tracking-tight text-[color:var(--text)]">
          Admin
        </h1>
        <span className="text-xs text-zinc-500">signed in as @{user?.nickname}</span>
      </header>

      <ActivitySection />
      <UsersSection currentUserId={user?.id} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-serif text-[28px] font-semibold tracking-tight text-[color:var(--text)] tabular-nums mt-1">
        {value}
      </div>
    </div>
  );
}

function ActivitySection() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'activity', 30],
    queryFn: () => http.get<ActivityResponse>('/admin/activity?days=30'),
  });

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Users total" value={data?.totals.totalUsers ?? '…'} />
        <StatBox label="Sessions today" value={data?.totals.sessionsToday ?? '…'} />
        <StatBox label="DAU (7d unique)" value={data?.totals.dau7 ?? '…'} />
        <StatBox label="MAU (30d unique)" value={data?.totals.mau30 ?? '…'} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif italic text-[14px] tracking-wide text-[color:var(--text-dim)]">
            Last 30 days
          </h2>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <Legend swatch="bg-[color:var(--accent)]" label="sessions" />
            <Legend swatch="bg-emerald-400" label="active users" />
            <Legend swatch="bg-sky-400" label="signups" />
          </div>
        </div>
        <ActivityChart daily={data?.daily ?? []} loading={isLoading} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4">
        <h2 className="font-serif italic text-[14px] tracking-wide text-[color:var(--text-dim)] mb-3">
          Recently active (top 20)
        </h2>
        {!data?.recent.length ? (
          <p className="text-sm text-zinc-500">No sessions in the last 30 days.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {data.recent.map((u) => (
              <Link
                key={u.id}
                href={`/profile/${u.nickname}`}
                className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
              >
                <Avatar url={u.avatarUrl} nickname={u.nickname} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-100 truncate">
                    {u.displayName || u.nickname}
                    <span className="text-zinc-500 ml-1.5 text-xs">@{u.nickname}</span>
                  </div>
                </div>
                <div className="text-xs text-zinc-400 tabular-nums">{u.sessions7d}/7d</div>
                <div className="text-xs text-zinc-500 tabular-nums w-[72px] text-right">
                  {relative(u.lastSessionAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block w-2.5 h-2.5 rounded-sm', swatch)} />
      {label}
    </span>
  );
}

function ActivityChart({
  daily,
  loading,
}: {
  daily: ActivityResponse['daily'];
  loading: boolean;
}) {
  const W = 920;
  const H = 220;
  const PAD = { l: 36, r: 8, t: 12, b: 22 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const max = useMemo(() => {
    if (!daily.length) return 1;
    return Math.max(1, ...daily.map((d) => Math.max(d.sessions, d.activeUsers, d.signups)));
  }, [daily]);

  const yTicks = useMemo(() => {
    const step = Math.max(1, Math.ceil(max / 4));
    const ticks: number[] = [];
    for (let v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    return ticks;
  }, [max]);

  if (loading || !daily.length) {
    return <div className="h-[220px] flex items-center justify-center text-sm text-zinc-500">
      {loading ? 'Loading…' : 'No activity in window.'}
    </div>;
  }

  const xAt = (i: number) => PAD.l + (daily.length === 1 ? innerW / 2 : (innerW * i) / (daily.length - 1));
  const yAt = (v: number) => PAD.t + innerH - (innerH * v) / max;

  const pathFor = (key: 'sessions' | 'activeUsers' | 'signups') =>
    daily.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d[key])}`).join(' ');

  // Sparse x-axis labels — every ~5 days.
  const xLabels = daily.map((d, i) => ({ d, i })).filter(({ i }) => i % 5 === 0 || i === daily.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px]">
      {/* Y grid + labels */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={yAt(t)}
            y2={yAt(t)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
          <text
            x={PAD.l - 6}
            y={yAt(t) + 3}
            textAnchor="end"
            className="fill-zinc-500 tabular-nums"
            style={{ fontSize: 10 }}
          >
            {t}
          </text>
        </g>
      ))}

      {/* Lines */}
      <path d={pathFor('sessions')} fill="none" stroke="var(--accent)" strokeWidth={2} />
      <path d={pathFor('activeUsers')} fill="none" stroke="#34d399" strokeWidth={2} />
      <path d={pathFor('signups')} fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="3 3" />

      {/* X labels */}
      {xLabels.map(({ d, i }) => (
        <text
          key={d.day}
          x={xAt(i)}
          y={H - 6}
          textAnchor="middle"
          className="fill-zinc-500 tabular-nums"
          style={{ fontSize: 10 }}
        >
          {d.day.slice(5)}
        </text>
      ))}
    </svg>
  );
}

function UsersSection({ currentUserId }: { currentUserId?: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', q, offset, limit],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set('q', q.trim());
      sp.set('limit', String(limit));
      sp.set('offset', String(offset));
      return http.get<UsersResponse>(`/admin/users?${sp.toString()}`);
    },
  });

  const onDelete = async (u: AdminUserRow) => {
    if (!confirm(`Delete @${u.nickname}? This wipes all their data (sessions, attempts, achievements). Cannot be undone.`)) return;
    try {
      await http.del(`/admin/users/${u.id}`);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'activity'] });
    } catch (e: any) {
      alert(`Delete failed: ${e?.message ?? 'unknown error'}`);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-[20px] font-semibold tracking-tight text-[color:var(--text)]">
          Users <span className="text-zinc-500 text-sm font-normal">({data?.total ?? '…'})</span>
        </h2>
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <Input
            placeholder="Search nickname or display name…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOffset(0); }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] overflow-hidden">
        <div className="grid grid-cols-[1.4fr_140px_120px_120px_140px_180px] gap-4 px-4 py-2.5 text-[11px] uppercase tracking-wider text-zinc-500 border-b border-[var(--border)]">
          <div>User</div>
          <div>Joined</div>
          <div className="text-right">Sessions</div>
          <div className="text-right">Attempts</div>
          <div>Last active</div>
          <div className="text-right">Actions</div>
        </div>

        {isLoading && (
          <div className="px-4 py-6 text-sm text-zinc-500">Loading…</div>
        )}

        {!isLoading && data?.users.length === 0 && (
          <div className="px-4 py-6 text-sm text-zinc-500">No users match.</div>
        )}

        {data?.users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === currentUserId}
            onDelete={() => onDelete(u)}
          />
        ))}
      </div>

      {data && data.total > limit && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <div>
            Showing {data.offset + 1}–{Math.min(data.offset + data.users.length, data.total)} of {data.total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= data.total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function UserRow({
  user: u,
  isSelf,
  onDelete,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  onDelete: () => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submitPassword = async () => {
    setErr(null);
    setOk(false);
    if (pw.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      await http.post(`/admin/users/${u.id}/password`, { password: pw });
      setOk(true);
      setPw('');
      // Keep the form open so the admin can copy the password they
      // just set if they need to relay it to the user.
    } catch (e: any) {
      setErr(e?.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-[1.4fr_140px_120px_120px_140px_180px] gap-4 px-4 py-3 text-sm border-b border-[var(--border)] last:border-0 hover:bg-white/[0.015]">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar url={u.avatarUrl} nickname={u.nickname} size={32} />
        <div className="min-w-0">
          <div className="text-zinc-100 truncate flex items-center gap-1.5">
            {u.displayName || u.nickname}
            {u.isAdmin && (
              <span title="Admin" className="text-[10px] uppercase tracking-wider text-[color:var(--accent)] border border-[color:var(--accent)] px-1 rounded">
                admin
              </span>
            )}
            {u.verified && <span title="Verified" className="text-emerald-400 text-xs">✓</span>}
          </div>
          <Link
            href={`/profile/${u.nickname}`}
            className="text-xs text-zinc-500 hover:text-zinc-300 truncate block"
          >
            @{u.nickname}
          </Link>
        </div>
      </div>

      <div className="text-zinc-400 tabular-nums self-center">{fmtDate(u.createdAt)}</div>
      <div className="text-zinc-300 tabular-nums self-center text-right">{u.sessionCount}</div>
      <div className="text-zinc-300 tabular-nums self-center text-right">{u.attemptCount}</div>
      <div className="text-zinc-400 self-center">{relative(u.lastSessionAt)}</div>

      <div className="self-center flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setResetting((v) => !v); setErr(null); setOk(false); }}
          title="Reset password"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Password
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onDelete}
          disabled={isSelf}
          title={isSelf ? "You can't delete yourself" : 'Delete user'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {resetting && (
        <div className="col-span-6 flex items-center gap-2 pt-2 pl-11">
          <Input
            type="text"
            placeholder="New password (min 8 chars)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-72 h-9"
            autoFocus
          />
          <Button size="sm" onClick={submitPassword} disabled={busy}>
            {busy ? 'Saving…' : 'Set password'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setResetting(false); setPw(''); setErr(null); setOk(false); }}>
            Cancel
          </Button>
          {err && <span className="text-xs text-red-400">{err}</span>}
          {ok && <span className="text-xs text-emerald-400">Password set.</span>}
        </div>
      )}
    </div>
  );
}

function Avatar({ url, nickname, size }: { url: string | null; nickname: string; size: number }) {
  const resolved = assetUrl(url);
  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={nickname}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = nickname.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-white/10 text-zinc-300 flex items-center justify-center shrink-0 text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}
