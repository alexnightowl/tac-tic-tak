import { eos } from '@tac/core/tokens';
import { EyeOff, Info } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { BLIND_PREVIEWS, useBlindPick } from '@/features/play/blind/store';
import { feel } from '@/feel';
import { Toggle } from '@/ui/Toggle';
import { useT } from '@/ui/lang';
import { Card, Chip, DText, IconSquare, Label } from '../kit';
import { dx } from '../tokens';

/**
 * /play on desktop (Free / Themes): the "Blind" card under the difficulty:
 * the switch, then the look time chips and the advice to start lower.
 */
export function DxBlindSetup() {
  const t = useT();
  const { on, previewSec, setOn, setPreview } = useBlindPick();
  return (
    <Card style={styles.card} testID="dx-play-blind">
      <View style={styles.head}>
        <IconSquare icon={EyeOff} color={on ? dx.rose : dx.ash} />
        <View style={styles.flex}>
          <DText size={15} weight={800}>
            {t('blind.title')}
          </DText>
          <DText size={12.5} color={dx.dust} style={styles.mt2}>
            {t('blind.setup.desc')}
          </DText>
        </View>
        <Toggle value={on} onChange={setOn} testID="dx-play-blind-toggle" accessibilityLabel={t('blind.setup.toggle_a11y')} />
      </View>
      {on ? (
        <View style={styles.body}>
          <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('blind.setup.preview')}>
            <Label style={styles.rowLabel}>{t('blind.setup.preview')}</Label>
            {BLIND_PREVIEWS.map((sec) => (
              <Chip
                key={sec}
                testID={`dx-play-blind-preview-${sec}`}
                accessibilityLabel={t('blind.setup.sec_a11y', { n: sec })}
                label={t('blind.setup.sec', { n: sec })}
                on={sec === previewSec}
                onPress={() => {
                  if (sec !== previewSec) feel.emit('sliderDetent');
                  setPreview(sec);
                }}
                style={styles.chip}
              />
            ))}
          </View>
          <View style={styles.note} testID="dx-play-blind-hint">
            <Info size={14} color={eos.ember} strokeWidth={1.8} />
            <DText size={12.5} color={dx.ash} style={styles.flex}>
              {t('blind.setup.hint')}
            </DText>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 18, paddingHorizontal: 22 },
  flex: { flex: 1, minWidth: 0 },
  mt2: { marginTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  body: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: dx.rowRule, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { marginRight: 6 },
  chip: { minWidth: 64, justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
