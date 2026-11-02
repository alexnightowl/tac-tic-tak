import { useLocalSearchParams } from 'expo-router';

import { CourseChapterDoneScreen } from '@/features/courses/ChapterDoneScreen';
import { intParam } from '@/features/courses/model';

// /course/done?course&chapter&cycle[&fresh=1]: chapter complete (fullScreenModal, no swipe-down).
export default function CourseDoneRoute() {
  const p = useLocalSearchParams<{ course?: string; chapter?: string; cycle?: string; fresh?: string }>();
  return (
    <CourseChapterDoneScreen
      courseId={p.course ?? ''}
      chapter={intParam(p.chapter, 0)}
      cycle={Math.max(1, intParam(p.cycle, 1))}
      fresh={p.fresh === '1'}
    />
  );
}
