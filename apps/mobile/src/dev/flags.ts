/** Dev labs ship in dev builds, or in a Release build made with EXPO_PUBLIC_DEV_MENU=1 (perf runs). */
export const DEV_MENU = __DEV__ || process.env.EXPO_PUBLIC_DEV_MENU === '1';
