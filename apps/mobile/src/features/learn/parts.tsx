import { eos, graphite, layout, space, tone } from '@tac/core/tokens';
import { Check, Download } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { HAS_OFFLINE } from '@/platform/capabilities';
import type { DownloadView } from '@/features/library/model';
import { AppText, Chip, ProgressBar } from '@/ui';
import { useT } from '@/ui/lang';

// Pieces both Learn panes share (canvas LearnHome / LearnBooks): the filter
// chips, the meta line under a grid tile, the status icon.

export type LearnFilter = 'all' | 'progress' | 'downloaded' | 'finished';
// The web has no offline copies, so no "on this device" filter there.
export const FILTERS: readonly LearnFilter[] = HAS_OFFLINE ? ['all', 'progress', 'downloaded', 'finished'] : ['all', 'progress', 'finished'];

export const GRID_GAP = space[4];

export function FilterChips({
  value,
  onChange,
  testID,
  keys = 'library.filter',
}: {
  value: LearnFilter;
  onChange: (f: LearnFilter) => void;
  testID: string;
  /** Label key prefix: the books keep the Library's ("Reading"), courses have their own. */
  keys?: 'library.filter' | 'learn.filter';
}) {
  const t = useT();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsWrap} contentContainerStyle={styles.chips}>
      {FILTERS.map((f) => (
        <Chip
          key={f}
          testID={`${testID}-${f}`}
          label={t(`${keys}.${f}`)}
          accessibilityLabel={t('library.filter_a11y', { filter: t(`${keys}.${f}`) })}
          selected={value === f}
          onPress={() => onChange(f)}
        />
      ))}
    </ScrollView>
  );
}

/** 14 pt status glyph: on the phone (sage check), downloading (copper spinner), not downloaded (dust arrow). */
export function StatusIcon({ state, testID }: { state: DownloadView; testID: string }) {
  if (!HAS_OFFLINE) return null;
  if (state === 'downloaded') return <Check testID={testID} size={14} color={tone.sageDeep} strokeWidth={2.4} style={styles.icon} />;
  if (state === 'downloading') return <ActivityIndicator testID={testID} size="small" color={tone.copper} style={styles.spinner} />;
  return <Download testID={testID} size={14} color={eos.dust} strokeWidth={2} style={styles.icon} />;
}

/** Title (wraps, never truncates), status line + icon, the thin progress bar. */
export function TileMeta({
  title,
  status,
  icon,
  ratio,
  done,
  testID,
}: {
  title: string;
  status: string;
  icon: ReactNode;
  ratio: number;
  /** Finished: a full sage bar. */
  done: boolean;
  testID: string;
}) {
  return (
    <>
      <View style={styles.meta}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" style={styles.title}>
            {title}
          </AppText>
          <AppText variant="caption" color={tone.mist} style={styles.status} testID={`${testID}-sub`}>
            {status}
          </AppText>
        </View>
        {icon}
      </View>
      <ProgressBar value={done ? 1 : ratio} height={4} trackColor={eos.slate} colors={done ? [tone.sageDeep, tone.sageDeep] : [eos.ember, eos.ember]} />
    </>
  );
}

export function Footnote({ children }: { children: string }) {
  return (
    <AppText variant="caption" color={graphite[600]} style={styles.footnote}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  chipsWrap: { marginTop: space[5], marginHorizontal: -layout.gutter, flexGrow: 0 },
  chips: { paddingHorizontal: layout.gutter, gap: space[2] },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1.5] },
  title: { fontSize: 13.5, lineHeight: 18 },
  status: { fontSize: 11.5, lineHeight: 15 },
  icon: { marginTop: 2 },
  spinner: { transform: [{ scale: 0.7 }], marginTop: -4 },
  footnote: { marginTop: 22, marginHorizontal: space[1], lineHeight: 18 },
});
