'use client';

import { WifiOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { useT } from '@/lib/i18n';
import { AppText } from '@/v2/ui';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** Only a definite "no": the server render and the first paint say online. */
export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine === false, () => false);
}

/**
 * The app's offline pill (shell/OfflineBanner.tsx) over the top of the
 * window. The web has no offline packs (PLAN §1), so it is never a link;
 * pages keep showing what React Query already holds.
 */
export function OfflineBanner() {
  const offline = useIsOffline();
  const t = useT();
  if (!offline) return null;
  return (
    <div className="v2-offline-host">
      <div className="v2-offline" role="status" data-testid="offline-banner">
        <WifiOff size={14} color="var(--eos-ash)" aria-hidden />
        <AppText variant="caption" color="var(--eos-bone)" numberOfLines={1}>
          {t('shell.offline')}
        </AppText>
      </div>
    </div>
  );
}
