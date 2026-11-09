import { useLocalSearchParams } from 'expo-router';

import { DxLibrarySolve } from '@/desktop/board';
import { useDesktop } from '@/desktop/useDesktop';
import { LibrarySolveScreen } from '@/features/library/SolveScreen';

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : d;
};

// /library/solve?book&chapter&cycle: a chapter in book mode (fullScreenModal, see (app)/_layout).
export default function LibrarySolveRoute() {
  const p = useLocalSearchParams<{ book?: string; chapter?: string; cycle?: string }>();
  const desktop = useDesktop();
  const book = p.book ?? '';
  const chapter = int(p.chapter, 0);
  const cycle = Math.max(1, int(p.cycle, 1));
  const key = `${book}|${chapter}|${cycle}`;
  if (desktop) return <DxLibrarySolve key={key} bookId={book} chapter={chapter} cycle={cycle} />;
  return <LibrarySolveScreen key={key} bookId={book} chapter={chapter} cycle={cycle} />;
}
