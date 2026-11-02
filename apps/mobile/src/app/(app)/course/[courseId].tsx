import { useLocalSearchParams } from 'expo-router';

import { CourseScreen } from '@/features/courses/CourseScreen';

// /course/[courseId]: a course's page (chapters, cycles, exam, download).
export default function CourseRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  return <CourseScreen key={courseId} courseId={courseId} />;
}
