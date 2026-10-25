import type { ReactNode } from 'react';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Tab scenes sit between the shell header (which eats the top inset) and
 * the tab bar (which eats the bottom one). Re-provide zero vertical insets
 * so a screen that pads by useSafeAreaInsets() / SafeAreaView is correct
 * both as a tab and as a standalone route.
 */
export function TabSceneInsets({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <SafeAreaInsetsContext value={{ ...insets, top: 0, bottom: 0 }}>{children}</SafeAreaInsetsContext>;
}
