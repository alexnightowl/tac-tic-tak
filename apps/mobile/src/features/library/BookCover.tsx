import { localized, type LibraryBookSummary } from '@tac/core/library';
import { alpha, black, cover, learn, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PIECE_IMAGES, type PieceCode } from '@/board/assets';
import { bookPortraits } from '@/features/learn/portraits';
import { AppText, textStyle, useLang } from '@/ui';

// The title-page cover (canvas LearnBooks): an old book's title page on
// the cloth — the title in the display face and a diamond ornament on top,
// the author's oval portrait in the middle (two authors: two ovals that
// overlap), the author line in small caps and the years at the foot; a
// 160° cloth gradient (a CSS background on the root: a separate gradient
// view came back from Fabric's recycling with a stale clip and covered the
// rules), the spine shade, two gold rules. `small` (the
// Continue card) keeps only the title, the ornament and the portraits.
// Measures scale from the shelf size (173 × 232); the content insets
// follow the canvas at 92 / 132 / 173 (a + b·w).

const BASE_W = 173;
export const COVER_RATIO = 232 / 173;

type Props = {
  book: Pick<LibraryBookSummary, 'id' | 'title' | 'authors' | 'era' | 'cover' | 'coverPiece'>;
  width: number;
  small?: boolean;
  testID?: string;
};

export function BookCover({ book, width, small = false, testID }: Props) {
  const { lang } = useLang();
  const k = width / BASE_W;
  const palette = cover[book.cover] ?? cover.oxblood;
  const ink = palette.ink;
  const parchment = book.cover === 'parchment';
  const rule = parchment ? learn.parchmentRule : tone.gold;
  const portraits = bookPortraits(book.id);
  const two = portraits.length > 1;
  const ovalW = (two ? 55.7 : 66.8) * k;
  const ovalH = ovalW * 1.25;
  const title = textStyle('title', lang);
  const name = localized(book.title, lang);
  // Titles wrap, never break inside a word: a long word (Cinzel's capitals
  // are wide) shrinks the size until it fits the line (~0.68 em a letter).
  const lineW = width - (10.09 + 0.0284 * width) - (14.09 + 0.0284 * width);
  const longest = Math.max(1, ...name.split(/\s+/).map((w) => w.length));
  const titleSize = Math.min(19 * k, lineW / (longest * 0.68));
  const ornament = alpha(rule, parchment ? 0.9 : 0.85);
  const ring = Math.max(1, 1.5 * k);
  const oval = {
    width: ovalW,
    height: ovalH,
    borderRadius: ovalW / 2,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: ring, color: ornament },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4 * k, color: alpha(black, 0.28) },
      { offsetX: 0, offsetY: 5 * k, blurRadius: 10 * k, spreadDistance: 0, color: alpha(black, 0.4) },
    ],
  };
  const piece = PIECE_IMAGES.classic[`w${book.coverPiece.slice(-1).toUpperCase()}` as PieceCode] ?? PIECE_IMAGES.classic.wQ;

  return (
    <View
      testID={testID}
      style={[styles.root, { width, height: Math.round(width * COVER_RATIO), backgroundImage: `linear-gradient(160deg, ${palette.face[0]} 0%, ${palette.face[1]} 100%)` }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.spine} />
      <View style={[styles.rule, { borderColor: alpha(rule, parchment ? 0.6 : 0.55) }]} />
      <View style={[styles.ruleInner, { borderColor: alpha(rule, parchment ? 0.3 : 0.25) }]} />
      <View
        style={[
          styles.content,
          { top: 9.89 + 0.0642 * width, right: 10.09 + 0.0284 * width, bottom: 9.96 + 0.0407 * width, left: 14.09 + 0.0284 * width },
        ]}
      >
        <AppText style={[title, styles.center, { color: ink, fontSize: titleSize, lineHeight: titleSize * 1.12, letterSpacing: 0.2 }]}>{name}</AppText>
        <View style={[styles.ornament, { marginTop: 6 * k, gap: 4 * k }]}>
          <View style={{ width: 14 * k, height: 1, backgroundColor: ornament }} />
          <View style={{ width: 4 * k, height: 4 * k, transform: [{ rotate: '45deg' }], backgroundColor: ornament }} />
          <View style={{ width: 14 * k, height: 1, backgroundColor: ornament }} />
        </View>
        <View style={styles.middle}>
          {portraits.length > 0 ? (
            portraits.map((src, i) => (
              <View key={i} style={[styles.oval, oval, i > 0 && { marginLeft: -0.16 * ovalW }, { zIndex: i + 1 }]}>
                <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: '30%', left: '50%' }} />
              </View>
            ))
          ) : (
            <View style={[styles.oval, oval, styles.center]}>
              <Image source={piece} style={{ width: ovalW * 0.7, height: ovalW * 0.7, opacity: 0.85 }} tintColor={learn.pieceLit} contentFit="contain" />
            </View>
          )}
        </View>
        {small ? null : (
          <>
            <AppText
              variant="captionStrong"
              style={[styles.center, { color: ink, opacity: 0.85, fontSize: 8.5 * k, lineHeight: 8.5 * k * 1.25, letterSpacing: 1 * k, fontWeight: '800', textTransform: 'uppercase' }]}
            >
              {localized(book.authors, lang)}
            </AppText>
            <AppText
              variant="captionStrong"
              style={[styles.center, { marginTop: 3 * k, color: ink, opacity: 0.55, fontSize: 7.5 * k, lineHeight: 7.5 * k * 1.3, letterSpacing: 1.4 * k }]}
            >
              {localized(book.era, lang)}
            </AppText>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    overflow: 'hidden',
    boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 22, spreadDistance: 0, color: cover.shadow }],
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderLeftWidth: 4,
    borderLeftColor: cover.spine,
    backgroundColor: cover.spineLight,
  },
  rule: { position: 'absolute', left: 11, top: 7, right: 7, bottom: 7, borderWidth: 1, borderRadius: 2 },
  ruleInner: { position: 'absolute', left: 14, top: 10, right: 10, bottom: 10, borderWidth: 1, borderRadius: 1 },
  content: { position: 'absolute', alignItems: 'center' },
  center: { textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  ornament: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  oval: { backgroundColor: learn.ovalGround, overflow: 'hidden' },
});
