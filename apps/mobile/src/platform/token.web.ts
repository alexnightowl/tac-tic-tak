// Web: no Keychain; the token lives in localStorage like the Next web's.
const TOKEN_KEY = 'taktic.token';

export async function loadToken(): Promise<string | null> {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // already gone
  }
}
