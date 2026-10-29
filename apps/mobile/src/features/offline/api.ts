import { isApiError, type AbortSignalLike } from '@tac/core/api';
import type { OfflinePackKind, OfflinePackResponse, OfflineSyncBody, OfflineSyncResponse } from '@tac/core/offline';
import type { TrainingStyle } from '@tac/core/rules';

import { apiClient } from '@/platform/api';

// docs/mobile/OFFLINE.md "API". Both routes are new (branch api/offline);
// until a backend ships them they 404, which callers show as "not
// available yet" and never treat as a lost result.

export const offlineApi = {
  pack: (q: { kind: OfflinePackKind; style: TrainingStyle; count?: number }, signal?: AbortSignalLike) =>
    apiClient.get<OfflinePackResponse>('/offline/pack', { query: q, signal, timeoutMs: 30_000 }),
  /** Idempotent per clientId: a retry after a lost response is always safe. */
  sync: (body: OfflineSyncBody) => apiClient.post<OfflineSyncResponse>('/offline/sync', body, { timeoutMs: 30_000 }),
};

/** The route is missing on this backend (not deployed yet). */
export const isUnavailable = (e: unknown) => isApiError(e) && e.status === 404;
export const isAborted = (e: unknown) => isApiError(e) && e.kind === 'aborted';
