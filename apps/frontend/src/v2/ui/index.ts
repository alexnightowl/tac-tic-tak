// Design v2 primitives for the web (D31, docs/web/PLAN.md W0): React DOM
// ports of apps/mobile/src/ui, same names and props where they fit the web.
// docs/mobile/DESIGN-SYSTEM-V2.md describes each one; /dev/kit shows them.
import './kit.css';

export { AppText, textClass, textColor, type AppTextProps, type TextVariantName } from './AppText';
export { BrandLogo, HEADER_LOGO_GLOW, type LogoGlow } from './BrandLogo';
export {
  ButtonSpinner,
  Chip,
  CountBadge,
  DangerButton,
  IconButton,
  MiniButton,
  PillButton,
  Spinner,
  TextLink,
  type IconButtonVariant,
  type MiniVariant,
} from './Buttons';
export { CardRow, EmptyState } from './CardRow';
export { ControlBlock, GroupedList, InfoRow, ListSection, Row, Seam, ToggleRow, type RowProps } from './GroupedList';
export { IconTile, ProgressBar, TintIcon } from './IconTile';
export { Input, PasswordInput, type InputProps, type PasswordInputProps } from './Input';
export { BackButton, NavHeader, type BackVariant } from './NavHeader';
export { PlateButton, type PlateButtonProps, type PlateSize, type PlateVariant } from './PlateButton';
export { Press, type PressProps } from './Press';
export { Kicker, PageTitle, SectionLabel, type SectionLabelSize } from './SectionLabel';
export {
  Segmented,
  type SegmentedOption,
  type SegmentedProps,
  type SegmentedSize,
  type SegmentedTone,
} from './Segmented';
export { Sheet, SheetBody, SheetGrabber, type GrabberTone, type SheetMode } from './Sheet';
export { Card, Float, HeroCard, Note, Well, type NoteTone, type WellTone } from './Surfaces';
export { Toggle, type ToggleProps } from './Toggle';
