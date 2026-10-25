import { StatusBar } from 'expo-status-bar';

import { useAppStore } from '@/stores/appStore';

/**
 * Status bar of the focus routes (runner, drill, mistakes review). The
 * gameplay setting focusMode (web: requestFullscreen) hides it; off, it
 * stays like on every other screen. Keep-awake is not tied to it: a timed
 * session must never let the screen sleep.
 */
export function FocusStatusBar() {
  const focus = useAppStore((s) => s.settings.focusMode);
  return <StatusBar hidden={focus} style="light" />;
}
