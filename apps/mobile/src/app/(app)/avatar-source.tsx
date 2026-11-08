import { AvatarSourceSheet } from '@/features/profile/AvatarSourceSheet';
import { WebSheet } from '@/ui/webSheet';

// Deep-linkable avatar source sheet (camera / library). In-app entry points
// use the native action sheet (chooseAvatar); this route serves links.
export default function AvatarSourceRoute() {
  return (
    <WebSheet size="fit">
      <AvatarSourceSheet />
    </WebSheet>
  );
}
