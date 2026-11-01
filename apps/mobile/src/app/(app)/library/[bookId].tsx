import { useLocalSearchParams } from 'expo-router';

import { BookScreen } from '@/features/library/BookScreen';

// /library/[bookId]: a book's page (chapters, cycles, download).
export default function LibraryBookRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  return <BookScreen key={bookId} bookId={bookId} />;
}
