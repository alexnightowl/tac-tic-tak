import { useEffect } from 'react';
import { create } from 'zustand';

import type { DesktopChrome } from './routes';

/**
 * A screen that changes its shell while it stays on one route (the runner:
 * the compact board rail while solving, the full sidebar on its summary)
 * sets the chrome here while mounted; WebFrame prefers it to the route
 * registry.
 */
export const useChromeOverride = create<{ chrome: DesktopChrome | null }>(() => ({ chrome: null }));

export function useDesktopChrome(chrome: DesktopChrome | null): void {
  useEffect(() => {
    useChromeOverride.setState({ chrome });
    return () => useChromeOverride.setState({ chrome: null });
  }, [chrome]);
}
