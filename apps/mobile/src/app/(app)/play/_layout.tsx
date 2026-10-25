import { eos } from '@tac/core/tokens';
import { Stack } from 'expo-router';

// Play stack: setup (/play) → runner + summary (/play/[id]). The runner
// keeps the back gesture on: usePreventRemove turns an iOS edge swipe or
// Android back into the exit flow instead of leaving the session.
export default function PlayLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: eos.ink } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ animation: 'fade' }} />
    </Stack>
  );
}
