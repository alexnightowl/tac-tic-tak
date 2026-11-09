import type { ReactNode } from 'react';

/** Native: in place (desktop overlays never render there). The web lifts them to <body> (Portal.web.tsx). */
export function Portal({ children }: { children: ReactNode }) {
  return children;
}
