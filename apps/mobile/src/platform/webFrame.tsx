import type { ReactNode } from 'react';

/** Native: the app fills the screen. The web build centres it (webFrame.web.tsx). */
export function WebFrame({ children }: { children: ReactNode }) {
  return children;
}

/** Native: never a desktop browser. */
export function useWideWeb(): boolean {
  return false;
}

/** Native: the window (only desktop layouts read it, and they never render here). */
export function useRawWindow(): { width: number; height: number } {
  return { width: 0, height: 0 };
}
