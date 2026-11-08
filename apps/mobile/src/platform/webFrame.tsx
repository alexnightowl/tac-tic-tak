import type { ReactNode } from 'react';

/** Native: the app fills the screen. The web build centres it (webFrame.web.tsx). */
export function WebFrame({ children }: { children: ReactNode }) {
  return children;
}

/** Native: never a desktop browser. */
export function useWideWeb(): boolean {
  return false;
}
