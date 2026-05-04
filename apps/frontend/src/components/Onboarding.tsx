'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Flame,
  Layers,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Step = {
  id: string;
  icon: ReactNode;
  titleKey: string;
  bodyKey: string;
};

/**
 * First-login welcome modal. Five slides walk through the core
 * concepts so a new user understands what training styles are,
 * what calibration means, and what's worth exploring outside the
 * play screen. Skippable any time. Re-launchable from Settings.
 *
 * Persistence: settings.onboardingCompleted is the gate. Set true
 * on Skip / Done; the modal silently drops out on next render.
 * Backfill in the migration sets true for existing users with
 * session history so they don't get re-onboarded.
 */
export function OnboardingModal() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const settingsReady = useAppStore((s) => s.settingsReady);
  const setSettings = useAppStore((s) => s.setSettings);
  const t = useT();
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const steps: Step[] = useMemo(() => [
    {
      id: 'welcome',
      icon: <Sparkles size={28} className="text-amber-300" />,
      titleKey: 'onboarding.welcome.title',
      bodyKey: 'onboarding.welcome.body',
    },
    {
      id: 'styles',
      icon: <Layers size={28} className="text-[var(--accent)]" />,
      titleKey: 'onboarding.styles.title',
      bodyKey: 'onboarding.styles.body',
    },
    {
      id: 'calibration',
      icon: <Compass size={28} className="text-amber-300" />,
      titleKey: 'onboarding.calibration.title',
      bodyKey: 'onboarding.calibration.body',
    },
    {
      id: 'streak',
      icon: <Flame size={28} className="text-amber-300" />,
      titleKey: 'onboarding.streak.title',
      bodyKey: 'onboarding.streak.body',
    },
    {
      id: 'start',
      icon: <Swords size={28} className="text-[var(--accent)]" />,
      titleKey: 'onboarding.start.title',
      bodyKey: 'onboarding.start.body',
    },
  ], []);

  const total = steps.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  const shouldShow = !!user && settingsReady && !settings.onboardingCompleted;
  if (!shouldShow || !mounted) return null;

  const persistDone = async () => {
    setSettings({ onboardingCompleted: true });
    try {
      await http.patch('/users/me/settings', { onboardingCompleted: true });
    } catch {
      // Server save can fail (offline) — local flag is already
      // flipped, modal stays closed for the rest of the session.
      // Next /users/me load reconciles.
    }
  };

  const skip = () => {
    void persistDone();
  };

  const finish = () => {
    void persistDone();
    // Last slide pitches "Pick a style and start" — drop the
    // user on /play so the very next thing they see is the
    // training setup. They can still go elsewhere via the nav.
    router.push('/play');
  };

  const current = steps[step];

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="glass rounded-3xl w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={skip}
          aria-label={t('onboarding.skip')}
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center pt-3">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
              border: '1px solid var(--border)',
            }}
          >
            {current.icon}
          </div>

          <h2
            id="onboarding-title"
            className="text-xl font-semibold tracking-tight"
          >
            {t(current.titleKey)}
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed mt-2 max-w-[360px]">
            {t(current.bodyKey)}
          </p>
        </div>

        {/* dot indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-6 bg-[var(--accent)]' : 'w-1.5 bg-white/15',
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          <button
            type="button"
            onClick={skip}
            className="text-xs text-zinc-500 hover:text-white px-2 py-1 transition-colors"
          >
            {t('onboarding.skip')}
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="glass"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
            )}
            {!isLast ? (
              <Button size="sm" onClick={() => setStep((s) => Math.min(total - 1, s + 1))}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            ) : (
              <Button size="sm" onClick={finish}>
                <Check size={16} /> {t('onboarding.done')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
