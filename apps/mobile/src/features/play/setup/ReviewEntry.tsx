import { eos } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { plural } from '@/features/offline/format';
import { reviewApi, reviewKeys } from '@/features/review/api';
import { CardRow, IconTile } from '@/ui';
import { useT, useTn } from '@/ui/lang';

const BOOK = require('../../../../assets/icons/nav-review-book.webp');

/**
 * Play's row into Review (app-only; the canvas has no artboard: Review left
 * the tab bar with the Learn tab, LearnStates "Tab bar"). Same row as the
 * Offline one: a 40 pt icon tile with the old Review tab glyph, "Review",
 * and how many missed puzzles wait, summed from GET /review/themes (the
 * list the Review screen shows, so the cache is shared).
 */
export function ReviewEntry() {
  const t = useT();
  const tn = useTn();
  const q = useQuery({ queryKey: reviewKeys.themes(), queryFn: () => reviewApi.themes() });
  const waiting = q.data ? q.data.reduce((n, r) => n + r.count, 0) : null;
  const subtitle = waiting == null ? t('learn.review_entry.hint') : waiting > 0 ? plural(tn, 'learn.review_entry.waiting', waiting) : t('learn.review_entry.empty');
  return (
    <CardRow
      testID="play-review"
      title={t('review.title')}
      subtitle={subtitle}
      accessibilityLabel={`${t('review.title')}, ${subtitle}`}
      leading={
        <IconTile size={40}>
          <Image source={BOOK} style={styles.icon} tintColor={eos.bone} />
        </IconTile>
      }
      onPress={() => router.push('/review' as Href)}
    />
  );
}

const styles = StyleSheet.create({
  icon: { width: 23, height: 20 },
});
