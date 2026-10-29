import type { AppPieceSet } from '@tac/core/board';
import type { PracticeTitle } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { board, control, eos, layout, radii, semantic, space, surface } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { Check, Lightbulb } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { PIECE_IMAGES } from '@/board/assets';
import { AppText, PlateButton } from '@/ui';
import type { TFn } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { solvedPopTiming } from '../motion';

// Practice runner chrome (web review/[puzzleId], sessions/[id]/review and
// puzzles/[puzzleId]): round glass buttons, the TurnCard with its title
// override, the 18 pt themes line, hint button and the Solved badge.

export function RoundButton({
  testID,
  label,
  onPress,
  disabled,
  children,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={[styles.round, disabled && styles.disabled]}
    >
      {children}
    </Tap>
  );
}

/** web TurnCard with the `override` the viewer used ('Solved!', 'Solution'). */
export function PracticeTurnCard({
  title,
  playerColor,
  pieceSet,
  subtitle,
  t,
}: {
  title: PracticeTitle;
  playerColor: 'w' | 'b';
  pieceSet: AppPieceSet;
  subtitle?: string | null;
  t: TFn;
}) {
  const text =
    title === 'loading'
      ? t('play.loading_puzzle')
      : title === 'opponent'
        ? t('play.opponent_moving')
        : title === 'solved'
          ? t('review.solved')
          : title === 'solution'
            ? t('puzzle.show_solution')
            : t('play.your_turn');
  const sub =
    subtitle !== undefined
      ? subtitle
      : title === 'yourTurn'
        ? t(playerColor === 'w' ? 'play.find_best_white' : 'play.find_best_black')
        : null;
  const king = PIECE_IMAGES[pieceSet][playerColor === 'w' ? 'wK' : 'bK'];
  return (
    <View style={styles.turnCard} testID="turn-card">
      <View style={[styles.disc, { backgroundColor: playerColor === 'w' ? board.light : board.dark }]}>
        <Image source={king} style={styles.king} contentFit="contain" transition={null} />
      </View>
      <View style={styles.turnText}>
        <AppText variant="turnTitle" numberOfLines={1} testID="turn-title" color={title === 'solved' ? eos.sage : undefined}>
          {text}
        </AppText>
        {sub ? (
          <AppText variant="turnSubtitle" numberOfLines={1} testID="turn-subtitle">
            {sub}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Fixed-height themes line (web 18 px slot: up to 3 non-meta labels, or the retry note). */
export function ThemesLine({ slugs, lang, note, noteColor }: { slugs: string[]; lang: 'en' | 'uk'; note?: string | null; noteColor?: string }) {
  return (
    <View style={styles.themes}>
      <AppText variant="caption" numberOfLines={1} color={note ? (noteColor ?? eos.rose) : eos.ash} testID="practice-themes">
        {note ?? slugs.map((s) => themeLabel(s, lang)).join(' · ')}
      </AppText>
    </View>
  );
}

export function HintButton({ level, disabled, onPress, t }: { level: number; disabled: boolean; onPress: () => void; t: TFn }) {
  return (
    <Tap
      testID="practice-hint"
      accessibilityRole="button"
      accessibilityLabel={t('review.hint')}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      // Both hints used: the design keeps the lit button at full strength (it is
      // still inert); only a not-yet-usable hint dims.
      style={[styles.hint, disabled && level < 2 && styles.disabled]}
    >
      <Lightbulb size={16} color={level > 0 ? eos.ember : eos.bone} />
      <AppText variant="label" color={eos.bone}>
        {t('review.hint')}
      </AppText>
      {/* Level pips; the testIDs let flows check hint 1 and hint 2. */}
      <View style={styles.pips}>
        <View style={[styles.pip, level >= 1 && styles.pipOn]} testID={level >= 1 ? 'practice-hint-1' : undefined} />
        <View style={[styles.pip, level >= 2 && styles.pipOn]} testID={level >= 2 ? 'practice-hint-2' : undefined} />
      </View>
    </Tap>
  );
}

/** The hint button morphs into this (web .review-solved-pop). `fit`: no 120 pt min width (viewer). */
export function SolvedBadge({ t, fit = false }: { t: TFn; fit?: boolean }) {
  const reduced = useReducedMotion();
  const k = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) k.set(withTiming(1, solvedPopTiming));
  }, [k, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, k.get() * 1.6), transform: [{ scale: 0.9 + 0.1 * k.get() }] }));
  return (
    <Animated.View style={[styles.badge, fit && styles.badgeFit, anim]} testID="practice-solved" accessible accessibilityLabel={t('review.solved')}>
      <Check size={16} color={eos.sage} />
      <AppText variant="label" color={eos.sage}>
        {t('review.solved')}
      </AppText>
    </Animated.View>
  );
}

export function DoneView({
  testID,
  title,
  hint,
  primary,
  secondary,
}: {
  testID: string;
  title: string;
  hint: string;
  primary: { label: string; testID: string; onPress: () => void };
  secondary: { label: string; testID: string; onPress: () => void };
}) {
  return (
    <View style={styles.done} testID={testID}>
      <View style={styles.doneIcon}>
        <Check size={28} color={eos.sage} />
      </View>
      <AppText variant="sectionTitle" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" color={eos.ash} style={styles.center}>
        {hint}
      </AppText>
      <View style={styles.doneButtons}>
        <PlateButton label={primary.label} testID={primary.testID} onPress={primary.onPress} variant="ember" size="lg" block />
        <PlateButton label={secondary.label} testID={secondary.testID} onPress={secondary.onPress} variant="slate" size="lg" block />
      </View>
    </View>
  );
}

/** Done screen window (MobDrill / MobSessionMistakes `done`: top 160, bottom 140). */
const DONE_TOP = space[20] * 2;
const DONE_BOTTOM = space[20] + space[14] + space[1];

const styles = StyleSheet.create({
  round: {
    minWidth: space[11],
    height: space[11],
    paddingHorizontal: space[3],
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1.5],
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  disabled: { opacity: 0.5 },
  turnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[2.5],
    borderRadius: radii['2xl'],
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  disc: {
    width: layout.turnCardDisc,
    height: layout.turnCardDisc,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  king: { width: layout.turnCardKing, height: layout.turnCardKing },
  turnText: { flex: 1, gap: space[0.5] },
  themes: { height: space[5], justifyContent: 'center', paddingHorizontal: space[1] },
  hint: {
    height: space[11],
    minWidth: space[20] + space[10],
    paddingHorizontal: space[4],
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  pips: { flexDirection: 'row', gap: space[1] },
  pip: { width: space[1.5], height: space[1.5], borderRadius: radii.full, backgroundColor: eos.seam },
  pipOn: { backgroundColor: eos.ember },
  badge: {
    height: space[11],
    minWidth: space[20] + space[10],
    paddingHorizontal: space[4],
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    backgroundColor: control.sageTint16,
  },
  badgeFit: { minWidth: 0 },
  // Design: the block is centred in a fixed window (top 160, bottom 140 of the
  // screen), not in the space under the close button.
  done: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    top: DONE_TOP,
    bottom: DONE_BOTTOM,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  doneIcon: {
    width: space[16],
    height: space[16],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: control.sageTint16,
    marginBottom: space[2],
  },
  doneButtons: { alignSelf: 'stretch', gap: space[3], marginTop: space[4] },
  center: { textAlign: 'center' },
});
