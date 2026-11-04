'use client';

import { createApiClient, createEndpoints } from '@tac/core/api';

import { API_URL, getToken, setToken } from '@/lib/api';

// The v2 screens' API client: core's typed endpoints (the routes the app
// calls) over the web's token and base URL (docs/web/PLAN.md §2: the web
// keeps its token handling, no refresh tokens).

let expired = false;

export const apiClient = createApiClient({
  baseUrl: API_URL,
  getToken,
  onUnauthorized: () => {
    // As lib/api.ts: one redirect for a burst of parallel 401s.
    if (expired || typeof window === 'undefined') return;
    expired = true;
    setToken(null);
    window.location.replace('/login');
  },
  timeoutMs: 10_000,
});

export const api = createEndpoints(apiClient);
