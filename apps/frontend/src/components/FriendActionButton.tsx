'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Loader2, UserMinus, UserPlus, X } from 'lucide-react';
import { http } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type FriendshipState = 'none' | 'self' | 'outgoing' | 'incoming' | 'friends';
type Status = { state: FriendshipState; friendshipId: string | null };

type Props = {
  nickname: string;
  targetUserId: string;
};

export function FriendActionButton({ nickname, targetUserId }: Props) {
  const t = useT();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['friendship-with', nickname],
    queryFn: () => http.get<Status>(`/users/by-nickname/${encodeURIComponent(nickname)}/friendship`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['friendship-with', nickname] });
    qc.invalidateQueries({ queryKey: ['friends'] });
    qc.invalidateQueries({ queryKey: ['friends-pending'] });
  };

  const request = useMutation({
    mutationFn: () => http.post('/friends/request', { nickname }),
    onSuccess: invalidate,
  });
  const accept = useMutation({
    mutationFn: (id: string) => http.post(`/friends/${id}/accept`),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: string) => http.del(`/friends/${id}`),
    onSuccess: invalidate,
  });
  const unfriend = useMutation({
    mutationFn: () => http.del(`/friends/by-user/${targetUserId}`),
    onSuccess: invalidate,
  });

  if (!q.data) return null;
  if (q.data.state === 'self') return null;

  const busy = request.isPending || accept.isPending || reject.isPending || unfriend.isPending;

  switch (q.data.state) {
    case 'none':
      return (
        <ActionBtn onClick={() => request.mutate()} disabled={busy}
          icon={<UserPlus size={14} />} label={t('profile.add_friend')} variant="primary" busy={busy} />
      );
    case 'outgoing':
      return (
        <ActionBtn
          onClick={() => q.data.friendshipId && reject.mutate(q.data.friendshipId)}
          disabled={busy}
          icon={<Clock size={14} />}
          label={t('profile.cancel_request')}
          variant="ghost"
          busy={busy}
        />
      );
    case 'incoming':
      return (
        <div className="flex gap-2">
          <ActionBtn
            onClick={() => q.data.friendshipId && accept.mutate(q.data.friendshipId)}
            disabled={busy}
            icon={<Check size={14} />}
            label={t('friends.accept')}
            variant="primary"
            busy={busy}
          />
          <ActionBtn
            onClick={() => q.data.friendshipId && reject.mutate(q.data.friendshipId)}
            disabled={busy}
            icon={<X size={14} />}
            label={t('friends.decline')}
            variant="ghost"
          />
        </div>
      );
    case 'friends':
      return (
        <ActionBtn
          onClick={() => unfriend.mutate()}
          disabled={busy}
          icon={<UserMinus size={14} />}
          label={t('profile.unfriend')}
          variant="ghost"
          busy={busy}
          hint={t('profile.friends')}
        />
      );
    default:
      return null;
  }
}

function ActionBtn({ onClick, icon, label, variant, disabled, busy, hint }: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant: 'primary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        'h-9 px-3 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-60',
        variant === 'primary'
          ? 'bg-[var(--accent)] text-black font-semibold hover:brightness-110'
          : 'bg-white/5 border border-[var(--border)] hover:bg-white/10',
      )}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
