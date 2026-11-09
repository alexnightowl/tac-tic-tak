import { control, eos, radii, semantic, space, tone } from '@tac/core/tokens';
import { EyeOff, Info } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Toggle } from '@/ui';
import { useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { BLIND_PREVIEWS, useBlindPick } from './store';

/**
 * Play setup (phone, Free / Themes): the "Blind" switch, then the look
 * time chips (3 / 5 / 10 s) and the advice to start lower.
 */
export function BlindSetup() {
  const t = useT();
  const { on, previewSec, setOn, setPreview } = useBlindPick();
  return (
    <View style={styles.root} testID="setup-blind">
      <View style={styles.head}>
        <EyeOff size={15} color={on ? eos.bone : eos.ash} strokeWidth={2} />
        <AppText variant="sectionLabel" style={styles.flex}>
          {t('blind.title')}
        </AppText>
        <Toggle value={on} onChange={setOn} testID="setup-blind-toggle" accessibilityLabel={t('blind.setup.toggle_a11y')} />
      </View>
      <AppText variant="caption" color={eos.ash}>
        {t('blind.setup.desc')}
      </AppText>
      {on && (
        <>
          <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('blind.setup.preview')}>
            <AppText variant="label" style={styles.rowLabel}>
              {t('blind.setup.preview')}
            </AppText>
            {BLIND_PREVIEWS.map((sec) => {
              const sel = sec === previewSec;
              return (
                <Tap
                  key={sec}
                  testID={`setup-blind-preview-${sec}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={t('blind.setup.sec_a11y', { n: sec })}
                  onPress={() => setPreview(sec)}
                  pressFeel="sliderDetent"
                  hitSlop={{ top: 5, bottom: 5 }}
                  style={[styles.chip, sel ? styles.chipOn : styles.chipOff]}
                >
                  <AppText variant="chip" color={sel ? tone.onEmber : eos.ash}>
                    {t('blind.setup.sec', { n: sec })}
                  </AppText>
                </Tap>
              );
            })}
          </View>
          <View style={styles.note} testID="setup-blind-hint">
            <Info size={14} color={tone.mist} />
            <AppText variant="caption" color={tone.mist} style={styles.flex}>
              {t('blind.setup.hint')}
            </AppText>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[2.5] },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowLabel: { marginRight: space[1] },
  chip: { flex: 1, height: 34, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: eos.ember },
  chipOff: { backgroundColor: control.chipBg, borderWidth: 1, borderColor: semantic.borderSoft },
  note: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
