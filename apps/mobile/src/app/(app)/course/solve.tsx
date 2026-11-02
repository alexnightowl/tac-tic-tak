import { useLocalSearchParams } from 'expo-router';

import { intParam } from '@/features/courses/model';
import { CourseSolveScreen } from '@/features/courses/SolveScreen';

// /course/solve?course&chapter&cycle[&replay=1]: a course chapter on the runner (fullScreenModal, see (app)/_layout).
export default function CourseSolveRoute() {
  const p = useLocalSearchParams<{ course?: string; chapter?: string; cycle?: string; replay?: string }>();
  const course = p.course ?? '';
  const chapter = intParam(p.chapter, 0);
  const cycle = Math.max(1, intParam(p.cycle, 1));
  const replay = p.replay === '1';
  return <CourseSolveScreen key={`${course}|${chapter}|${cycle}|${replay}`} courseId={course} chapter={chapter} cycle={cycle} replay={replay} />;
}
