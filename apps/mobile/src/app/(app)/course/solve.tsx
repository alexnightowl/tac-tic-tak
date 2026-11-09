import { useLocalSearchParams } from 'expo-router';

import { DxCourseSolve } from '@/desktop/board';
import { useDesktop } from '@/desktop/useDesktop';
import { intParam } from '@/features/courses/model';
import { CourseSolveScreen } from '@/features/courses/SolveScreen';

// /course/solve?course&chapter&cycle[&replay=1]: a course chapter on the runner (fullScreenModal, see (app)/_layout).
export default function CourseSolveRoute() {
  const p = useLocalSearchParams<{ course?: string; chapter?: string; cycle?: string; replay?: string }>();
  const desktop = useDesktop();
  const course = p.course ?? '';
  const chapter = intParam(p.chapter, 0);
  const cycle = Math.max(1, intParam(p.cycle, 1));
  const replay = p.replay === '1';
  const key = `${course}|${chapter}|${cycle}|${replay}`;
  if (desktop) return <DxCourseSolve key={key} courseId={course} chapter={chapter} cycle={cycle} replay={replay} />;
  return <CourseSolveScreen key={key} courseId={course} chapter={chapter} cycle={cycle} replay={replay} />;
}
