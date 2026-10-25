import Constants from 'expo-constants';
import { Platform } from 'react-native';

// API base per target (apps/mobile/CLAUDE.md table). The Android emulator
// reaches the host's loopback at 10.0.2.2; a physical phone needs the
// Mac's LAN IP via EXPO_PUBLIC_API_URL. Switch to /api/v1 once B2 lands.
const LOCAL_API = Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api';

export const API_URL: string = process.env.EXPO_PUBLIC_API_URL || LOCAL_API;

/** Host only, for /uploads/* assets that live outside the /api prefix. */
export const API_HOST: string = API_URL.replace(/\/api\/?$/, '');

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

/** Resolves a backend-relative asset URL (web assetUrl()). */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? path : `/${path}`}`;
}
