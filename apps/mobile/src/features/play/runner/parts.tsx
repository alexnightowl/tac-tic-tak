import type { AppPieceSet } from '@tac/core/board';
import { board, control, eos, layout, radii, semantic, space, surface } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { Check, XCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PIECE_IMAGES } from '@/board/assets';
import { AppText } from '@/ui';
import { Tap } from '@/ui/Tap';
import type { PlayT } from '../strings';
import { FlameGlyph } from '../ui';

// Runner chrome: round glass buttons, TurnCard with the streak chip, and
// the stat pills (web PlayRunner TurnCard / StatPill / RatingPill).

export function GlassButton({
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
      style={[styles.glassBtn, disabled && styles.disabled]}
    >
      {children}
    </Tap>
  );
}

export type TurnCardProps = {
  loading: boolean;
  opponentMoving: boolean;
  playerColor: 'w' | 'b';
  streak: number;
  streakBroken: number | null;
  pieceSet: AppPieceSet;
  t: PlayT;
};

/** web TurnCard: title priority loading > opponent moving > your turn. */
export function TurnCard({ loading, opponentMoving, playerColor, streak, streakBroken, pieceSet, t }: TurnCardProps) {
  const title = loading ? t('play.loading_puzzle') : opponentMoving ? t('play.opponent_moving') : t('play.your_turn');
  const subtitle =
    loading || opponentMoving ? null : t(playerColor === 'w' ? 'play.find_best_white' : 'play.find_best_black');
  const king = PIECE_IMAGES[pieceSet][playerColor === 'w' ? 'wK' : 'bK'];
  return (
    <View style={styles.turnCard} testID="turn-card">
      <View style={[styles.disc, { backgroundColor: playerColor === 'w' ? board.light : board.dark }]}>
        <Image source={king} style={styles.king} contentFit="contain" transition={null} />
      </View>
      <View style={styles.turnText}>
        <AppText variant="turnTitle" numberOfLines={1} testID="turn-title">
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="turnSubtitle" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {streakBroken != null ? (
        // Key remounts the chip on every change (web 'broken-N' / 'alive-N').
        <StreakChip key={`broken-${streakBroken}`} n={streakBroken} broken />
      ) : streak >= 2 ? (
        <StreakChip key={`alive-${streak}`} n={streak} />
      ) : null}
    </View>
  );
}

function StreakChip({ n, broken = false }: { n: number; broken?: boolean }) {
  const color = broken ? eos.rose : control.streakChipText;
  return (
    <View style={styles.chip} testID="streak-chip">
      <FlameGlyph size={14} color={color} />
      <AppText
        variant="label"
        color={color}
        style={broken ? styles.strike : undefined}
        testID={broken ? 'streak-broken' : 'streak-value'}
      >
        {String(n)}
      </AppText>
    </View>
  );
}

export function StatPills({
  solved,
  failed,
  rating,
  ratingLabel,
  t,
}: {
  solved: number;
  failed: number;
  rating: number | null;
  ratingLabel: string;
  t: PlayT;
}) {
  return (
    <View style={styles.stats}>
      <View style={styles.pill} accessible accessibilityLabel={`${t('play.solved')} ${solved}`}>
        <Check size={14} color={eos.sage} strokeWidth={2.4} />
        <AppText variant="timer" color={eos.sage} testID="runner-solved">
          {String(solved)}
        </AppText>
      </View>
      <View style={[styles.pill, styles.ratingPill]} accessible accessibilityLabel={`${ratingLabel} ${rating ?? ''}`}>
        <AppText variant="label">{ratingLabel}</AppText>
        <AppText variant="timer" testID="runner-rating">
          {rating == null ? '—' : String(rating)}
        </AppText>
      </View>
      <View style={[styles.pill, styles.pillRight]} accessible accessibilityLabel={`${t('play.failed')} ${failed}`}>
        <AppText variant="timer" color={eos.rose} testID="runner-failed">
          {String(failed)}
        </AppText>
        <XCircle size={14} color={eos.rose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassBtn: {
    minWidth: space[11],
    height: space[10],
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    backgroundColor: control.streakChipBg,
  },
  strike: { textDecorationLine: 'line-through' },
  stats: { flexDirection: 'row', gap: space[2] },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    paddingHorizontal: space[3],
    height: layout.inputHeight,
    borderRadius: radii.xl,
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  ratingPill: { justifyContent: 'center', flexDirection: 'column', gap: 0 },
  pillRight: { justifyContent: 'flex-end' },
});
