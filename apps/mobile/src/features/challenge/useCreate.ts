import { isApiError } from '@tac/core/api';
import { raceBase, STORM_FORMATS, type StormFormat } from '@tac/core/storm';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useMemo, useState } from 'react';

import { feel } from '@/feel';
import { displayNameOf } from '@/features/social/actions';
import { friendsQuery, profileQuery, type FriendRow } from '@/features/social/api';
import { openRun, runHref } from '@/features/storm/launch';
import { toast } from '@/shell/toast/store';
import { useT } from '@/ui/lang';
import { challengeApi, invalidateChallenges } from './api';
import { useMyRating } from './parts';

// Challenge Create's state and Send, shared by the phone screen
// (CreateScreen) and the desktop page (desktop/home DxChallenge).

/** GET /friends rows carry presence since the Storm backend. */
export type Friend = FriendRow & { online?: boolean };

const isFormat = (f: string | undefined): f is StormFormat => !!f && (STORM_FORMATS as readonly string[]).includes(f);

export type CreateParams = { friend?: string; format?: string; run?: string; score?: string };

/**
 * Without `run` the challenger plays first: POST, then straight into the
 * runner. With `run` (a dare from Storm Result) the run's own stream and
 * format are used and the challenge goes out at once.
 */
export function useChallengeCreate({ friend, format: formatParam, run, score }: CreateParams) {
  const t = useT();
  const dare = !!run;
  const friends = useQuery(friendsQuery());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(friend ?? null);
  const [format, setFormat] = useState<StormFormat>(dare ? 'time3' : isFormat(formatParam) ? formatParam : 'time3');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = ((friends.data ?? []) as Friend[]).slice();
    // Online first, then by name; the preselected friend leads.
    all.sort((a, b) => Number(!!b.online) - Number(!!a.online) || displayNameOf(a.user).localeCompare(displayNameOf(b.user)));
    if (friend) {
      const i = all.findIndex((f) => f.user.id === friend);
      if (i > 0) all.unshift(...all.splice(i, 1));
    }
    const q = query.trim().replace(/^@/, '').toLowerCase();
    return q ? all.filter((f) => f.user.nickname.toLowerCase().includes(q) || (f.user.displayName ?? '').toLowerCase().includes(q)) : all;
  }, [friends.data, query, friend]);

  const selected = ((friends.data ?? []) as Friend[]).find((f) => f.user.id === picked) ?? null;
  const name = selected ? displayNameOf(selected.user) : '';

  // The friend's rating: their highest style rating from the public profile.
  const profile = useQuery({ ...profileQuery(selected?.user.nickname ?? ''), enabled: !!selected });
  const mine = useMyRating();
  const theirs = profile.data
    ? Math.max(0, ...Object.values(profile.data.progressions).map((p) => p?.currentPuzzleRating ?? 0))
    : 0;
  const avg = selected && theirs > 0 ? raceBase(mine, theirs).avg : null;

  const pick = (id: string) => {
    feel.emit('toggle');
    setPicked(id);
    setError(null);
  };

  const send = async () => {
    if (!selected || sending) return;
    setSending(true);
    setError(null);
    try {
      const trimmed = note.trim();
      const r = await challengeApi.create({
        opponentId: selected.user.id,
        format,
        ...(trimmed ? { note: trimmed } : {}),
        ...(run ? { runId: run } : {}),
      });
      invalidateChallenges();
      const id = r.challenge.id;
      if (dare) {
        feel.emit('achievementToast');
        toast.show({ title: t('challenge.sent', { name }), icon: Send, ...(score ? { description: t('challenge.sent_body', { name, n: score }) } : {}) });
        router.replace(`/challenge/${id}` as Href);
      } else {
        // The challenge exists now: if its stream fails here, the runner retries it.
        await openRun({ challengeId: id, format, replace: true }).catch(() => router.replace(runHref(id, format)));
      }
    } catch (e) {
      feel.emit('formError');
      const status = isApiError(e) ? e.status : 0;
      setError(
        status === 403
          ? t('challenge.err.friends')
          : status === 429
            ? t('challenge.err.limit')
            : status === 404 && dare
              ? t('challenge.err.run')
              : t('challenge.err.generic'),
      );
      setSending(false);
    }
  };

  const hint = dare ? t('challenge.hint.dare', { n: score ?? '' }) : t(`challenge.hint.${format}`);

  return { dare, friends, query, setQuery, picked, pick, rows, selected, name, avg, format, setFormat, note, setNote, sending, error, send, hint };
}
