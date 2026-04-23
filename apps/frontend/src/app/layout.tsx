import type { Metadata, Viewport } from 'next';
import { Oswald } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

const displayFont = Oswald({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0b0d10',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${displayFont.variable}`}>
      <body className="app-shell">
        <div className="app-glow" aria-hidden />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
