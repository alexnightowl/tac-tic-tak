'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, UserMinus, UserPlus, X, Clock } from 'lucide-react';
import { http } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Avatar } from '@/components/Avatar';
import { Card, CardTitle } from '@/components/ui/card';
import { UserSearch } from '@/components/UserSearch';

type UserCard = { id: string; nickname: string; displayName: string | null; avatarUrl: string | null; country: string | null };

type FriendsList = Array<{ friendshipId: string; since: string | null; user: UserCard }>;
type PendingList = { incoming: Array<{ id: string; createdAt: string; user: UserCard }>; outgoing: Array<{ id: string; createdAt: string; user: UserCard }> };

export default function FriendsPage() {
  const t = useT();
  const qc = useQueryClient();

  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => http.get<FriendsList>('/friends'),
  });
  const pending = useQuery({
    queryKey: ['friends-pending'],
    queryFn: () => http.get<PendingList>('/friends/pending'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['friends'] });
    qc.invalidateQueries({ queryKey: ['friends-pending'] });
  };

  const accept = async (id: string) => {
    await http.post(`/friends/${id}/accept`);
    invalidate();
  };
  const decline = async (id: string) => {
    await http.del(`/friends/${id}`);
    invalidate();
  };
  const remove = async (otherId: string) => {
    await http.del(`/friends/by-user/${otherId}`);
    invalidate();
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t('friends.title')}</h1>

      <Card>
        <CardTitle>{t('friends.find')}</CardTitle>
        <div className="mt-2">
          <UserSearch placeholder={t('friends.search_placeholder')} onAction={invalidate} />
        </div>
      </Card>

      {pending.data && pending.data.incoming.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-2">
            {t('friends.incoming')} ({pending.data.incoming.length})
          </h2>
          <ul className="space-y-1.5">
            {pending.data.incoming.map((r) => (
              <li key={r.id} className="glass rounded-xl p-2.5 flex items-center gap-3">
                <Link href={`/profile/${r.user.nickname}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar nickname={r.user.nickname} avatarUrl={r.user.avatarUrl} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {r.user.displayName || r.user.nickname}
                      {r.user.displayName && <span className="text-zinc-500 ml-1.5">@{r.user.nickname}</span>}
                    </div>
                  </div>
                </Link>
                <button onClick={() => accept(r.id)}
                  className="text-[11px] bg-[var(--accent)] text-black font-semibold rounded-lg px-2.5 py-1 flex items-center gap-1">
                  <Check size={12} /> {t('friends.accept')}
                </button>
                <button onClick={() => decline(r.id)}
                  className="text-[11px] border border-[var(--border)] text-zinc-300 rounded-lg px-2.5 py-1 flex items-center gap-1 hover:bg-white/5">
                  <X size={12} /> {t('friends.decline')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.data && pending.data.outgoing.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-2">
            {t('friends.outgoing')} ({pending.data.outgoing.length})
          </h2>
          <ul className="space-y-1.5">
            {pending.data.outgoing.map((r) => (
              <li key={r.id} className="glass rounded-xl p-2.5 flex items-center gap-3">
                <Link href={`/profile/${r.user.nickname}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar nickname={r.user.nickname} avatarUrl={r.user.avatarUrl} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {r.user.displayName || r.user.nickname}
                      {r.user.displayName && <span className="text-zinc-500 ml-1.5">@{r.user.nickname}</span>}
                    </div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> {t('friends.waiting')}
                    </div>
                  </div>
                </Link>
                <button onClick={() => decline(r.id)}
                  className="text-[11px] border border-[var(--border)] text-zinc-300 rounded-lg px-2.5 py-1 flex items-center gap-1 hover:bg-white/5">
                  <X size={12} /> {t('friends.cancel')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-2">
          {t('friends.my')} ({friends.data?.length ?? 0})
        </h2>
        {friends.data && friends.data.length === 0 && (
          <Card className="text-center text-sm text-zinc-500">
            {t('friends.empty')}
          </Card>
        )}
        {friends.data && friends.data.length > 0 && (
          <ul className="space-y-1.5">
            {friends.data.map((r) => (
              <li key={r.friendshipId} className="glass rounded-xl p-2.5 flex items-center gap-3">
                <Link href={`/profile/${r.user.nickname}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar nickname={r.user.nickname} avatarUrl={r.user.avatarUrl} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {r.user.displayName || r.user.nickname}
                      {r.user.displayName && <span className="text-zinc-500 ml-1.5">@{r.user.nickname}</span>}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => remove(r.user.id)}
                  className="text-[11px] text-zinc-400 hover:text-rose-300 flex items-center gap-1 px-2"
                  aria-label={t('friends.unfriend')}
                >
                  <UserMinus size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
