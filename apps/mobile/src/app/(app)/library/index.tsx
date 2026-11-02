import { Redirect } from 'expo-router';

import { setLearnSegment } from '@/features/learn/segment';

// /library: the old bookshelf moved to Learn → Books (canvas LearnBooks).
// Old links and the book page's fallback land there.
export default function LibraryRoute() {
  setLearnSegment('books');
  return <Redirect href="/learn" />;
}
