import { useLocalSearchParams } from 'expo-router';

import { ExamScreen } from '@/features/courses/ExamScreen';

// /course/exam?course: the final exam (fullScreenModal, no swipe; leaving asks first).
export default function CourseExamRoute() {
  const p = useLocalSearchParams<{ course?: string }>();
  const course = p.course ?? '';
  return <ExamScreen key={course} courseId={course} />;
}
