import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './fonts.css';
import './globals.css';
import { Providers } from '@/lib/providers';
import { ToastContainer } from '@/components/Toast';
import { OnboardingModal } from '@/components/Onboarding';
import { tokensCss } from '@/v2/tokens';

// Ember on stone: Cinzel for display (titles, numbers, buttons),
// Manrope for UI text. Oswald stays for the landing page. Self-hosted in
// public/fonts (fonts.css), the way next/font used to emit them.
const PRELOAD_FONTS = [
  'oswald-latin', 'oswald-latin-ext', 'oswald-cyrillic',
  'cinzel-latin', 'cinzel-latin-ext',
  'manrope-latin', 'manrope-latin-ext', 'manrope-cyrillic',
];

export const metadata: Metadata = {
  title: 'tac·tic·tak — Sharpen your instincts',
  description: 'Adaptive chess tactics trainer. Bullet, blitz, rapid — real progression, every session.',
  manifest: '/manifest.webmanifest',
  applicationName: 'tac·tic·tak',
  appleWebApp: {
    capable: true,
    title: 'tac·tic·tak',
    statusBarStyle: 'black-translucent',
  },
  other: {
    // Android/Chrome PWA flag; the apple variant is emitted via `appleWebApp`.
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // Paint the browser chrome (Chrome's top address bar + newer Safari's
  // bottom bar) in the app's base background colour so the browser UI
  // blends into the app. Both media buckets set the same value because
  // the app forces dark mode regardless of system preference.
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#1d1b20' },
    { media: '(prefers-color-scheme: light)', color: '#1d1b20' },
  ],
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Design v2 tokens from @tac/core (D31). */}
        <style dangerouslySetInnerHTML={{ __html: tokensCss() }} />
        {PRELOAD_FONTS.map((f) => (
          <link key={f} rel="preload" href={`/fonts/${f}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
      </head>
      <body className="app-shell">
        <Providers>
          {children}
          <OnboardingModal />
        </Providers>
        <ToastContainer />
        <div className="rotate-lock" role="alert">
          <div className="rotate-lock-icon" aria-hidden>↻</div>
          <div className="text-base font-medium">Please rotate your device</div>
          <div className="text-sm text-zinc-400">Будь ласка, поверніть пристрій</div>
        </div>
      </body>
    </html>
  );
}
