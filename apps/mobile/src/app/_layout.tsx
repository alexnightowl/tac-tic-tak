import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { preloadSounds } from '@/feel';

const STONE = '#1d1b20';

export default function RootLayout() {
  // Decode every short clip up front: without it the first sound of a
  // session lands ~200 ms late. Moves into the splash gate in Phase 4.
  useEffect(() => {
    void preloadSounds();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: STONE }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: STONE } }} />
    </GestureHandlerRootView>
  );
}
