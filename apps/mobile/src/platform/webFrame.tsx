import type { ReactNode } from 'react';

/** Native: the app fills the screen. The web build centres it (webFrame.web.tsx). */
export function WebFrame({ children }: { children: ReactNode }) {
  return children;
}
