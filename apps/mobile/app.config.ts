import type { ExpoConfig } from 'expo/config';

// Stone ground from the web's --eos-ink; the app is dark-only.
const STONE = '#1d1b20';

const config: ExpoConfig = {
  name: 'tac·tic·tak',
  slug: 'tactictak',
  scheme: 'tactictak',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: STONE,
  icon: './assets/images/icon.png',
  ios: {
    // Placeholder identity — confirm before the first store upload (OWNER-QUESTIONS #1).
    bundleIdentifier: 'online.tactictak.app',
    supportsTablet: false,
    infoPlist: {
      // Unlock 120 Hz on ProMotion iPhones.
      CADisableMinimumFrameDurationOnPhone: true,
    },
  },
  android: {
    package: 'online.tactictak.app',
    adaptiveIcon: {
      backgroundColor: STONE,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: STONE,
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
