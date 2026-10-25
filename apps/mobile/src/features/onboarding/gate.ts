import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { meQuery } from '@/features/auth/session';
import { useAppStore } from '@/stores/appStore';
import { authStore, useAuthStore } from '@/stores/authStore';

// Gate for the welcome slides (web OnboardingModal: user && settingsReady
// && !onboardingCompleted). "Ready" means a /users/me body for this account
// has landed: before that the store holds defaults (onboardingCompleted
// false), which would show the slides to everyone offline.

let open = false;
// The account that closed the slides this launch. The save is optimistic
// with rollback, so offline a refused PATCH flips the flag back to false;
// without this the gate would reopen the slides the moment they closed.
// The next launch asks again.
let dismissedBy: string | null = null;

/** The slides closed (skip, close, back or "Let's go"): don't reopen them for this account this launch. */
export function markOnboardingDismissed(): void {
  dismissedBy = authStore.getState().user?.id ?? null;
}

/** The onboarding screen marks itself open, so the gate never stacks a second copy. */
export function setOnboardingOpen(v: boolean): void {
  open = v;
}

export function isOnboardingOpen(): boolean {
  return open;
}

/** Opens the onboarding modal over whatever is showing. */
export function openOnboarding(): void {
  if (open) return;
  open = true;
  router.push('/onboarding');
}

/** Mount once inside the signed-in stack. */
export function useOnboardingGate(): void {
  const authed = useAuthStore((s) => s.status === 'authed');
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const done = useAppStore((s) => s.settings.onboardingCompleted);
  // Same query as the bootstrap; only "has it succeeded" is read here.
  const me = useQuery({ ...meQuery, enabled: authed });
  const ready = authed && me.isSuccess && me.data?.id === userId;

  useEffect(() => {
    if (ready && !done && dismissedBy !== userId) openOnboarding();
  }, [ready, done, userId]);
}
