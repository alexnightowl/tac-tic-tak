import { eos } from '@tac/core/tokens';
import { Tabs } from 'expo-router/js-tabs';

import { ShellErrorBoundary } from '@/shell/ErrorScreen';
import { ShellHeader } from '@/shell/ShellHeader';
import { ShellTabBar } from '@/shell/TabBar';
import { TabSceneInsets } from '@/shell/TabSceneInsets';

export const ErrorBoundary = ShellErrorBoundary;

// The five tabs (PLAN §2.3, PROVISIONAL Q3/Q31): JS tabs with the custom
// ember-on-stone bar and the shell header (logo + avatar menu) on every
// tab. Tab screens render content only; each stream owns one tab file.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <ShellTabBar {...props} />}
      screenLayout={({ children }) => <TabSceneInsets>{children}</TabSceneInsets>}
      screenOptions={{
        header: () => <ShellHeader />,
        sceneStyle: { backgroundColor: eos.ink },
        // Instant switch like the web; the ember rule carries the motion.
        animation: 'none',
        // Tabs stay mounted once visited (scroll position, query observers).
        lazy: true,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="review" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="social" />
    </Tabs>
  );
}
