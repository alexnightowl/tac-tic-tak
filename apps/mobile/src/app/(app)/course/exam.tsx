import { useLocalSearchParams } from 'expo-router';

import { DxCourseExam } from '@/desktop/board';
import { useDesktop } from '@/desktop/useDesktop';
import { ExamScreen } from '@/features/courses/ExamScreen';

// /course/exam?course: the final exam (fullScreenModal, no swipe; leaving asks first).
export default function CourseExamRoute() {
  const p = useLocalSearchParams<{ course?: string }>();
  const desktop = useDesktop();
  const course = p.course ?? '';
  if (desktop) return <DxCourseExam key={course} courseId={course} />;
  return <ExamScreen key={course} courseId={course} />;
}
