import type { Metadata, Viewport } from 'next';
import { Oswald } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';
import { ToastContainer } from '@/components/Toast';

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
    { media: '(prefers-color-scheme: dark)',  color: '#0b0d10' },
    { media: '(prefers-color-scheme: light)', color: '#0b0d10' },
  ],
  colorScheme: 'dark',
};

// Runs synchronously before React hydrates. Reads the user's cached
// accent colour and applies it as a CSS variable on <html> so the first
// paint never uses the default red. Kept inline (not a module import)
// so it executes before any content renders.
const accentHydrationScript = `(function(){try{var s=localStorage.getItem('taktic.settings');if(!s)return;var a=JSON.parse(s).accentColor;if(!a)return;var d=document.documentElement.style;d.setProperty('--accent',a);var h=a.replace('#','');if(h.length===6){var r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);if(!isNaN(r)&&!isNaN(g)&&!isNaN(b)){var L=(0.299*r+0.587*g+0.114*b)/255;d.setProperty('--accent-contrast',L>0.6?'#000':'#fff');}}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${displayFont.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: accentHydrationScript }} />
      </head>
      <body className="app-shell">
        <div className="app-glow" aria-hidden />
        <Providers>{children}</Providers>
        <ToastContainer />
      </body>
    </html>
  );
}
