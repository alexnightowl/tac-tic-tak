import { eos } from '@tac/core/tokens';
import { Stack } from 'expo-router';

// Signed-out stack: login and register (the welcome pager arrives in Phase 4).
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: eos.ink } }} />;
}
