import { useLocalSearchParams } from 'expo-router';

import { SessionDetailScreen } from '@/features/sessions/SessionDetailScreen';

// /sessions/[id]: session detail (push).
export default function SessionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionDetailScreen key={id} id={id} />;
}
