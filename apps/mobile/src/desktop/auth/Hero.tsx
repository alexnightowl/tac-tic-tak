import { STYLE_FORMULAS, TRAINING_STYLES } from '@tac/core/rules';
import { KNOWN_THEME_SLUGS } from '@tac/core/themes';
import { alpha, black, board, eos, tone, white } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { BOARD_IMAGE, PIECE_IMAGES, type PieceCode } from '@/board/assets';
import { APP_VERSION } from '@/platform/config';
import { useRawWindow } from '@/platform/webFrame';
import { useT, useTn } from '@/ui/lang';
import { DText, Label, Num, Title } from '../kit';
import { dx } from '../tokens';
import { Wordmark } from './Wordmark';

// The hero stats are the app's own numbers, not the artboard's samples:
// the tactical themes the theme picker lists, the training styles, and the
// shortest session any style allows. (The artboard's "3.2 M puzzles" has no
// source in the app, so it is not shown.)
const THEME_COUNT = KNOWN_THEME_SLUGS.length;
const STYLE_COUNT = TRAINING_STYLES.length;
const SHORTEST_MIN = Math.round(Math.min(...TRAINING_STYLES.map((s) => STYLE_FORMULAS[s].minDurationSec)) / 60);

/** `radial-gradient(circle at 42% 40%, …)` behind the hero (CSS: web only). */
const GLOW = `radial-gradient(circle at 42% 40%, ${alpha(tone.emberGlow, 0.28)}, ${alpha(eos.ember, 0.1)} 30%, ${alpha(dx.side, 0)} 62%)`;

/**
 * DXLogin / DXRegister left panel: the ember glow, logo + wordmark, the
 * tilted Greek-gift board, eyebrow, headline, lede, three stats, the
 * puzzle-source line.
 */
export function AuthHero() {
  const t = useT();
  const tn = useTn();
  const { height } = useRawWindow();
  // 380 px at 900 tall; shrinks on shorter windows so it clears the copy.
  const boardSize = Math.round(Math.max(260, Math.min(380, height * 0.42)));
  const stats = [
    { value: String(THEME_COUNT), label: tn('dx.auth.stat_themes', THEME_COUNT) },
    { value: String(STYLE_COUNT), label: tn('dx.auth.stat_styles', STYLE_COUNT) },
    { value: t('dx.auth.stat_minutes', { n: SHORTEST_MIN }), label: t('dx.auth.stat_shortest') },
  ];
  return (
    <View style={styles.hero} testID="auth-hero">
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: GLOW, pointerEvents: 'none' }} />
      <Wordmark logo={40} size={22} />
      <View style={styles.boardSlot} pointerEvents="none">
        <DecorBoard size={boardSize} />
      </View>
      <View style={styles.copy}>
        <Label color={dx.rose}>{t('dx.auth.eyebrow')}</Label>
        <Title size={44} style={styles.headline}>
          {t('dx.auth.headline')}
        </Title>
        <DText size={16} lh={25} color={dx.ash} style={styles.lede}>
          {t('dx.auth.lede')}
        </DText>
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label}>
              <Num size={24}>{s.value}</Num>
              <DText size={12.5} color={dx.dust}>
                {s.label}
              </DText>
            </View>
          ))}
        </View>
      </View>
      <DText size={12} color={dx.dust}>
        {t('dx.auth.footer', { version: APP_VERSION })}
      </DText>
    </View>
  );
}

// The artboard's position: the Greek gift, Bd3 picked with its rays to h7.
const PIECES: readonly [string, PieceCode][] = [
  ['a8', 'bR'], ['c8', 'bB'], ['f8', 'bR'], ['g8', 'bK'],
  ['a7', 'bP'], ['b7', 'bP'], ['f7', 'bP'], ['g7', 'bP'], ['h7', 'bP'],
  ['c6', 'bN'], ['e6', 'bP'], ['f6', 'bN'], ['d5', 'bP'],
  ['d4', 'wP'], ['c3', 'wP'], ['d3', 'wB'], ['f3', 'wN'],
  ['a2', 'wP'], ['c2', 'wQ'], ['f2', 'wP'], ['g2', 'wP'], ['h2', 'wP'],
  ['a1', 'wR'], ['f1', 'wR'], ['g1', 'wK'],
];
const DOTS = ['e4', 'f5', 'g6'] as const;
const RING = 'h7';
const SELECTED = 'd3';

function sqPos(sq: string, s: number) {
  return { left: (sq.charCodeAt(0) - 97) * s, top: (8 - Number(sq[1])) * s };
}

/** The tilted, faded board in the hero (static art, not a Board). */
function DecorBoard({ size }: { size: number }) {
  const s = size / 8;
  const dot = s * 0.28;
  return (
    <View style={[styles.decor, { width: size, height: size }]}>
      <Image source={BOARD_IMAGE} style={StyleSheet.absoluteFill} contentFit="fill" />
      <View style={[styles.sel, sqPos(SELECTED, s), { width: s, height: s }]} />
      {PIECES.map(([sq, code]) => (
        <Image key={sq} source={PIECE_IMAGES.classic[code]} style={[styles.piece, sqPos(sq, s), { width: s, height: s }]} contentFit="contain" />
      ))}
      {DOTS.map((sq) => {
        const p = sqPos(sq, s);
        return <View key={sq} style={[styles.dot, { left: p.left + (s - dot) / 2, top: p.top + (s - dot) / 2, width: dot, height: dot }]} />;
      })}
      <View style={[styles.ring, sqPos(RING, s), { width: s * 0.88, height: s * 0.88, margin: s * 0.06, borderWidth: s * 0.08 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1.15,
    overflow: 'hidden',
    backgroundColor: dx.side,
    borderRightWidth: 1,
    borderRightColor: dx.sideBorder,
    paddingVertical: 48,
    paddingHorizontal: 56,
    justifyContent: 'space-between',
  },
  boardSlot: { position: 'absolute', right: -70, top: 70, opacity: 0.55, transform: [{ rotate: '-8deg' }] },
  decor: {
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(white, 0.06) },
      { offsetX: 0, offsetY: 24, blurRadius: 60, spreadDistance: 0, color: alpha(black, 0.6) },
    ],
  },
  sel: { position: 'absolute', backgroundColor: board.selected, borderWidth: 3, borderColor: board.selectedRing },
  piece: { position: 'absolute' },
  dot: { position: 'absolute', borderRadius: 999, backgroundColor: alpha(eos.ink, 0.38) },
  ring: { position: 'absolute', borderRadius: 999, borderColor: alpha(eos.ink, 0.38) },
  copy: { maxWidth: 460, marginTop: 'auto', marginBottom: 40 },
  headline: { lineHeight: 52, marginTop: 12 },
  lede: { marginTop: 16 },
  stats: { flexDirection: 'row', gap: 28, marginTop: 32 },
});
