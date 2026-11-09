import { StyleSheet, View } from 'react-native';

import { useT } from '@/ui/lang';
import { Dialog } from './Dialog';
import { MOD_KEY } from './hotkeys';
import { DText, Kbd } from './kit';
import { dx } from './tokens';

/**
 * Every shortcut the desktop binds, by where it works (Sidebar, DxPlay /
 * DxHome / DxStorm, DxSession, DxReviewDrill / DxChapterSolve).
 */
export const HOTKEY_SECTIONS = [
  {
    title: 'dx.shell.keys.everywhere',
    rows: [
      { label: 'dx.shell.key.search', keys: [MOD_KEY, 'K'] },
      { label: 'dx.shell.key.profile', keys: ['P'] },
      { label: 'dx.shell.key.settings', keys: [','] },
      { label: 'dx.shell.key.all', keys: ['?'] },
    ],
  },
  {
    title: 'dx.shell.keys.play',
    rows: [
      { label: 'dx.shell.key.start', keys: ['Space'] },
      { label: 'dx.shell.key.modes', keys: ['1', '2', '3'] },
    ],
  },
  {
    title: 'dx.shell.keys.session',
    rows: [
      { label: 'dx.shell.key.resume', keys: ['Esc'] },
      { label: 'dx.shell.key.flip', keys: ['F'] },
      { label: 'blind.key.peek', keys: ['B', 'Space'] },
    ],
  },
  {
    title: 'dx.shell.keys.practice',
    rows: [
      { label: 'dx.shell.key.hint', keys: ['H'] },
      { label: 'dx.shell.key.solution', keys: ['R'] },
      { label: 'dx.shell.key.moves', keys: ['←', '→'] },
      { label: 'dx.shell.key.exam_skip', keys: ['S'] },
      { label: 'dx.shell.key.close', keys: ['Esc'] },
    ],
  },
  {
    title: 'woodpecker.title',
    rows: [
      { label: 'woodpecker.key.continue_row', keys: ['Space'] },
      { label: 'woodpecker.key.new_row', keys: ['N'] },
    ],
  },
] as const;

/** The shortcut table by section, two sections a row; reused by the settings page. */
export function HotkeyTable() {
  const t = useT();
  return (
    <View style={styles.grid}>
      {HOTKEY_SECTIONS.map((sec) => (
        <View key={sec.title} style={styles.section}>
          <DText size={10.5} weight={700} ls={1.3} upper color={dx.dust} style={styles.secTitle}>
            {t(sec.title)}
          </DText>
          {sec.rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <DText size={13} color={dx.ash} style={styles.flex} numberOfLines={1}>
                {t(r.label)}
              </DText>
              <View style={styles.keys}>
                {r.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function HotkeysDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Dialog onClose={onClose} width={620} title={t('dx.shell.hotkeys')} testID="dx-hotkeys">
      <HotkeyTable />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 32, rowGap: 14 },
  section: { width: '46%', flexGrow: 1 },
  secTitle: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 30 },
  keys: { flexDirection: 'row', gap: 4 },
});
