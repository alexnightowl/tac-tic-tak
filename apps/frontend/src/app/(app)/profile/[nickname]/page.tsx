'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Zap, Timer, Hourglass, Trophy, CalendarDays, Users } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/Avatar';
import { SessionList, SessionRow } from '@/components/SessionList';
import { TrainingStyle, TRAINING_STYLES } from '@/lib/levels';
import { ProfileEditor } from '@/components/ProfileEditor';
import { FriendActionButton } from '@/components/FriendActionButton';

type PublicProfile = {
  id: string;
  nickname: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  createdAt: string;
  progressions: Record<TrainingStyle, { currentPuzzleRating: number; unlockedStartRating: number; startPuzzleRating: number }>;
  allTimePeak: number | null;
  recentSessions: SessionRow[];
};

const STYLE_ICONS = {
  bullet: Zap,
  blitz: Timer,
  rapid: Hourglass,
} as const;

export default function ProfilePage() {
  const { nickname } = useParams<{ nickname: string }>();
  const me = useAppStore((s) => s.user);
  const language = useAppStore((s) => s.settings.language);
  const t = useT();

  const isSelf = !!me && me.nickname.toLowerCase() === nickname?.toLowerCase();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['profile', nickname],
    queryFn: () => http.get<PublicProfile>(`/users/by-nickname/${encodeURIComponent(nickname)}`),
    enabled: !!nickname,
  });

  if (isLoading) {
    return <div className="text-sm text-zinc-500">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center mt-12 space-y-2">
        <div className="text-lg font-semibold">{t('profile.not_found_title')}</div>
        <p className="text-sm text-zinc-500">{t('profile.not_found_hint').replace('{nickname}', nickname ?? '')}</p>
      </div>
    );
  }

  const displayName = data.displayName?.trim() || data.nickname;
  const joined = new Date(data.createdAt).toLocaleDateString(
    language === 'uk' ? 'uk-UA' : 'en-US',
    { year: 'numeric', month: 'long' },
  );

  return (
    <div className="space-y-6">
      <Card className="!p-5">
        <div className="flex items-start gap-4">
          <Avatar nickname={data.nickname} avatarUrl={data.avatarUrl} size={80} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight truncate max-w-full">{displayName}</h1>
              {data.displayName && (
                <span className="text-sm text-zinc-500 truncate">@{data.nickname}</span>
              )}
              {data.country && (
                <span className="text-xs text-zinc-400 uppercase">· {data.country}</span>
              )}
            </div>
            {data.bio && <p className="text-sm text-zinc-300 mt-1.5 whitespace-pre-wrap">{data.bio}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <CalendarDays size={12} /> {t('profile.joined')} {joined}
              </span>
              {data.allTimePeak != null && (
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Trophy size={12} /> {t('profile.peak')} {data.allTimePeak}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions row — breaks to its own line so the text column gets
            the full card width and the long date/peak strings don't wrap
            awkwardly against the buttons. */}
        <div className="flex flex-wrap gap-2 mt-4 sm:justify-end">
          {isSelf ? (
            <>
              <Link href="/friends"
                className="h-9 px-3 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-[var(--border)] flex items-center gap-1.5">
                <Users size={14} /> {t('nav.friends')}
              </Link>
              <ProfileEditor onSaved={() => refetch()} />
            </>
          ) : <FriendActionButton nickname={data.nickname} targetUserId={data.id} />}
        </div>
      </Card>

      <div>
        <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-2">{t('profile.ratings')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {TRAINING_STYLES.map((s) => {
            const Icon = STYLE_ICONS[s];
            const prog = data.progressions[s];
            return (
              <Card key={s} className="!p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400">
                    {t(`style.${s}.name`)}
                  </span>
                  <Icon size={14} className="text-[var(--accent)]" />
                </div>
                <div className="text-2xl font-semibold tabular-nums leading-none">
                  {prog?.currentPuzzleRating ?? '—'}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1 tabular-nums">
                  {t('play.unlocked')} {prog?.unlockedStartRating ?? '—'}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-2">{t('profile.recent')}</h2>
        <SessionList
          sessions={data.recentSessions}
          onDelete={() => {}}
          language={language}
          emptyLabel={t('profile.no_sessions')}
        />
      </div>
    </div>
  );
}
