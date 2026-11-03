import { useLocalSearchParams } from 'expo-router';

import { ChallengeScreen } from '@/features/challenge/ChallengeScreen';

// /challenge/:id: Incoming, Result, Waiting or a closed state, by status
// and role (also tactictak://challenge/<id>).
export default function ChallengeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChallengeScreen key={id} id={id ?? ''} />;
}
