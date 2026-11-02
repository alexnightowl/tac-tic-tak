import { useLocalSearchParams } from 'expo-router';

import { ExamResultScreen } from '@/features/courses/ExamResultScreen';

// /course/result?course&at: an exam try that did not pass (fullScreenModal, no swipe-down).
export default function CourseResultRoute() {
  const p = useLocalSearchParams<{ course?: string; at?: string }>();
  return <ExamResultScreen courseId={p.course ?? ''} at={p.at ?? null} />;
}
