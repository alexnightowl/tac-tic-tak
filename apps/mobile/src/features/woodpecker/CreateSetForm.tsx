import type { WoodpeckerDifficulty, WoodpeckerSize } from '@tac/core/api';
import { WOODPECKER_DIFFICULTIES, WOODPECKER_SIZES } from '@tac/core/library';
import { control, eos, semantic, space, tone } from '@tac/core/tokens';
import { StyleSheet, View } from 'react-native';

import { AppText, PlateButton, Segmented, Tap } from '@/ui';
import type { CreateForm } from './create';

/**
 * The phone's create form (empty set page and the New set sheet): size,
 * difficulty cards with their rating window, the style line, Create.
 */
export function CreateSetForm({ f, replacing }: { f: CreateForm; replacing: boolean }) {
  const { t } = f;
  return (
    <View style={styles.form} testID="woodpecker-create">
      <View style={styles.section}>
        <AppText variant="sectionLabel">{t('woodpecker.size')}</AppText>
        <Segmented<`${WoodpeckerSize}`>
          testID="woodpecker-size"
          accessibilityLabel={t('woodpecker.size')}
          size="tight"
          value={`${f.size}`}
          onChange={(v) => f.setSize(Number(v) as WoodpeckerSize)}
          options={WOODPECKER_SIZES.map((n) => ({ value: `${n}` as const, label: String(n) }))}
        />
      </View>
      <View style={styles.section}>
        <AppText variant="sectionLabel">{t('woodpecker.difficulty')}</AppText>
        <View style={styles.diffs} accessibilityRole="radiogroup" accessibilityLabel={t('woodpecker.difficulty')}>
          {WOODPECKER_DIFFICULTIES.map((d) => (
            <DiffCard key={d} d={d} f={f} />
          ))}
        </View>
        <AppText variant="caption" color={eos.ash} testID="woodpecker-from-level">
          {t('woodpecker.from_level', { style: f.styleName, level: f.level })}
        </AppText>
      </View>
      {replacing ? (
        <AppText variant="caption" color={tone.gold} testID="woodpecker-replace-note">
          {t('woodpecker.replace_note')}
        </AppText>
      ) : null}
      {f.failed ? (
        <AppText variant="caption" color={semantic.danger} testID="woodpecker-create-error">
          {t('woodpecker.create_failed')}
        </AppText>
      ) : null}
      <PlateButton
        testID="woodpecker-create-submit"
        label={f.busy ? t('woodpecker.creating') : t('woodpecker.create')}
        loading={f.busy}
        size="lg"
        block
        onPress={f.submit}
      />
    </View>
  );
}

function DiffCard({ d, f }: { d: WoodpeckerDifficulty; f: CreateForm }) {
  const on = f.difficulty === d;
  const name = f.t(`woodpecker.diff.${d}`);
  const range = f.windowText(d);
  return (
    <Tap
      testID={`woodpecker-diff-${d}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${name}, ${range}`}
      onPress={() => f.setDifficulty(d)}
      pressFeel="segmented"
      style={[styles.diff, on && styles.diffOn]}
    >
      <AppText variant="bodyStrong" color={on ? eos.bone : eos.ash} numberOfLines={1}>
        {name}
      </AppText>
      <AppText variant="caption" color={on ? tone.roseSoft : eos.dust} numberOfLines={1} style={styles.tabular}>
        {range}
      </AppText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  section: { gap: space[2.5] },
  diffs: { flexDirection: 'row', gap: space[1], padding: space[1], borderRadius: 14, backgroundColor: eos.well },
  diff: { flex: 1, minWidth: 0, gap: 2, paddingVertical: space[2.5], paddingHorizontal: space[2.5], borderRadius: 10 },
  diffOn: { backgroundColor: eos.slate, borderWidth: 1, borderColor: control.dangerBorder, margin: -1 },
  tabular: { fontVariant: ['tabular-nums'] },
});
