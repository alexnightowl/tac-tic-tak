import * as SecureStore from 'expo-secure-store';

// Phase 2 keeps the web's legacy 7-day JWT, in the Keychain / Keystore
// rather than MMKV. Phase 4 replaces it with a refresh token here and the
// access token in memory only (PLAN §2.4), with a one-time migration.
const TOKEN_KEY = 'taktic.token';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY, OPTS);
  } catch {
    // A Keystore key invalidated by a lock-screen change reads as an
    // error on Android: treat it as signed out.
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, OPTS);
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY, OPTS);
  } catch {
    // already gone
  }
}
