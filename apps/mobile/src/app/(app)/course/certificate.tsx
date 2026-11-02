import { useLocalSearchParams } from 'expo-router';

import { CertificateScreen } from '@/features/courses/CertificateScreen';

// /course/certificate?course[&at]: course complete (fullScreenModal, no swipe-down).
export default function CourseCertificateRoute() {
  const p = useLocalSearchParams<{ course?: string; at?: string }>();
  return <CertificateScreen courseId={p.course ?? ''} at={p.at ?? null} />;
}
