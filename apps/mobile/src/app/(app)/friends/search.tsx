import '@/features/achievements/icons';
import { UserSearchSheet } from '@/features/social/UserSearchSheet';
import { WebSheet } from '@/ui/webSheet';

export default function UserSearchRoute() {
  return (
    <WebSheet size="tall">
      <UserSearchSheet />
    </WebSheet>
  );
}
