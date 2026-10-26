import type { ExpoConfig } from 'expo/config';

// Stone ground from the web's --eos-ink; the app is dark-only.
const STONE = '#1d1b20';

// 'personal' = a free Apple ID team (on-device dev builds before the paid
// Developer Program): no push entitlement. Set APPLE_TEAM_KIND=paid once
// the account exists (PLAN Phase 10).
const PERSONAL_TEAM = (process.env.APPLE_TEAM_KIND ?? 'personal') !== 'paid';

// Placeholder identity — confirm before the first store upload (OWNER-QUESTIONS #1).
const BUNDLE_ID = 'online.tactictak.app';
// On-device builds signed by a free team use a separate id (`.dev`), so the
// real one is never claimed by the personal team before the paid account
// registers it. Simulator builds keep the plain id (Maestro's appId). The
// owner's everyday Release build against the prod API uses `.prod`.
const BUNDLE_SUFFIX = process.env.APP_BUNDLE_SUFFIX ?? '';
// Signing team for on-device builds: the owner's free Personal Team until the
// paid account exists (then set APPLE_TEAM_ID / APPLE_TEAM_KIND=paid).
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? (PERSONAL_TEAM ? '72AATNYW7W' : undefined);

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
  // The dev build sits next to the prod-API one on the owner's phone: tell them apart.
  name: BUNDLE_SUFFIX === '.dev' ? 'tac·tic·tak dev' : 'tac·tic·tak',
  slug: 'tactictak',
  scheme: 'tactictak',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: STONE,
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: BUNDLE_ID + BUNDLE_SUFFIX,
    appleTeamId: APPLE_TEAM_ID,
    supportsTablet: false,
    infoPlist: {
      // Unlock 120 Hz on ProMotion iPhones.
      CADisableMinimumFrameDurationOnPhone: true,
      // Dev builds on a phone reach Metro and the local backend over Wi-Fi.
      NSLocalNetworkUsageDescription: 'tac·tic·tak connects to the development server on your local network.',
    },
  },
  android: {
    package: BUNDLE_ID,
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
    // First on purpose: entitlement mods run in reverse plugin order, so this
    // one runs after expo-notifications has added aps-environment.
    ...(PERSONAL_TEAM ? ['./plugins/withoutPushEntitlement'] : []),
    './plugins/withMetroHostname',
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: STONE,
        image: './assets/images/splash-icon.png',
        // The art is the design's glow box + blur margin at 3× (1332 px,
        // tools/assets splashIcon): 444 pt makes the knight 128 pt, as on login.
        imageWidth: 444,
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
