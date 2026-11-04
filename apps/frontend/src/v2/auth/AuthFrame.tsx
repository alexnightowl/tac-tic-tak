'use client';

import { keyframes, keyframeStops } from '@tac/core/tokens';
import type { Language } from '@tac/core/i18n';
import { useCallback, useRef, type ReactNode } from 'react';

import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { AppText, BrandLogo, Press, Segmented } from '@/v2/ui';
import './auth.css';

/**
 * The login / register page (app features/auth): the brand block (logo,
 * Cinzel wordmark, subtitle), the form card and the switch link, centred
 * on the ink ground. The web adds the app menu's EN / УКР switch in the
 * corner, since a signed-out visitor has no other way to pick a language.
 */
export function AuthFrame({
  logo,
  subtitle,
  testID,
  children,
  footer,
}: {
  logo: number;
  subtitle: string;
  testID: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const t = useT();
  return (
    <main className="v2-auth" data-testid={testID}>
      <div className="v2-auth-lang">
        <LangSwitch />
      </div>
      <div className="v2-auth-col">
        <div className="v2-auth-brand">
          <BrandLogo size={logo} />
          {/* The wordmark is Latin in both languages: always Cinzel. */}
          <AppText as="h1" variant="sectionTitle" lang="en" style={{ textAlign: 'center' }}>
            {t('brand.name')}
          </AppText>
          <AppText as="p" variant="body" color="var(--eos-ash)" style={{ textAlign: 'center' }}>
            {subtitle}
          </AppText>
        </div>
        {children}
        {footer}
      </div>
    </main>
  );
}

/** EN / УКР, remembered in localStorage (the landing page reads the same key). */
export function LangSwitch() {
  const t = useT();
  const lang = useAppStore((s) => s.settings.language);
  const setSettings = useAppStore((s) => s.setSettings);
  return (
    <Segmented
      options={[
        { value: 'en', label: t('shell.lang.en') },
        { value: 'uk', label: t('shell.lang.uk') },
      ]}
      value={lang}
      onChange={(v: Language) => setSettings({ language: v })}
      size="sm"
      testID="auth-lang"
      accessibilityLabel={t('settings.language')}
      style={{ width: 128 }}
    />
  );
}

/** "No account? Create account" under the form. */
export function AuthSwitch({ prompt, action, href, testID }: { prompt: string; action: string; href: string; testID: string }) {
  return (
    <p className="v2-auth-switch">
      <AppText variant="body" color="var(--eos-ash)">
        {prompt}
      </AppText>
      <Press href={href} testID={testID} className="v2-auth-switch-link">
        <AppText variant="body">{action}</AppText>
      </Press>
    </p>
  );
}

/** Form-shake amplitude: the pieceShakeX stops are fractions; ±0.06 → ±7 px (app useShake). */
const AMPLITUDE = 120;

/**
 * Error shake for the form card, on the piece-shake keyframes so the two
 * read as one gesture. Off under reduced motion.
 */
export function useShake<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const shake = useCallback(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const [x1, y1, x2, y2] = keyframes.pieceShake.easing;
    el.animate(
      keyframeStops.pieceShakeX.map(([offset, v]) => ({ offset, transform: `translateX(${v * AMPLITUDE}px)` })),
      { duration: keyframes.pieceShake.duration, easing: `cubic-bezier(${x1},${y1},${x2},${y2})` },
    );
  }, []);
  return { ref, shake };
}
