import type { Metadata, Viewport } from 'next';
import { Oswald, Cinzel, Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';
import { ToastContainer } from '@/components/Toast';
import { OnboardingModal } from '@/components/Onboarding';

const displayFont = Oswald({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

// Ember on stone: Cinzel for display (titles, numbers, buttons),
// Manrope for UI text. Oswald stays for the landing page.
const serifFont = Cinzel({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
});
const uiFont = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

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
    { media: '(prefers-color-scheme: dark)',  color: '#141317' },
    { media: '(prefers-color-scheme: light)', color: '#141317' },
  ],
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${displayFont.variable} ${serifFont.variable} ${uiFont.variable}`} suppressHydrationWarning>
      <body className="app-shell">
        <Providers>
          {children}
          <OnboardingModal />
        </Providers>
        <ToastContainer />
        <div className="eos-fade" aria-hidden />
        <div className="rotate-lock" role="alert">
          <div className="rotate-lock-icon" aria-hidden>↻</div>
          <div className="text-base font-medium">Please rotate your device</div>
          <div className="text-sm text-zinc-400">Будь ласка, поверніть пристрій</div>
        </div>
      </body>
    </html>
  );
}
