import Constants from 'expo-constants';
import { Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

// API base per target (apps/mobile/CLAUDE.md table). The Android emulator
// reaches the host's loopback at 10.0.2.2. A dev build on an iPhone loads
// its JS from Metro on the Mac, so the backend lives on that same host:
// reuse Metro's host (e.g. 192.168.x.y:8081 → :4000). A Release build has no
// Metro and needs EXPO_PUBLIC_API_URL. Switch to /api/v1 once B2 lands.
function devHostApi(): string | null {
  if (!__DEV__) return null;
  // The URL the JS bundle was actually loaded from (http://<mac>:8081/…).
  // expo-constants' hostUri only exists in Expo Go / dev-client builds.
  const sourceCode = TurboModuleRegistry.get<{ getConstants(): { scriptURL?: string } } & TurboModule>('SourceCode');
  const scriptURL = sourceCode?.getConstants().scriptURL;
  const host = scriptURL?.match(/^https?:\/\/([^/:]+)/)?.[1] ?? Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:4000/api` : null;
}

const LOCAL_API =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : devHostApi() ?? 'http://localhost:4000/api';

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
