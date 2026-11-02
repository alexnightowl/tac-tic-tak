import { Stack } from 'expo-router';

import { ReviewTabScreen } from '@/features/review/ReviewTabScreen';

// /review (push; was a tab until the Learn tab, now the Play screen's
// Review button): theme cards → drill. The page carries its own large
// title, so the nested header shows only the back button.
export default function ReviewRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <ReviewTabScreen />
    </>
  );
}
