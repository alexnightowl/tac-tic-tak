import { Platform } from 'react-native';

// What this platform can do (D35: the web runs the app itself). App-only
// features hide their entry points where the platform lacks them.

/** Offline packs and downloading courses / books for offline play. */
export const HAS_OFFLINE = Platform.OS !== 'web';
/** Haptic feedback. */
export const HAS_HAPTICS = Platform.OS !== 'web';
/** Scheduled local notifications (the daily reminder). */
export const HAS_REMINDERS = Platform.OS !== 'web';
