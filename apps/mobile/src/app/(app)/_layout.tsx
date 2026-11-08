import { eos, radii, surface } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

// Module side effect: every achievement toast gets its glyph, whichever
// screen raised it (the shell's icon registry).
import '@/features/achievements/icons';
import { OfflineSyncHost } from '@/features/offline/OfflineSyncHost';
import { SettingsEffects } from '@/features/settings/SettingsEffects';
import { StormSyncHost } from '@/features/storm/sync';
import { ShellErrorBoundary } from '@/shell/ErrorScreen';
import { useT } from '@/ui/lang';
import { stackHeader } from '@/ui/NavHeader';

export const ErrorBoundary = ShellErrorBoundary;

/** One header component for every push route (stable identity across renders). */
const DEFAULT_HEADER = stackHeader('back');

// Signed-in stack (PLAN §2.3). The tab shell sits at the bottom; every
// other screen covers it. Presentation lives here, not in the screens, so
// streams that fill a stub never have to touch this file:
//  - push, with the design v2 nested header (`.back`: round back button,
//    Cinzel 18 title; ui/NavHeader via stackHeader()): history, session,
//    viewer, profile, friends, settings/*. A screen picks another back
//    style with `options={{ header: stackHeader('float' | 'glass') }}`;
//  - full screen, no header: the runner (fade; its swipe-back / Android
//    back open the ExitSheet via usePreventRemove, so the gesture stays on),
//    drill and mistakes review (fullScreenModal), onboarding;
//  - formSheet: the account menu and the small pickers.
export default function AppLayout() {
  const t = useT();
  // The web has no formSheet: there a sheet route is a transparent modal
  // that draws itself as a dialog over a backdrop (ui/webSheet).
  const sheet = {
    presentation: Platform.OS === 'web' ? 'transparentModal' : 'formSheet',
    headerShown: false,
    sheetGrabberVisible: true,
    sheetCornerRadius: radii.sheet,
    contentStyle: { backgroundColor: Platform.OS === 'web' ? 'transparent' : surface.sheet },
  } as const;
  return (
    <>
      {/* Onboarding gate, reminder re-plan, account sound → engine mirror. */}
      <SettingsEffects />
      {/* Offline results sync (start, foreground, network back) + the summary. */}
      <OfflineSyncHost />
      {/* Storm runs: post the queue on start / foreground, finish a killed run. */}
      <StormSyncHost />
      <Stack
        screenOptions={{
          headerShown: true,
          header: DEFAULT_HEADER,
          // Kept for the native back menu / VoiceOver ("(tabs)" otherwise).
          headerBackTitle: t('shell.back'),
          contentStyle: { backgroundColor: eos.ink },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Focus routes. */}
        <Stack.Screen name="play/[id]" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="review/[puzzleId]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="sessions/[id]/review" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="play/levels" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="offline/solve" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="offline/synced" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="library/solve" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="library/done" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="course/solve" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="course/exam" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="course/done" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="course/result" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="course/certificate" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="storm/run" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="storm/result" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />

        {/* Push routes (titles set by each screen). */}
        <Stack.Screen name="offline/index" options={{ headerShown: false }} />
        <Stack.Screen name="library/index" options={{ headerShown: false }} />
        <Stack.Screen name="library/[bookId]" options={{ headerShown: false }} />
        <Stack.Screen name="course/[courseId]" options={{ headerShown: false }} />
        <Stack.Screen name="course/intro" options={{ headerShown: false }} />
        <Stack.Screen name="storm/index" options={{ headerShown: false }} />
        <Stack.Screen name="storm/friends" options={{ headerShown: false }} />
        <Stack.Screen name="challenge/new" options={{ headerShown: false }} />
        <Stack.Screen name="challenge/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="sessions/index" />
        <Stack.Screen name="sessions/[id]/index" />
        <Stack.Screen name="puzzles/[puzzleId]" />
        <Stack.Screen name="profile/[nickname]" />
        <Stack.Screen name="friends/index" />
        <Stack.Screen name="experience" />
        <Stack.Screen name="settings/profile" />
        <Stack.Screen name="settings/gameplay" />
        <Stack.Screen name="settings/sound" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/about" />

        {/* Sheets. */}
        <Stack.Screen name="menu" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen name="play/theme-picker" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="friends/search" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="avatar-source" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen name="achievement/[slug]" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen name="streak" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
      </Stack>
    </>
  );
}
