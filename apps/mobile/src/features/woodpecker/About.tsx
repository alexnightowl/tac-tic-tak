import { WOODPECKER_BOOK_URL } from '@tac/core/library';
import { eos, graphite, space, tone } from '@tac/core/tokens';
import { BookOpen, ExternalLink } from 'lucide-react-native';
import { Linking, StyleSheet } from 'react-native';

import { AppText, Sheet, Tap } from '@/ui';
import { useT } from '@/ui/lang';

/** The book's page (a new tab on the web). */
export const openBook = () => void Linking.openURL(WOODPECKER_BOOK_URL).catch(() => undefined);

/** The four rules of the method, numbered (phone intro, desktop aside). */
export const HOW_STEPS = ['1', '2', '3', '4'] as const;

/**
 * "What is the Woodpecker method?" (phone sheet): where it comes from,
 * the idea, how the app follows the book, why it works, and the book.
 */
export function AboutSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Sheet visible onClose={onClose} testID="woodpecker-about" closeLabel={t('woodpecker.about.close')}>
      <AppText variant="sectionTitle" accessibilityRole="header">
        {t('woodpecker.about.title')}
      </AppText>
      {(['p1', 'p2', 'p3', 'p4'] as const).map((p) => (
        <AppText key={p} variant="body" color={graphite[300]} style={styles.p}>
          {t(`woodpecker.about.${p}`)}
        </AppText>
      ))}
      <AppText variant="label" style={styles.bookLabel}>
        {t('woodpecker.about.book')}
      </AppText>
      <Tap testID="woodpecker-about-book" accessibilityRole="link" accessibilityLabel={t('woodpecker.about.link_a11y')} onPress={openBook} style={styles.book}>
        <BookOpen size={18} color={tone.roseSoft} strokeWidth={1.8} />
        <AppText variant="bodyStrong" color={eos.bone} style={styles.flex}>
          {t('woodpecker.about.link')}
        </AppText>
        <ExternalLink size={16} color={eos.ash} strokeWidth={1.8} />
      </Tap>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  p: { lineHeight: 21 },
  bookLabel: { marginTop: space[1] },
  book: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
});
