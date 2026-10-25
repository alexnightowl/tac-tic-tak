import { eos } from '@tac/core/tokens';
import { Stack } from 'expo-router';

// Signed-out stack. Phase 4 adds welcome and register here.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: eos.ink } }} />;
}
