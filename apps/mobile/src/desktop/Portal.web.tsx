import { useEffect, type ReactNode } from 'react';

// react-dom ships with react-native-web; its types are not installed.
const { createPortal } = require('react-dom') as { createPortal: (node: ReactNode, el: Element) => ReactNode };

/**
 * Renders a desktop overlay (dialog, side panel) at the end of <body>.
 * react-native-web gives every View `z-index: 0`, so each one is its own
 * stacking context: an overlay left inside the page could never rise above
 * the sidebar, whatever its z-index. Context still flows through the portal.
 * Opening one drops the focus left on the control that opened it (its ring
 * would otherwise glow through the scrim).
 */
export function Portal({ children }: { children: ReactNode }) {
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, []);
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
}
