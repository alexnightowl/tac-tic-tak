import { StreakSheet } from '@/features/home/StreakSheet';
import { WebSheet } from '@/ui/webSheet';

// formSheet (presentation in (app)/_layout): the daily streak details.
export default function StreakRoute() {
  return (
    <WebSheet size="fit">
      <StreakSheet />
    </WebSheet>
  );
}
