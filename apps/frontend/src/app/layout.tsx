import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: 'tac-tic-tak',
  description: 'Adaptive chess tactics trainer',
  manifest: '/manifest.webmanifest',
  applicationName: 'tac-tic-tak',
  appleWebApp: {
    capable: true,
    title: 'tac-tic-tak',
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
    <html lang="en" className="dark">
      <body className="app-shell">
        <div className="app-glow" aria-hidden />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
