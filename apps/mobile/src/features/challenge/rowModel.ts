import type { ChallengeSummary } from '@tac/core/storm';

import { feel } from '@/feel';
import { displayNameOf } from '@/features/social/actions';
import { toast } from '@/shell/toast/store';
import { confirm } from '@/ui';
import type { TFn } from '@/ui/lang';
import { challengeApi, invalidateChallenges } from './api';
import { leftShort } from './parts';

// One challenge row's text and its "take it off my list" action, shared by
// the phone's Rivals section (RivalsChallenges) and the desktop League card.

export type ChallengeRowKind = 'incoming' | 'outgoing' | 'finished';
export type ChallengeChipKind = 'win' | 'loss' | 'draw' | 'new' | 'muted';

/** Finished rows shown before "More". */
export const FINISHED_FIRST = 3;

/** Subtitle ("Race · 21 h left", "won 14 : 10", …) and the trailing chip. */
export function challengeRowText(
  c: ChallengeSummary,
  kind: ChallengeRowKind,
  t: TFn,
): { subtitle: string; chip: { label: string; kind: ChallengeChipKind } | null } {
  const fmt = t(`challenge.format.${c.format}`);
  const me = c.myScore ?? 0;
  const them = c.theirScore ?? 0;
  if (kind === 'incoming') {
    return {
      subtitle: t('challenge.row.incoming', { format: fmt, left: leftShort(t, c.expiresAt) }),
      chip: { label: t('challenge.chip.new'), kind: 'new' },
    };
  }
  if (kind === 'outgoing') return { subtitle: t('challenge.row.outgoing', { format: fmt, n: me }), chip: null };
  if (c.status === 'finished') {
    const v = c.verdict ?? 'draw';
    return {
      subtitle: t(v === 'win' ? 'challenge.row.won' : v === 'loss' ? 'challenge.row.lost' : 'challenge.row.drew', { me, them }),
      chip: { label: t(v === 'win' ? 'challenge.chip.w' : v === 'loss' ? 'challenge.chip.l' : 'challenge.chip.d'), kind: v },
    };
  }
  return {
    subtitle: t(c.status === 'declined' ? 'challenge.row.declined' : 'challenge.row.expired'),
    chip: { label: '–', kind: 'muted' },
  };
}

/** The action's label: Decline (incoming), Withdraw (mine, waiting), Remove (finished). */
export function challengeRemoveLabel(kind: ChallengeRowKind, t: TFn): string {
  return t(kind === 'incoming' ? 'challenge.swipe.decline' : kind === 'outgoing' ? 'challenge.swipe.withdraw' : 'challenge.swipe.remove');
}

/**
 * Takes the challenge off my list: an incoming one is declined and a waiting
 * one of mine withdrawn, each after the confirm sheet; a finished one just
 * goes. Resolves true once it is gone.
 */
export function removeChallenge(c: ChallengeSummary, kind: ChallengeRowKind, t: TFn): Promise<boolean> {
  const name = displayNameOf(c.other);
  const go = async () => {
    try {
      await challengeApi.remove(c.id);
      feel.emit('discard');
      invalidateChallenges();
      return true;
    } catch {
      feel.emit('formError');
      toast.show({ title: t('challenge.remove_error') });
      return false;
    }
  };
  if (kind === 'finished') return go();
  feel.emit('exitSheet');
  const incoming = kind === 'incoming';
  return new Promise((resolve) => {
    confirm({
      testID: incoming ? 'challenge-decline' : 'challenge-withdraw',
      title: incoming ? t('challenge.decline_title') : t('challenge.withdraw_title'),
      body: incoming ? t('challenge.decline_body', { name }) : t('challenge.withdraw_body', { name }),
      confirmLabel: incoming ? t('challenge.decline') : t('challenge.withdraw'),
      cancelLabel: incoming ? t('challenge.decline_keep') : t('challenge.withdraw_keep'),
      onConfirm: () => void go().then(resolve),
      onCancel: () => resolve(false),
    });
  });
}
