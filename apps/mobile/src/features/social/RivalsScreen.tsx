import { StyleSheet, View } from 'react-native';

import '@/features/achievements/icons';
import { RivalsChallenges } from '@/features/challenge/RivalsChallenges';
import { LeaderboardView } from './LeaderboardView';

/** Rivals tab: the challenges section (app-only), then the leaderboard. Friends are reached from the profile (web /friends). */
export function RivalsScreen() {
  return (
    <View style={styles.root} testID="screen-rivals">
      <LeaderboardView top={<RivalsChallenges />} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
