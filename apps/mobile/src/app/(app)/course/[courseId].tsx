import { useLocalSearchParams } from 'expo-router';

import { DxCourse } from '@/desktop/learn';
import { useDesktop } from '@/desktop/useDesktop';
import { CourseScreen } from '@/features/courses/CourseScreen';

// /course/[courseId]: a course's page (chapters, cycles, exam, download).
export default function CourseRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const desktop = useDesktop();
  if (desktop) return <DxCourse key={courseId} courseId={courseId} />;
  return <CourseScreen key={courseId} courseId={courseId} />;
}
