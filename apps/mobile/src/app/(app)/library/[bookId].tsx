import { useLocalSearchParams } from 'expo-router';

import { DxBook } from '@/desktop/learn';
import { useDesktop } from '@/desktop/useDesktop';
import { BookScreen } from '@/features/library/BookScreen';

// /library/[bookId]: a book's page (chapters, cycles, download).
export default function LibraryBookRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const desktop = useDesktop();
  if (desktop) return <DxBook key={bookId} bookId={bookId} />;
  return <BookScreen key={bookId} bookId={bookId} />;
}
