import { eos } from '@tac/core/tokens';
import { Stack } from 'expo-router';

// Signed-in stack. Phase 4 replaces the temporary Home with the tab shell;
// routes such as play/[id] set their own presentation via Stack.Screen.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: eos.ink } }} />;
}
