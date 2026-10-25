import { eos } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CustomTabBar } from '@/ui/dev/CustomTabBar';
import { DevLangProvider } from '@/ui/dev/devLang';
import { MockTabPage, type MockTabName } from '@/ui/dev/MockTabPage';

// /dev/tabs-custom: the contained fallback of PLAN §2.3 — a JS tab bar in
// the web's ember-on-stone style, for comparison with /dev/tabs-native.

export default function TabsCustomScreen() {
  const [tab, setTab] = useState<MockTabName>('index');
  return (
    <DevLangProvider>
      <Stack.Screen options={{ title: 'Tabs · custom' }} />
      <View style={styles.root} testID="tc-root">
        <MockTabPage key={tab} tab={tab} prefix="tc" />
        <CustomTabBar active={tab} onChange={setTab} />
      </View>
    </DevLangProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
});
