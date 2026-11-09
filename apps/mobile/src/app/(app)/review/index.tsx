import { Stack } from 'expo-router';

import { DxReview } from '@/desktop/learn';
import { useDesktop } from '@/desktop/useDesktop';
import { ReviewTabScreen } from '@/features/review/ReviewTabScreen';

// /review (push; was a tab until the Learn tab, now the Play screen's
// Review button): theme cards → drill. The page carries its own large
// title, so the nested header shows only the back button.
export default function ReviewRoute() {
  const desktop = useDesktop();
  return (
    <>
      <Stack.Screen options={{ title: '', headerShown: !desktop }} />
      {desktop ? <DxReview /> : <ReviewTabScreen />}
    </>
  );
}
