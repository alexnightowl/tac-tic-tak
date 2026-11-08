import type { ReactNode } from 'react';

/** How tall a sheet route is on the web: its content's height, or most of the window. */
export type WebSheetSize = 'fit' | 'tall';

/** Native: sheet routes are native formSheets; nothing to wrap. */
export function WebSheet({ children }: { size: WebSheetSize; children: ReactNode }) {
  return children;
}
