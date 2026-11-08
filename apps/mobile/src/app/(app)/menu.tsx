import { AccountMenu } from '@/shell/AccountMenu';
import { WebSheet } from '@/ui/webSheet';

// The header avatar's account sheet (formSheet, options in (app)/_layout).
export default function MenuRoute() {
  return (
    <WebSheet size="fit">
      <AccountMenu />
    </WebSheet>
  );
}
