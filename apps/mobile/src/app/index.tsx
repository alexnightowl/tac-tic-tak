import { initPuzzle } from '@tac/core/puzzle';
import { createTranslator } from '@tac/core/i18n';
import { eos, fontFamilies } from '@tac/core/tokens';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phase 0 placeholder — proves the native shell, embedded fonts and that
// Metro resolves @tac/core (tokens, i18n, chess.js via puzzle).
const SAMPLE = initPuzzle({
  id: 'FuA7b',
  fen: '8/7b/5P1p/8/1pk3PP/8/3K4/8 b - - 0 43',
  moves: ['h7g6', 'h4h5', 'g6f7'],
  rating: 1210,
  themes: [],
  gameUrl: null,
});
const uk = createTranslator('uk');

export default function Hello() {
  return (
    <SafeAreaView style={styles.root} testID="hello-screen">
      <View style={styles.center}>
        <Text style={styles.title}>tac·tic·tak</Text>
        <Text style={styles.sub}>{uk.t('play.new_session')}</Text>
        <Text style={styles.mono} testID="hello-core">
          {SAMPLE.playerColor === 'w' ? 'white' : 'black'} to move · {SAMPLE.remaining.length} to play
        </Text>
        {__DEV__ && (
          <Link href="/dev" asChild>
            <Pressable testID="open-dev" style={styles.dev}>
              <Text style={styles.devText}>dev menu</Text>
            </Pressable>
          </Link>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { color: eos.bone, fontSize: 34, fontFamily: fontFamilies.serif[700], letterSpacing: 2 },
  sub: { color: eos.ash, fontSize: 16, fontFamily: fontFamilies.sans[500] },
  dev: { marginTop: 24, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: eos.seam },
  devText: { color: eos.ash, fontSize: 13, fontFamily: fontFamilies.sans[600] },
  mono: { color: eos.dust, fontSize: 13, fontFamily: fontFamilies.sans[400] },
});
