import { queryKeys } from '@tac/core/api';
import { Alert } from 'react-native';

import { feel, type FeelEvent } from '@/feel';
import { queryClient } from '@/platform/query';
import { toast } from '@/shell/toast/store';
import { appStore } from '@/stores/appStore';
import { translatorFor } from '@/ui/lang';
import { friendsApi, type FriendshipStatus, type UserCard } from './api';

// Friend mutations shared by the Friends list, the search sheet and the
// profile button, so every surface toasts, buzzes and refreshes the same
// way (the web had three slightly different copies, two without error
// handling and one without achievement toasts).

/**
 * FEEL_TABLE has no social events yet (reported): each intent maps to the
 * closest existing event. `achievementToast` is the table's only silent
 * Success haptic; its throttle also keeps a first-friend unlock toast that
 * lands right after the accept from buzzing twice.
 */
const FEEL: Record<'sent' | 'accepted' | 'removed' | 'confirm' | 'error', FeelEvent> = {
  sent: 'toggle',
  accepted: 'achievementToast',
  removed: 'toggle',
  confirm: 'exitSheet',
  error: 'formError',
};

const tr = () => translatorFor(appStore.getState().settings.language);
export const displayNameOf = (u: Pick<UserCard, 'displayName' | 'nickname'>) => u.displayName?.trim() || u.nickname;

function refresh(nickname?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.friends() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.friendsPending() });
  void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  if (nickname) void queryClient.invalidateQueries({ queryKey: queryKeys.friendshipWith(nickname.toLowerCase()) });
  // Search rows carry a friendship state too.
  void queryClient.invalidateQueries({ queryKey: ['user-search'] });
}

function failed(): null {
  feel.emit(FEEL.error);
  toast.show({ title: tr().t('friends.toast_error') });
  return null;
}

/**
 * Add (or accept, when they already asked: the server auto-accepts). Returns
 * the resulting state so the caller can show it right away. Web bug fixed:
 * search marked an auto-accepted row "Requested" and dropped its unlocks.
 */
export async function sendRequest(user: UserCard): Promise<FriendshipStatus | null> {
  try {
    const r = await friendsApi.request(user.nickname);
    const { t } = tr();
    const accepted = r?.status === 'accepted';
    feel.emit(accepted ? FEEL.accepted : FEEL.sent);
    toast.show({ title: t(accepted ? 'friends.toast_accepted' : 'friends.toast_sent', { name: displayNameOf(user) }) });
    toast.achievements(r?.achievementsUnlocked, t);
    refresh(user.nickname);
    const id = (r as { id?: string } | undefined)?.id ?? null;
    return accepted ? { state: 'friends', friendshipId: id } : { state: 'outgoing', friendshipId: id };
  } catch {
    return failed();
  }
}

export async function acceptRequest(friendshipId: string, user: UserCard): Promise<boolean> {
  try {
    const r = await friendsApi.accept(friendshipId);
    const { t } = tr();
    feel.emit(FEEL.accepted);
    toast.show({ title: t('friends.toast_accepted', { name: displayNameOf(user) }) });
    toast.achievements(r?.achievementsUnlocked, t);
    refresh(user.nickname);
    return true;
  } catch {
    return !!failed();
  }
}

/** Decline an incoming request or cancel an outgoing one. */
export async function removeRequest(friendshipId: string, user: UserCard, kind: 'decline' | 'cancel'): Promise<boolean> {
  try {
    await friendsApi.remove(friendshipId);
    feel.emit(FEEL.removed);
    toast.show({ title: tr().t(kind === 'decline' ? 'friends.toast_declined' : 'friends.toast_cancelled') });
    refresh(user.nickname);
    return true;
  } catch {
    return !!failed();
  }
}

/** Unfriend behind a native confirm (the web removed on one tap). */
export function confirmUnfriend(user: UserCard, onDone?: (ok: boolean) => void): void {
  const { t } = tr();
  const name = displayNameOf(user);
  feel.emit(FEEL.confirm);
  Alert.alert(t('friends.unfriend_confirm_title', { name }), t('friends.unfriend_confirm_body'), [
    { text: t('common.cancel'), style: 'cancel', onPress: () => onDone?.(false) },
    {
      text: t('friends.unfriend'),
      style: 'destructive',
      onPress: async () => {
        try {
          await friendsApi.unfriend(user.id);
          feel.emit(FEEL.removed);
          toast.show({ title: t('friends.toast_removed', { name }) });
          refresh(user.nickname);
          onDone?.(true);
        } catch {
          failed();
          onDone?.(false);
        }
      },
    },
  ]);
}
