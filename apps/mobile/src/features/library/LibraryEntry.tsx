import { tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { BookOpen } from 'lucide-react-native';

import { CardRow, IconTile } from '@/ui';
import { useT } from '@/ui/lang';

/** Play tab row into the Library. */
export function LibraryEntry() {
  const t = useT();
  return (
    <CardRow
      testID="play-library"
      title={t('library.entry_title')}
      subtitle={t('library.entry_sub')}
      accessibilityLabel={t('library.entry_a11y')}
      leading={
        <IconTile size={40}>
          <BookOpen size={18} color={tone.gold} strokeWidth={1.8} />
        </IconTile>
      }
      onPress={() => router.push('/library' as Href)}
    />
  );
}
