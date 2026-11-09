import { DxLearn } from '@/desktop/learn';
import { useDesktop } from '@/desktop/useDesktop';
import { LearnScreen } from '@/features/learn/LearnScreen';

// Learn tab (canvas page "Learn"): courses and books, calm study, unrated.
// A desktop-wide browser window gets the DXLearn / DXBooks page.
export default function LearnRoute() {
  const desktop = useDesktop();
  return desktop ? <DxLearn /> : <LearnScreen />;
}
