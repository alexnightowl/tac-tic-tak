import type { ExpoConfig } from 'expo/config';

// Stone ground from the web's --eos-ink; the app is dark-only.
const STONE = '#1d1b20';

// Embedded at build time. File name = PostScript name, so the same
// fontFamily string resolves on iOS and Android (see @tac/core/tokens).
// Forum / Cormorant SC / Prata are Cyrillic display candidates for the
// owner to pick from (OWNER-QUESTIONS #2); the losers get dropped.
const FONTS = [
  'Manrope-Regular', 'Manrope-Medium', 'Manrope-SemiBold', 'Manrope-Bold', 'Manrope-ExtraBold',
  'Cinzel-Regular', 'Cinzel-Medium', 'Cinzel-SemiBold', 'Cinzel-Bold', 'Cinzel-ExtraBold', 'Cinzel-Black',
  'Forum', 'Prata-Regular',
  'CormorantSC-Light', 'CormorantSC-Regular', 'CormorantSC-Medium', 'CormorantSC-SemiBold', 'CormorantSC-Bold',
].map((name) => `./assets/fonts/${name}.ttf`);

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
    // Pulled in by native audio/media libraries; the app never records.
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: STONE,
        image: './assets/images/splash-icon.png',
        // The splash art carries its own glow, so the knight is ~36% of it.
        imageWidth: 240,
      },
    ],
    ['expo-font', { fonts: FONTS }],
    'expo-asset',
    'expo-secure-store',
    'expo-localization',
    [
      'expo-image-picker',
      {
        photosPermission: 'tac·tic·tak uses your photos to set your profile picture.',
        cameraPermission: 'tac·tic·tak uses the camera to take your profile picture.',
        microphonePermission: false,
      },
    ],
    ['expo-notifications', { color: '#a64241' }],
    [
      'react-native-audio-api',
      {
        // Short SFX only: no background audio, no media foreground service
        // (both would need store-review justification).
        iosBackgroundMode: false,
        androidForegroundService: false,
        androidPermissions: [],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
