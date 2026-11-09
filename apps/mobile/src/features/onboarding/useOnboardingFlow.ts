import { CALIBRATION_SESSIONS } from '@tac/core/rules';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import { feel } from '@/feel';
import { recalibrate } from '@/features/settings/api';
import { patchSettings } from '@/shell/settings';
import { useAppStore } from '@/stores/appStore';
import { markOnboardingDismissed, setOnboardingOpen } from './gate';

// The onboarding flow shared by the phone OnboardingScreen and the desktop
// web layout: the step, the finish paths and the replay (recalibrate)
// branch. The top bar's Skip, Android back on step 1, "Skip — start at
// 1200" and "Find my level" all mark onboardingCompleted (optimistic; the
// web ignored a failed save the same way). Placement does not exist on the
// backend: "Find my level" opens the Play tab, where the first five
// sessions in a style calibrate the rating; "Skip — start at 1200" lands on
// Home. Replayed by a player who already finished calibration in some
// style, the last step offers "Recalibrate my level" (POST
// /users/me/recalibrate, then Play) and "Keep my level" (Home) instead.

export const ONBOARDING_STEPS = ['welcome', 'training', 'path', 'habit'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const ONBOARDING_LAST = ONBOARDING_STEPS.length - 1;
/** The backend's starting puzzle rating (Rating.startPuzzleRating default). */
export const START_RATING = 1200;

export type OnboardingFinish = 'close' | 'play' | 'home';

export function useOnboardingFlow() {
  const [step, setStep] = useState(0);
  const finished = useRef(false);
  // Mirrors `step` for the Android back handler registered once on mount.
  const stepRef = useRef(0);
  // Read once: recalibrating flips it mid-screen.
  const [veteran] = useState(() =>
    Object.values(useAppStore.getState().progressions).some((p) => p.calibrationSessionsLeft < CALIBRATION_SESSIONS),
  );
  const [recalState, setRecalState] = useState<'idle' | 'busy' | 'error'>('idle');

  const finish = (to: OnboardingFinish) => {
    if (finished.current) return;
    finished.current = true;
    markOnboardingDismissed();
    void patchSettings({ onboardingCompleted: true });
    router.back();
    if (to === 'play') router.navigate('/play' as Href);
    else if (to === 'home') router.navigate('/' as Href);
  };

  const onRecalibrate = async () => {
    setRecalState('busy');
    try {
      await recalibrate();
      finish('play');
    } catch {
      setRecalState('error');
    }
  };

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(ONBOARDING_LAST, i));
    if (next === stepRef.current) return;
    feel.emit('tabChange');
    stepRef.current = next;
    setStep(next);
  };

  useEffect(() => {
    setOnboardingOpen(true);
    // Android back: one step back; on the first step it skips (web: X = done).
    // No hardware back on the web.
    const sub =
      Platform.OS === 'web'
        ? null
        : BackHandler.addEventListener('hardwareBackPress', () => {
            if (stepRef.current > 0) goTo(stepRef.current - 1);
            else finish('close');
            return true;
          });
    return () => {
      sub?.remove();
      setOnboardingOpen(false);
      // Dismissed some other way (a deep link replaced it): still done, or
      // the gate would bring it straight back.
      if (!finished.current) {
        finished.current = true;
        markOnboardingDismissed();
        void patchSettings({ onboardingCompleted: true });
      }
    };
  }, []);

  return { step, id: ONBOARDING_STEPS[step], goTo, finish, veteran, recalState, onRecalibrate };
}
