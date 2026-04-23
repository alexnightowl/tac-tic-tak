'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, Check, Clock, Loader2 } from 'lucide-react';
import { http } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/utils';

type FriendshipState = 'none' | 'self' | 'outgoing' | 'incoming' | 'friends';

type SearchResult = {
  id: string;
  nickname: string;
  displayName: string | null;
  avatarUrl: string | null;
  country: string | null;
  friendship: { state: FriendshipState; friendshipId: string | null };
};

type Props = {
  placeholder?: string;
  onAction?: () => void;
};

export function UserSearch({ placeholder, onAction }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const rows = await http.get<SearchResult[]>(`/users/search?q=${encodeURIComponent(q.trim())}`);
        setResults(rows);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q]);

  const addFriend = async (row: SearchResult) => {
    try {
      await http.post('/friends/request', { nickname: row.nickname });
      setResults((prev) => prev?.map((r) => r.id === row.id
        ? { ...r, friendship: { state: 'outgoing', friendshipId: null } }
        : r) ?? prev);
      onAction?.();
    } catch {}
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder ?? 'Search by nickname'}
          className="w-full h-11 pl-9 pr-3 rounded-xl bg-black/30 border border-[var(--border)] text-sm"
          autoFocus
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
        )}
      </div>

      {q.trim().length >= 2 && results && results.length === 0 && !loading && (
        <div className="text-xs text-zinc-500 px-1 pt-1">No matches.</div>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((r) => (
            <li key={r.id}>
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                <Link href={`/profile/${r.nickname}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar nickname={r.nickname} avatarUrl={r.avatarUrl} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {r.displayName || r.nickname}
                      {r.displayName && <span className="text-zinc-500 ml-1.5">@{r.nickname}</span>}
                    </div>
                    {r.country && <div className="text-[10px] uppercase text-zinc-500">{r.country}</div>}
                  </div>
                </Link>
                <FriendAction row={r} onAdd={() => addFriend(r)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FriendAction({ row, onAdd }: { row: SearchResult; onAdd: () => void }) {
  switch (row.friendship.state) {
    case 'self':
      return null;
    case 'friends':
      return (
        <span className="text-[11px] text-emerald-300 flex items-center gap-1">
          <Check size={12} /> Friends
        </span>
      );
    case 'outgoing':
      return (
        <span className="text-[11px] text-zinc-400 flex items-center gap-1">
          <Clock size={12} /> Requested
        </span>
      );
    case 'incoming':
      return (
        <button
          onClick={onAdd}
          className="text-[11px] bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold rounded-lg px-2 py-1 flex items-center gap-1"
        >
          <Check size={12} /> Accept
        </button>
      );
    default:
      return (
        <button
          onClick={onAdd}
          className={cn(
            'text-[11px] border border-[var(--border)] hover:bg-white/10 rounded-lg px-2 py-1 flex items-center gap-1',
          )}
        >
          <UserPlus size={12} /> Add
        </button>
      );
  }
}
