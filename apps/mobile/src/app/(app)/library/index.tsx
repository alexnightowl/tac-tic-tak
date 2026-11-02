import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { setLearnSegment } from '@/features/learn/segment';

// /library: the old bookshelf moved to Learn → Books (canvas LearnBooks).
// Old links and the book page's fallback land there.
export default function LibraryRoute() {
  useEffect(() => {
    setLearnSegment('books');
    router.replace('/learn' as Href);
  }, []);
  return null;
}
