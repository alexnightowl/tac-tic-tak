import type { LibraryBookSummary } from '@tac/core/library';
import { eos, layout, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Segmented } from '@/ui';
import { useT } from '@/ui/lang';
import { BooksPane } from './BooksPane';
import { CoursesPane } from './CoursesPane';
import { useLearnSegment, type LearnSegment } from './segment';

// Learn tab (canvas LearnHome / LearnBooks): "Learn", the calm-study line,
// Courses | Books (the last one per user, MMKV), and the pane. Nothing
// here is rated.

export function LearnScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const [segment, setSegment] = useLearnSegment();
  const [width, setWidth] = useState(screenW - layout.gutter * 2);

  const openBook = (book: LibraryBookSummary) => router.push(`/library/${book.id}` as Href);

  return (
    <View style={styles.root} testID="screen-learn">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space[10] }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width - layout.gutter * 2)}
        testID="learn-scroll"
      >
        <AppText variant="heading" accessibilityRole="header" style={styles.title} testID="learn-title">
          {t('learn.title')}
        </AppText>
        <AppText variant="caption" color={tone.mist} style={styles.subtitle}>
          {t('learn.subtitle')}
        </AppText>
        <Segmented<LearnSegment>
          options={[
            { value: 'courses', label: t('learn.segment.courses') },
            { value: 'books', label: t('learn.segment.books') },
          ]}
          value={segment}
          onChange={setSegment}
          testID="learn-segment"
          accessibilityLabel={t('learn.segments_a11y')}
        />
        {segment === 'courses' ? <CoursesPane width={width} /> : <BooksPane width={width} onOpen={openBook} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[2] },
  title: { fontSize: 28, lineHeight: 34 },
  subtitle: { marginTop: space[0.5], marginBottom: 14, fontSize: 13 },
});
