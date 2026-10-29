import { Easing, type WithTimingConfig } from 'react-native-reanimated';

// Offline packs motion. A pack download has no progress events (one JSON
// response), so the row's bar eases towards DOWNLOAD_CREEP while the request
// is in flight and snaps to full when it lands.

export const DOWNLOAD_CREEP = 0.9;

export const downloadCreepTiming: WithTimingConfig = { duration: 2400, easing: Easing.out(Easing.cubic) };
