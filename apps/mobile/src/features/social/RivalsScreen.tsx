import { StyleSheet, View } from 'react-native';

import '@/features/achievements/icons';
import { LeaderboardView } from './LeaderboardView';

/** Rivals tab: the leaderboard. Friends are reached from the profile (web /friends). */
export function RivalsScreen() {
  return (
    <View style={styles.root} testID="screen-rivals">
      <LeaderboardView />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
