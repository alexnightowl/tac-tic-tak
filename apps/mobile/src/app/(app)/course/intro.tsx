import { useLocalSearchParams } from 'expo-router';

import { IntroScreen } from '@/features/courses/IntroScreen';
import { intParam } from '@/features/courses/model';

// /course/intro?course&chapter: a chapter's intro before its first pass.
export default function CourseIntroRoute() {
  const p = useLocalSearchParams<{ course?: string; chapter?: string }>();
  const course = p.course ?? '';
  const chapter = intParam(p.chapter, 0);
  return <IntroScreen key={`${course}|${chapter}`} courseId={course} chapter={chapter} />;
}
