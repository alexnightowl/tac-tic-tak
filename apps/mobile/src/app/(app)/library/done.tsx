import { useLocalSearchParams } from 'expo-router';

import { ChapterDoneScreen } from '@/features/library/ChapterDoneScreen';

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : d;
};

// /library/done?book&chapter&cycle: chapter complete (fullScreenModal, no swipe-down).
export default function LibraryDoneRoute() {
  const p = useLocalSearchParams<{ book?: string; chapter?: string; cycle?: string }>();
  return <ChapterDoneScreen bookId={p.book ?? ''} chapter={int(p.chapter, 0)} cycle={Math.max(1, int(p.cycle, 1))} />;
}
