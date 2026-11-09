import { StyleSheet, View } from 'react-native';

import { useT } from '@/ui/lang';
import { Dialog } from './Dialog';
import { MOD_KEY } from './hotkeys';
import { DText, Kbd } from './kit';
import { dx } from './tokens';

/** Every shortcut the desktop knows, as two columns (DXSettings "Гарячі клавіші"). */
export const HOTKEY_ROWS = [
  { label: 'dx.shell.key.start', keys: ['Space'] },
  { label: 'dx.shell.key.hint', keys: ['H'] },
  { label: 'dx.shell.key.skip', keys: ['S'] },
  { label: 'dx.shell.key.flip', keys: ['F'] },
  { label: 'dx.shell.key.pause', keys: ['Esc'] },
  { label: 'dx.shell.key.search', keys: [MOD_KEY, 'K'] },
  { label: 'dx.shell.key.next', keys: ['→'] },
  { label: 'dx.shell.key.modes', keys: ['1', '2', '3'] },
  { label: 'dx.shell.key.profile', keys: ['P'] },
  { label: 'dx.shell.key.settings', keys: [','] },
  { label: 'dx.shell.key.all', keys: ['?'] },
] as const;

/** The shortcut table, two columns; reused by the settings page. */
export function HotkeyTable() {
  const t = useT();
  return (
    <View style={styles.grid}>
      {HOTKEY_ROWS.map((r) => (
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 32 },
  row: { width: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, height: 32 },
  keys: { flexDirection: 'row', gap: 4 },
});
