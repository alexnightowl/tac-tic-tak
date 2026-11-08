import { ThemePickerSheet } from '@/features/play/themes/ThemePickerSheet';
import { WebSheet } from '@/ui/webSheet';

// formSheet (presentation in (app)/_layout): the theme-mode picker.
export default function ThemePickerRoute() {
  return (
    <WebSheet size="tall">
      <ThemePickerSheet />
    </WebSheet>
  );
}
