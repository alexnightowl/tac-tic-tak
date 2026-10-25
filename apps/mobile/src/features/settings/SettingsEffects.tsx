import { useEffect } from 'react';

import { startReminderSync } from '@/features/notifications/reminder';
import { useOnboardingGate } from '@/features/onboarding/gate';
import { startSoundMirror } from './soundMirror';

/**
 * App-wide side effects of the settings stream, rendered once inside the
 * signed-in (app) stack: the onboarding gate (settings.onboardingCompleted),
 * the local streak-reminder sync (re-plans after every finished session,
 * language change and foreground) and the account soundEnabled → feel
 * engine mirror. Renders nothing.
 */
export function SettingsEffects() {
  useOnboardingGate();
  useEffect(() => startReminderSync(), []);
  useEffect(() => startSoundMirror(), []);
  return null;
}
