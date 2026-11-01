import { LEVEL_GUARD_GAP } from '@tac/core/rules';
import { levelProgress } from '@tac/core/runner';
import { control, eos, radii, semantic, space, surface, tone } from '@tac/core/tokens';
import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import type { PlayT } from '../strings';
import { ProgressBar, STRONG, TABULAR } from '../ui';

// The slot under the TurnCard (design PlayV2Runner*): the way to the next
// level in a rated session, the casual note in a casual one. One shell, so
// the slot keeps its shape between states.

/** Rated: the live rating between the level and the next mark. */
export function LevelProgressBar({ rating, level, t }: { rating: number; level: number; t: PlayT }) {
  const p = levelProgress(rating, level);
  const ready = rating >= p.next;
  const below = rating < level - LEVEL_GUARD_GAP;
  const note = ready
    ? t('level.ready_note', { rating, next: p.next })
    : below
      ? t('level.below_note', { rating, line: level - LEVEL_GUARD_GAP })
      : t('level.bar_note', { rating, n: p.toNext, next: p.next });
  return (
    <View style={[styles.shell, ready ? styles.shellMet : null]} testID="runner-level-bar">
      <View style={styles.head}>
        <View style={styles.label}>
          {ready && <Sparkles size={12} color={eos.ember} />}
          <AppText variant="label" testID="runner-level-label">
            {ready ? t('level.in_reach', { next: p.next }) : t('level.next')}
          </AppText>
        </View>
        <AppText variant="caption" color={eos.dust} style={TABULAR}>
          {`${level} → `}
          <AppText variant="caption" color={ready ? eos.ember : eos.ash} style={ready ? STRONG : undefined}>
            {String(p.next)}
          </AppText>
        </AppText>
      </View>
      <ProgressBar ratio={ready ? 1 : p.ratio} color={ready ? eos.ember : tone.sageDeep} testID="runner-level-progress" />
      <AppText variant="caption" color={eos.dust} numberOfLines={2} testID="runner-level-note">
        {note}
      </AppText>
    </View>
  );
}

/** Casual: unrated, the difficulty picked, and the rating that stays put. */
export function CasualBar({ difficulty, rating, level, t }: { difficulty: number; rating: number; level: number; t: PlayT }) {
  return (
    <View style={styles.shell} testID="runner-casual-bar">
      <View style={styles.head}>
        <AppText variant="label">{t('casual.bar')}</AppText>
        <AppText variant="caption" color={eos.ash} style={TABULAR}>
          {t('casual.puzzles', { rating: difficulty })}
        </AppText>
      </View>
      <AppText variant="caption" color={eos.dust} numberOfLines={2}>
        {t('casual.bar_note', { rating, level })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
    backgroundColor: surface.floatCard,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    gap: space[1.5],
  },
  shellMet: { borderColor: control.dangerBorder, backgroundColor: control.dangerPressBg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  label: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], flexShrink: 1 },
});
