import { eos, fontSize, radii } from '@tac/core/tokens';
import { Stack } from 'expo-router';

// Module side effect: every achievement toast gets its glyph, whichever
// screen raised it (the shell's icon registry).
import '@/features/achievements/icons';
import { SettingsEffects } from '@/features/settings/SettingsEffects';
import { ShellErrorBoundary } from '@/shell/ErrorScreen';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';

export const ErrorBoundary = ShellErrorBoundary;

// Signed-in stack (PLAN §2.3). The tab shell sits at the bottom; every
// other screen covers it. Presentation lives here, not in the screens, so
// streams that fill a stub never have to touch this file:
//  - push (native header, ember-on-stone): history, session, viewer,
//    profile, friends, settings/*;
//  - full screen, no header: the runner (fade; its swipe-back / Android
//    back open the ExitSheet via usePreventRemove, so the gesture stays on),
//    drill and mistakes review (fullScreenModal), onboarding;
//  - formSheet: the account menu and the small pickers.
export default function AppLayout() {
  const { lang } = useLang();
  const t = useT();
  const sheet = {
    presentation: 'formSheet',
    headerShown: false,
    sheetGrabberVisible: true,
    sheetCornerRadius: radii.sheet,
    contentStyle: { backgroundColor: eos.shade },
  } as const;
  return (
    <>
      {/* Onboarding gate, reminder re-plan, account sound → engine mirror. */}
      <SettingsEffects />
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: eos.ink },
          headerTintColor: eos.bone,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          // VoiceOver reads the back title; without it, it says "(tabs)".
          headerBackTitle: t('shell.back'),
          headerTitleStyle: {
            fontFamily: fontFamily(lang, 'display', 700),
            fontSize: fontSize.lg[0],
            color: eos.bone,
          },
          contentStyle: { backgroundColor: eos.ink },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Focus routes. */}
        <Stack.Screen name="play/[id]" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="review/[puzzleId]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="sessions/[id]/review" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />

        {/* Push routes (titles set by each screen). */}
        <Stack.Screen name="sessions/index" />
        <Stack.Screen name="sessions/[id]/index" />
        <Stack.Screen name="puzzles/[puzzleId]" />
        <Stack.Screen name="profile/[nickname]" />
        <Stack.Screen name="friends/index" />
        <Stack.Screen name="settings/index" />
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
