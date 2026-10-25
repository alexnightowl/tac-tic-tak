import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phase 0 placeholder — proves the native shell, Metro and @tac/core resolve.
export default function Hello() {
  return (
    <SafeAreaView style={styles.root} testID="hello-screen">
      <View style={styles.center}>
        <Text style={styles.title}>tac·tic·tak</Text>
        <Text style={styles.sub}>native shell · phase 0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1d1b20' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: '#e7e0d7', fontSize: 32, fontWeight: '700', letterSpacing: 2 },
  sub: { color: '#a5a0a4', fontSize: 14 },
});
