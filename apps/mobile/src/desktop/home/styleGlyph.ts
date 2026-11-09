import type { TrainingStyle } from '@tac/core/rules';
import { Clock3, Flag, Zap, type LucideIcon } from 'lucide-react-native';

/** The artboards' time-control glyphs: clock (rapid), bolt (blitz), flag (bullet). */
export const STYLE_GLYPH: Record<TrainingStyle, LucideIcon> = { rapid: Clock3, blitz: Zap, bullet: Flag };
