import { createApiClient, createEndpoints } from '@tac/core/api';
import { Platform } from 'react-native';

import { authStore } from '@/stores/authStore';
import { API_URL, APP_VERSION } from './config';

// The app's single API client (PLAN §2.4). The token comes from authStore
// memory; on a cold start it waits for the secure-store read so the first
// /users/me never goes out unauthenticated.

let tokenReady: Promise<void> = Promise.resolve();
let unauthorizedHandler: () => void = () => {};

/** Boot calls this with the secure-store read; requests wait on it. */
export function setTokenGate(p: Promise<unknown>): void {
  tokenReady = p.then(
    () => undefined,
    () => undefined,
  );
}

/** Set once by features/auth (resetAll), kept here to avoid an import cycle. */
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

/** The token requests will carry; waits for the cold-start keychain read. */
export async function currentToken(): Promise<string | null> {
  await tokenReady;
  return authStore.getState().token;
}

export const apiClient = createApiClient({
  baseUrl: API_URL,
  getToken: currentToken,
  onUnauthorized: () => unauthorizedHandler(),
  timeoutMs: 10_000,
  headers: { 'X-Platform': Platform.OS, 'X-App-Version': APP_VERSION },
});

export const api = createEndpoints(apiClient);
