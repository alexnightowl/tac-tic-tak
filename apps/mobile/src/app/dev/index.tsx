import { eos, fontFamilies } from '@tac/core/tokens';
import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

// Every lab gets a row; screens are added by the Phase 1 work streams.
const LABS = [
  { href: '/dev/board-lab', title: 'Board lab', note: 'drag / tap / promotion / arrows · ?fen=&orientation=' },
  { href: '/dev/bench', title: 'Board bench', note: 'FrameStats + JS jam' },
  { href: '/dev/feel-lab', title: 'Feel lab', note: 'every feel event · latency · tuning' },
  { href: '/dev/metronome', title: 'Metronome', note: 'flash + click every 500 ms' },
  { href: '/dev/pulsar-trial', title: 'Pulsar trial', note: 'haptic patterns from a worklet' },
  { href: '/dev/kitchen-sink', title: 'Kitchen sink', note: 'every primitive, every state' },
  { href: '/dev/typography', title: 'Typography', note: 'en / uk, display candidates' },
  { href: '/dev/tabs-native', title: 'Tabs · native', note: 'NativeTabs mock' },
  { href: '/dev/tabs-custom', title: 'Tabs · custom', note: 'custom bar mock' },
] as const;

export default function DevMenu() {
  return (
    <ScrollView contentContainerStyle={styles.list} testID="dev-menu">
      <Stack.Screen options={{ title: 'Dev' }} />
      {LABS.map((lab) => (
        <Link key={lab.href} href={lab.href as never} asChild>
          <Pressable style={styles.row} testID={`dev-${lab.href.split('/').pop()}`}>
            <Text style={styles.title}>{lab.title}</Text>
            <Text style={styles.note}>{lab.note}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  row: { backgroundColor: eos.slate, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: eos.seam },
  title: { color: eos.bone, fontSize: 16, fontFamily: fontFamilies.sans[700] },
  note: { color: eos.ash, fontSize: 12, marginTop: 2, fontFamily: fontFamilies.sans[400] },
});
